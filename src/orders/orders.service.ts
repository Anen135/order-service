import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { ALLOWED_TRANSITIONS, OrderStatus } from './enums/order-status.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Role } from '../users/role.enum';

const LIST_CACHE_TTL = 30; // сек — короткий TTL, т.к. заказы меняются часто

export interface RequestUser {
  id: string;
  email: string;
  roles: Role[];
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(actor: RequestUser, dto: CreateOrderDto): Promise<Order> {
    const totalAmount = dto.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const number = await this.generateOrderNumber();

    const order = this.ordersRepo.create({
      number,
      customerName: dto.customerName,
      customerId: null, // резерв под сценарий self-service клиентов; в текущей модели заказ оформляет сотрудник
      items: dto.items as any,
      totalAmount,
      comment: dto.comment ?? null,
      status: OrderStatus.NEW,
      createdBy: actor.id,
    });

    const saved = await this.ordersRepo.save(order);
    await this.invalidateListCache();

    await this.notifications.publishOrderEvent({
      type: 'order.created',
      orderId: saved.id,
      status: saved.status,
      customerId: saved.customerId,
      actorEmail: actor.email,
    });

    return saved;
  }

  async findAll(query: QueryOrdersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const cacheKey = `orders:list:${query.status ?? 'all'}:${query.customerName ?? 'all'}:${page}:${limit}`;

    const cached = await this.redis.getJson<{ items: Order[]; total: number }>(cacheKey);
    if (cached) {
      return { ...cached, page, limit, cached: true };
    }

    const qb = this.ordersRepo.createQueryBuilder('order').orderBy('order.createdAt', 'DESC');
    if (query.status) qb.andWhere('order.status = :status', { status: query.status });
    if (query.customerName) {
      qb.andWhere('order.customerName ILIKE :name', { name: `%${query.customerName}%` });
    }
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    await this.redis.setJson(cacheKey, { items, total }, LIST_CACHE_TTL);

    return { items, total, page, limit, cached: false };
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Заказ не найден');
    return order;
  }

  async updateStatus(actor: RequestUser, id: string, dto: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.findOne(id);

    const allowedNext = ALLOWED_TRANSITIONS[order.status];
    if (!allowedNext.includes(dto.status)) {
      throw new BadRequestException(
        `Переход статуса из "${order.status}" в "${dto.status}" недопустим`,
      );
    }

    order.status = dto.status;
    const saved = await this.ordersRepo.save(order);
    await this.invalidateListCache();

    await this.notifications.publishOrderEvent({
      type: 'order.status_changed',
      orderId: saved.id,
      status: saved.status,
      customerId: saved.customerId,
      actorEmail: actor.email,
    });

    return saved;
  }

  async remove(id: string): Promise<void> {
    const order = await this.findOne(id);
    await this.ordersRepo.remove(order);
    await this.invalidateListCache();

    await this.notifications.publishOrderEvent({
      type: 'order.deleted',
      orderId: id,
      customerId: order.customerId,
    });
  }

  private async invalidateListCache() {
    await this.redis.delByPattern('orders:list:*');
  }

  private async generateOrderNumber(): Promise<string> {
    // Простой инкрементальный номер на основе счётчика в Redis —
    // без блокировок таблицы и гонок при параллельных запросах
    const seq = await this.redis.client.incr('orders:number_seq');
    return `ORD-${String(seq).padStart(6, '0')}`;
  }
}

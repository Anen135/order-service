import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export const ORDER_EVENTS_CHANNEL = 'order_events';

export interface OrderEventPayload {
  type: 'order.created' | 'order.status_changed' | 'order.deleted';
  orderId: string;
  status?: string;
  customerId?: string | null;
  actorEmail?: string | null;
  at: string;
}

/**
 * Публикует событие в Redis-канал. Сам Gateway подписан на этот канал и
 * рассылает событие всем подключённым WS-клиентам на этом (и любом другом)
 * инстансе приложения — так уведомления работают даже за балансировщиком
 * с несколькими репликами сервиса.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly redis: RedisService) {}

  async publishOrderEvent(payload: Omit<OrderEventPayload, 'at'>) {
    await this.redis.publish(ORDER_EVENTS_CHANNEL, { ...payload, at: new Date().toISOString() });
  }
}

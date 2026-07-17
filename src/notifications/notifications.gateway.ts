import { Logger, OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import { ORDER_EVENTS_CHANNEL, OrderEventPayload } from './notifications.service';
import { Role } from '../users/role.enum';

/**
 * WS namespace /notifications. Клиент подключается с JWT в handshake:
 *   io('/notifications', { auth: { token: '<accessToken>' } })
 *
 * После аутентификации сокет добавляется в комнаты:
 *  - user:<userId>        — персональные уведомления
 *  - role:<role>          — уведомления по роли (например все менеджеры видят новые заказы)
 *
 * События о заказах приходят не напрямую из OrdersService, а через Redis
 * Pub/Sub (канал order_events) — это позволяет рассылать уведомления всем
 * инстансам приложения, а не только тому, который обработал HTTP-запрос.
 */
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: '*' },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    // Подписываемся на канал заказов один раз при старте модуля
    await this.redis.subscribe(ORDER_EVENTS_CHANNEL, (payload: OrderEventPayload) => {
      this.broadcastOrderEvent(payload);
    });
  }

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) throw new Error('Токен не передан');

      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
      client.data.roles = payload.roles as string[];

      client.join(`user:${payload.sub}`);
      (payload.roles as string[]).forEach((role) => client.join(`role:${role}`));

      this.logger.log(`WS подключение: user=${payload.sub}, roles=${payload.roles}`);
    } catch (err) {
      this.logger.warn(`Отклонено WS подключение: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS отключение: ${client.id}`);
  }

  private broadcastOrderEvent(payload: OrderEventPayload) {
    // Владельцу заказа — персонально
    if (payload.customerId) {
      this.server.to(`user:${payload.customerId}`).emit('orderEvent', payload);
    }
    // Менеджерам и админам — все события по заказам, чтобы видеть новые заявки
    this.server.to(`role:${Role.MANAGER}`).to(`role:${Role.ADMIN}`).emit('orderEvent', payload);
  }
}

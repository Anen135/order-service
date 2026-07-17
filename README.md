# Order Management Service

REST + WebSocket сервис управления заказами на NestJS.

## Стек

- **NestJS 10** — Backend (Auth, Users, Orders, Audit, Notifications)
- **PostgreSQL** + TypeORM — хранение пользователей, заказов, аудит-лога
- **Redis** — кэширование списков заказов + Redis-адаптер для Socket.IO (масштабирование WS между инстансами)
- **JWT + Passport** — аутентификация (`admin`, `manager`, `customer`)
- **Socket.IO** — real-time уведомления об изменениях заказов
- **Swagger** — автогенерируемая документация API
- **Docker / docker-compose** — контейнеризация всего стека

## Быстрый старт

```bash
cp .env.example .env
docker compose up --build
```

После старта:

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/api/docs`
- WebSocket namespace: `ws://localhost:3000/orders`

## Роли и доступ

| Действие                          | customer          | manager | admin |
|-----------------------------------|--------------------|---------|-------|
| Создать заказ                     | ✅ (себе)          | ✅      | ✅    |
| Смотреть свои заказы              | ✅                 | ✅      | ✅    |
| Смотреть все заказы               | ❌                 | ✅      | ✅    |
| Менять статус заказа (workflow)   | ❌ (только отмена своего NEW) | ✅ | ✅ |
| Смотреть аудит-лог                | ❌                 | ✅      | ✅    |
| Управлять ролями пользователей    | ❌                 | ❌      | ✅    |

Guard'ы: `JwtAuthGuard` (глобальный, кроме `@Public()`) + `RolesGuard` (по `@Roles(...)`).

## Жизненный цикл заказа

```
NEW ──► PROCESSING ──► SHIPPED ──► DELIVERED
  └────────────────► CANCELLED
```
Переходы валидируются в `OrdersService.updateStatus` через `ORDER_STATUS_TRANSITIONS`.

## Аудит

Каждое значимое действие (регистрация, логин/неудачный логин, создание заказа, смена статуса, смена роли пользователя) пишется в таблицу `audit_logs` через `AuditService.record()`: кто, что, над какой сущностью, old/new value, IP. Просмотр — `GET /audit-logs` (admin/manager).

## Real-time уведомления

Клиент подключается к namespace `/orders`, передавая JWT:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/orders', {
  auth: { token: '<JWT access token>' },
});

socket.on('order.created', (payload) => console.log(payload));
socket.on('order.statusChanged', (payload) => console.log(payload));
```

Сервер кладёт сокет в комнату `user:{userId}` и, если роль `admin`/`manager`, дополнительно в `role:admin` / `role:manager`. При изменении заказа `NotificationsGateway.emitOrderEvent` рассылает событие владельцу заказа и всем менеджерам/админам. Redis pub/sub (`@socket.io/redis-adapter`) обеспечивает доставку между несколькими инстансами приложения за балансировщиком.

## Кэширование

Списки заказов (`GET /orders`) кэшируются в Redis на 30 секунд по составному ключу (роль, customerId, фильтр статуса, страница). Кэш инвалидируется по паттерну при создании заказа или смене статуса.

## Основные эндпоинты

- `POST /auth/register`, `POST /auth/login`
- `GET /users`, `GET /users/:id`, `PATCH /users/:id/role` (admin)
- `POST /orders`, `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id/status`
- `GET /audit-logs?entity=Order&entityId=...`
- `GET /health`

Полное описание с моделями запросов/ответов — в Swagger UI.

## Локальная разработка без Docker

```bash
npm install
# поднять postgres и redis отдельно, прописать их адреса в .env
npm run start:dev
```

## Миграции

Проект по умолчанию использует `synchronize: true` вне production для скорости разработки. Для продакшена — миграции TypeORM:

```bash
npm run migration:generate -- src/migrations/Init
npm run migration:run
```
(не забудьте выключить `synchronize` в `app.module.ts`).

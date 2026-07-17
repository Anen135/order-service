# Order Management Service

Сервис заказов на NestJS: REST API, роли, аудит, уведомления по WebSocket.

## Запуск

```bash
cp .env.example .env
docker compose up --build
```

Адреса после запуска:

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/api/docs`
- WebSocket: `ws://localhost:3000/notifications`

## Технологии

- NestJS 10
- PostgreSQL, TypeORM
- Redis
- JWT, Passport
- Socket.IO
- Swagger
- Docker

## Роли и доступ

В проекте есть три роли: `admin`, `manager`, `viewer`.

`admin` может управлять пользователями, заказами и смотреть журнал аудита.
`manager` работает с заказами.
`viewer` имеет доступ только на чтение там, где он разрешен контроллерами.

## Жизненный цикл заказа

```
NEW ──► PROCESSING ──► SHIPPED ──► DELIVERED
  └────────────────► CANCELLED
```
Переходы валидируются в `OrdersService.updateStatus` через `ALLOWED_TRANSITIONS`.

## Аудит

Мутирующие запросы пишутся в `audit_logs` через глобальный interceptor.
Журнал доступен по `GET /audit-logs` для `admin`.

## WebSocket

Клиент подключается к namespace `/notifications` и передает JWT:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/notifications', {
  auth: { token: '<JWT access token>' },
});

socket.on('orderEvent', (payload) => console.log(payload));
```

События по заказам публикуются через Redis Pub/Sub, поэтому уведомления доходят до подключений на разных инстансах приложения.

## Кэширование

`GET /orders` кэшируется в Redis на 30 секунд. Кэш сбрасывается при создании, удалении заказа и изменении статуса.

## Эндпоинты

- `POST /auth/register`, `POST /auth/login`
- `GET /users`, `GET /users/:id`, `PATCH /users/:id/role`
- `POST /orders`, `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id/status`, `DELETE /orders/:id`
- `GET /audit-logs?entity=Order&entityId=...`
- `GET /health`

Детали запросов и ответов есть в Swagger.

## Без Docker

```bash
npm install
npm run start:dev
```

## Миграции

Вне production включен `synchronize`. Для production лучше использовать миграции:

```bash
npm run migration:generate -- src/migrations/Init
npm run migration:run
```

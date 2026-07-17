import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  public client: Redis;
  public publisher: Redis;
  public subscriber: Redis;

  constructor(private readonly config: ConfigService) {
    const options = {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
    };
    this.client = new Redis(options);
    this.publisher = new Redis(options);
    this.subscriber = new Redis(options);
  }

  async onModuleDestroy() {
    await Promise.all([this.client.quit(), this.publisher.quit(), this.subscriber.quit()]);
  }

  async publish(channel: string, payload: unknown) {
    await this.publisher.publish(channel, JSON.stringify(payload));
  }

  async subscribe(channel: string, handler: (payload: any) => void) {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          handler(JSON.parse(message));
        } catch {
          handler(message);
        }
      }
    });
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number) {
    const data = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.set(key, data, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, data);
    }
  }

  async getJson<T = any>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async delByPattern(pattern: string) {
    const keys = await this.client.keys(pattern);
    if (keys.length) await this.client.del(...keys);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

export interface AuditEntry {
  userId: string | null;
  userEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  method: string;
  path: string;
  requestBody: Record<string, any> | null;
  responseSnapshot: Record<string, any> | null;
  ip: string | null;
  success: boolean;
  errorMessage?: string | null;
}

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  async record(entry: AuditEntry) {
    // Аудит не должен ломать основной запрос — ошибки просто логируем в консоль процесса
    try {
      const log = this.repo.create(entry);
      await this.repo.save(log);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Не удалось записать audit log:', err);
    }
  }

  async findAll(filters: { userId?: string; entity?: string; action?: string }) {
    const qb = this.repo.createQueryBuilder('log').orderBy('log.createdAt', 'DESC');
    if (filters.userId) qb.andWhere('log.userId = :userId', { userId: filters.userId });
    if (filters.entity) qb.andWhere('log.entity = :entity', { entity: filters.entity });
    if (filters.action) qb.andWhere('log.action = :action', { action: filters.action });
    return qb.limit(200).getMany();
  }
}

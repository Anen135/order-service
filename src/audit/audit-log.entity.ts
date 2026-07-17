import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ nullable: true })
  userId: string | null;

  @Column({ nullable: true })
  userEmail: string | null;

  @Index()
  @Column()
  action: string;

  @Column()
  entity: string;

  @Column({ nullable: true })
  entityId: string | null;

  @Column()
  method: string;

  @Column()
  path: string;

  @Column({ type: 'jsonb', nullable: true })
  requestBody: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  responseSnapshot: Record<string, any> | null;

  @Column({ nullable: true })
  ip: string | null;

  @Column({ default: true })
  success: boolean;

  @Column({ nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

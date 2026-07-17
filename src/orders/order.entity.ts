import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderStatus } from './enums/order-status.enum';
import { OrderItem } from './order-item.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  number: string; // человекочитаемый номер заказа, например ORD-000123

  @Column()
  customerName: string;

  // Заказчик, если создан аутентифицированным пользователем (может быть null для гостевых заказов)
  @Index()
  @Column({ nullable: true })
  customerId: string | null;

  @Index()
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.NEW })
  status: OrderStatus;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true, eager: true })
  items: OrderItem[];

  @Column('numeric', { precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ nullable: true })
  comment: string | null;

  // id пользователя, создавшего заказ (менеджер/админ, оформивший заказ клиента)
  @Column({ nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

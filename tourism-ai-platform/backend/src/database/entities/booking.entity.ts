import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantAwareEntity } from './tenant-aware.entity';
import { CaseEntity } from './case.entity';

@Entity({ name: 'bookings' })
export class BookingEntity extends TenantAwareEntity {
  @ManyToOne(() => CaseEntity, { eager: true })
  @JoinColumn({ name: 'case_id' })
  case!: CaseEntity;

  @Column({ name: 'case_id' })
  @Index()
  caseId!: string;

  @Column({ type: 'varchar', length: 64 })
  status!: string;

  @Column({ type: 'jsonb', default: {} })
  confirmation!: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  paymentInfo!: Record<string, any>;
}

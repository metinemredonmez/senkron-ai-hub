import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantAwareEntity } from './tenant-aware.entity';
import { CaseEntity } from './case.entity';

@Entity({ name: 'communication_logs' })
export class CommunicationLogEntity extends TenantAwareEntity {
  @ManyToOne(() => CaseEntity, { eager: false })
  @JoinColumn({ name: 'case_id' })
  case!: CaseEntity;

  @Column({ name: 'case_id', nullable: true })
  @Index()
  caseId?: string | null;

  @Column({ type: 'varchar', length: 32 })
  channel!: 'whatsapp' | 'email' | 'phone' | 'sms' | 'portal';

  @Column({ type: 'varchar', length: 16 })
  direction!: 'inbound' | 'outbound';

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;
}

import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantAwareEntity } from './tenant-aware.entity';
import { CaseEntity } from './case.entity';

@Entity({ name: 'approval_tasks' })
export class ApprovalTaskEntity extends TenantAwareEntity {
  @ManyToOne(() => CaseEntity, (medicalCase) => medicalCase.approvalTasks, {
    eager: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'case_id' })
  case!: CaseEntity;

  @Column({ name: 'case_id' })
  @Index()
  caseId!: string;

  @Column({ type: 'varchar', length: 64 })
  type!: string;

  @Column({ type: 'varchar', length: 32, default: 'PENDING' })
  status!: 'PENDING' | 'APPROVED' | 'REJECTED';

  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt?: Date | null;
}

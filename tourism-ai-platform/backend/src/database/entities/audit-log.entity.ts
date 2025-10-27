import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from './tenant-aware.entity';

@Entity({ name: 'audit_logs' })
export class AuditLogEntity extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 255 })
  action!: string;

  @Column({ type: 'varchar', length: 255 })
  resource!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  resourceId?: string | null;

  @Column({ type: 'varchar', length: 64 })
  actorId!: string;

  @Column({ type: 'varchar', length: 16, default: 'SUCCESS' })
  @Index()
  status!: 'SUCCESS' | 'ERROR' | 'WARNING';

  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, any>;
}

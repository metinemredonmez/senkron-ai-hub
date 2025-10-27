import { Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export abstract class TenantAwareEntity extends BaseEntity {
  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  @Index()
  tenantId!: string;
}

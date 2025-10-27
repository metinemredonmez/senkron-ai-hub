import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { TenantAwareEntity } from './tenant-aware.entity';
import { TenantEntity } from './tenant.entity';
import { CaseEntity } from './case.entity';

@Entity({ name: 'users' })
export class UserEntity extends TenantAwareEntity {
  @ManyToOne(() => TenantEntity, (tenant) => tenant.users, { eager: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  @Index()
  override tenantId!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index({ unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 512 })
  passwordHash!: string;

  @Column({ type: 'varchar', array: true, default: () => 'ARRAY[]::varchar[]' })
  roles!: string[];

  @Column({ type: 'jsonb', default: {} })
  attributes!: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => CaseEntity, (medicalCase) => medicalCase.createdBy)
  cases!: CaseEntity[];
}

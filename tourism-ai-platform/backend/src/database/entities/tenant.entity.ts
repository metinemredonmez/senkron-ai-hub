import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'tenants' })
export class TenantEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  @Index()
  code!: string;

  @Column({ type: 'jsonb', default: {} })
  settings!: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => UserEntity, (user) => user.tenant)
  users!: UserEntity[];
}

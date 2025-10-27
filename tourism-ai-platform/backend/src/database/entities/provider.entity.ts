import { Column, Entity, Index, OneToMany } from 'typeorm';
import { TenantAwareEntity } from './tenant-aware.entity';
import { CatalogPackageEntity } from './catalog-package.entity';

@Entity({ name: 'providers' })
export class ProviderEntity extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  country!: string;

  @Column({ type: 'varchar', array: true, default: () => 'ARRAY[]::varchar[]' })
  specialties!: string[];

  @Column({ type: 'jsonb', default: {} })
  accreditations!: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @OneToMany(() => CatalogPackageEntity, (pkg) => pkg.provider)
  packages!: CatalogPackageEntity[];
}

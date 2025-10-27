import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantAwareEntity } from './tenant-aware.entity';
import { ProviderEntity } from './provider.entity';

@Entity({ name: 'catalog_packages' })
export class CatalogPackageEntity extends TenantAwareEntity {
  @ManyToOne(() => ProviderEntity, (provider) => provider.packages, {
    eager: true,
  })
  @JoinColumn({ name: 'provider_id' })
  provider!: ProviderEntity;

  @Column({ name: 'provider_id' })
  providerId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index({ unique: true })
  slug!: string;

  @Column({ type: 'varchar', array: true, default: () => 'ARRAY[]::varchar[]' })
  treatmentTypes!: string[];

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  basePrice!: number;

  @Column({ type: 'jsonb', default: {} })
  inclusions!: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  exclusions!: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;
}

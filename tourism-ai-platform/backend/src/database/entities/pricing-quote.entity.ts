import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { TenantAwareEntity } from './tenant-aware.entity';
import { CaseEntity } from './case.entity';

@Entity({ name: 'pricing_quotes' })
export class PricingQuoteEntity extends TenantAwareEntity {
  @OneToOne(() => CaseEntity, (medicalCase) => medicalCase.pricingQuote, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'case_id' })
  case!: CaseEntity;

  @Column({ name: 'case_id' })
  caseId!: string;

  @Column({ type: 'varchar', length: 8 })
  currency!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  totalAmount!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  travelAmount?: number | null;

  @Column({ type: 'jsonb', default: {} })
  breakdown!: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  disclaimer?: string | null;
}

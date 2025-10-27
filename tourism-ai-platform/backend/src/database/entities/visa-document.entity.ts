import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantAwareEntity } from './tenant-aware.entity';
import { CaseEntity } from './case.entity';

@Entity({ name: 'visa_documents' })
export class VisaDocumentEntity extends TenantAwareEntity {
  @ManyToOne(() => CaseEntity, (medicalCase) => medicalCase.visaDocuments, {
    eager: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'case_id' })
  case!: CaseEntity;

  @Column({ name: 'case_id' })
  @Index()
  caseId!: string;

  @Column({ type: 'varchar', length: 64 })
  documentType!: string;

  @Column({ type: 'varchar', length: 512 })
  storageKey!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  presignedUrl?: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  isVerified!: boolean;
}

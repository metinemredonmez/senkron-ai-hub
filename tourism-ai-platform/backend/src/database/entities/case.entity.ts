import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { TenantAwareEntity } from './tenant-aware.entity';
import { PatientEntity } from './patient.entity';
import { UserEntity } from './user.entity';
import { PricingQuoteEntity } from './pricing-quote.entity';
import { TravelPlanEntity } from './travel-plan.entity';
import { VisaDocumentEntity } from './visa-document.entity';
import { ApprovalTaskEntity } from './approval-task.entity';

@Entity({ name: 'cases' })
export class CaseEntity extends TenantAwareEntity {
  @ManyToOne(() => PatientEntity, (patient) => patient.cases, { eager: true })
  @JoinColumn({ name: 'patient_id' })
  patient!: PatientEntity;

  @Column({ name: 'patient_id' })
  @Index()
  patientId!: string;

  @ManyToOne(() => UserEntity, (user) => user.cases, { eager: false })
  @JoinColumn({ name: 'created_by' })
  createdBy!: UserEntity;

  @Column({ name: 'created_by' })
  createdById!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 64, default: 'intake' })
  stage!: string;

  @Column({ type: 'varchar', length: 64, default: 'pending' })
  eligibilityStatus!: string;

  @Column({ type: 'text', nullable: true })
  clinicalSummary?: string | null;

  @Column({ type: 'text', nullable: true })
  disclaimer?: string | null;

  @Column({ type: 'jsonb', default: {} })
  orchestratorState!: Record<string, any>;

  @Column({ type: 'varchar', length: 64, nullable: true })
  currentNode?: string | null;

  @Column({ type: 'varchar', length: 64, default: 'draft' })
  status!: string;

  @Column({ type: 'varchar', array: true, default: () => 'ARRAY[]::varchar[]' })
  redFlags!: string[];

  @OneToOne(() => PricingQuoteEntity, (quote) => quote.case, {
    eager: true,
    cascade: true,
  })
  pricingQuote?: PricingQuoteEntity;

  @OneToOne(() => TravelPlanEntity, (plan) => plan.case, {
    eager: true,
    cascade: true,
  })
  travelPlan?: TravelPlanEntity;

  @OneToMany(() => VisaDocumentEntity, (doc) => doc.case, { cascade: true })
  visaDocuments!: VisaDocumentEntity[];

  @OneToMany(() => ApprovalTaskEntity, (task) => task.case, { cascade: true })
  approvalTasks!: ApprovalTaskEntity[];

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;
}

import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { TenantAwareEntity } from './tenant-aware.entity';
import { CaseEntity } from './case.entity';

@Entity({ name: 'travel_plans' })
export class TravelPlanEntity extends TenantAwareEntity {
  @OneToOne(() => CaseEntity, (medicalCase) => medicalCase.travelPlan, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'case_id' })
  case!: CaseEntity;

  @Column({ name: 'case_id' })
  caseId!: string;

  @Column({ type: 'jsonb', default: {} })
  flights!: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  accommodations!: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  transfers!: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  itinerary!: Record<string, any>;
}

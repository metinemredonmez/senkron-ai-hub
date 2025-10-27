import { Column, Entity, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { TenantAwareEntity } from './tenant-aware.entity';
import { createEncryptedTransformer } from '../../common/security/encryption.transformer';
import { CaseEntity } from './case.entity';
import { TenantEntity } from './tenant.entity';

@Entity({ name: 'patients' })
export class PatientEntity extends TenantAwareEntity {
  @ManyToOne(() => TenantEntity, { eager: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ type: 'varchar', length: 120 })
  firstName!: string;

  @Column({ type: 'varchar', length: 120 })
  lastName!: string;

  @Column({ type: 'varchar', length: 255, transformer: createEncryptedTransformer('patient_email') })
  @Index()
  email!: string;

  @Column({ type: 'varchar', length: 32, nullable: true, transformer: createEncryptedTransformer('patient_phone') })
  phone?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, transformer: createEncryptedTransformer('patient_passport') })
  passportNumber?: string | null;

  @Column({ type: 'date', nullable: true })
  dateOfBirth?: string | null;

  @Column({ type: 'jsonb', default: {} })
  medicalHistory!: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  travelPreferences!: Record<string, any>;

  @OneToMany(() => CaseEntity, (medicalCase) => medicalCase.patient)
  cases!: CaseEntity[];
}

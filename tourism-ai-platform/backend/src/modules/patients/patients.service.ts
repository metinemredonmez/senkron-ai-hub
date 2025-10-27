import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientEntity } from '../../database/entities/patient.entity';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { maskValue } from '../../common/security/pii.util';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(PatientEntity)
    private readonly patientsRepository: Repository<PatientEntity>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(dto: CreatePatientDto): Promise<PatientEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const patient = this.patientsRepository.create({
      tenantId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email.toLowerCase(),
      phone: dto.phone ?? null,
      passportNumber: dto.passportNumber ?? null,
      dateOfBirth: dto.dateOfBirth ?? null,
      medicalHistory: dto.medicalHistory ?? {},
      travelPreferences: dto.travelPreferences ?? {},
    });
    return this.patientsRepository.save(patient);
  }

  async update(id: string, dto: UpdatePatientDto): Promise<PatientEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const patient = await this.patientsRepository.findOne({
      where: { id, tenantId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    Object.assign(patient, dto);
    return this.patientsRepository.save(patient);
  }

  async findAll(): Promise<PatientEntity[]> {
    const tenantId = this.tenantContext.getTenantId();
    const patients = await this.patientsRepository.find({ where: { tenantId } });
    return patients.map((patient) => this.maskSensitive(patient));
  }

  async findOne(id: string): Promise<PatientEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const patient = await this.patientsRepository.findOne({
      where: { id, tenantId },
      relations: ['cases'],
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return this.maskSensitive(patient);
  }

  private maskSensitive(patient: PatientEntity): PatientEntity {
    return {
      ...patient,
      passportNumber: maskValue(patient.passportNumber),
      phone: maskValue(patient.phone),
      email: maskValue(patient.email),
    } as PatientEntity;
  }
}

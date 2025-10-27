import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseEntity } from '../../database/entities/case.entity';
import { PatientEntity } from '../../database/entities/patient.entity';
import { PricingQuoteEntity } from '../../database/entities/pricing-quote.entity';
import { TravelPlanEntity } from '../../database/entities/travel-plan.entity';
import { ApprovalTaskEntity } from '../../database/entities/approval-task.entity';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { AiBridgeService } from '../ai-bridge/ai-bridge.service';
import { NON_DIAGNOSTIC_DISCLAIMER } from '../../common/constants/app.constants';
import { EventBusService } from '../../common/services/event-bus.service';

@Injectable()
export class CasesService {
  constructor(
    @InjectRepository(CaseEntity)
    private readonly casesRepository: Repository<CaseEntity>,
    @InjectRepository(PatientEntity)
    private readonly patientsRepository: Repository<PatientEntity>,
    @InjectRepository(PricingQuoteEntity)
    private readonly pricingRepository: Repository<PricingQuoteEntity>,
    @InjectRepository(TravelPlanEntity)
    private readonly travelRepository: Repository<TravelPlanEntity>,
    @InjectRepository(ApprovalTaskEntity)
    private readonly approvalRepository: Repository<ApprovalTaskEntity>,
    private readonly tenantContext: TenantContextService,
    private readonly aiBridgeService: AiBridgeService,
    private readonly eventBus: EventBusService,
  ) {}

  async list(): Promise<CaseEntity[]> {
    const tenantId = this.tenantContext.getTenantId();
    const cases = await this.casesRepository.find({
      where: { tenantId },
      relations: ['patient', 'pricingQuote', 'travelPlan', 'approvalTasks'],
    });
    return Promise.all(cases.map((c) => this.attachCheckpoint(c)));
  }

  async findById(id: string): Promise<CaseEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const medicalCase = await this.casesRepository.findOne({
      where: { id, tenantId },
      relations: ['patient', 'pricingQuote', 'travelPlan', 'approvalTasks'],
    });
    if (!medicalCase) {
      throw new NotFoundException('Case not found');
    }
    return this.attachCheckpoint(medicalCase);
  }

  async create(dto: CreateCaseDto, actorId: string): Promise<CaseEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const patient = await this.patientsRepository.findOne({
      where: { id: dto.patientId, tenantId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found for tenant');
    }

    let caseEntity = this.casesRepository.create({
      tenantId,
      patient,
      patientId: patient.id,
      title: dto.title,
      createdById: actorId,
      stage: 'intake',
      eligibilityStatus: 'pending',
      status: 'intake',
      orchestratorState: {},
      metadata: dto.metadata ?? {},
      redFlags: [],
    });
    caseEntity = await this.casesRepository.save(caseEntity);

    const orchestration = await this.aiBridgeService.startCaseOrchestration({
      caseId: caseEntity.id,
      tenantId,
      patient: this.mapPatientPayload(patient),
      intake: {
        targetProcedure: dto.targetProcedure,
        symptoms: dto.symptoms ?? [],
        travelPreferences: dto.travelPreferences ?? {},
        budget: dto.budget,
      },
    });

    caseEntity.eligibilityStatus = orchestration.eligibility.status;
    caseEntity.clinicalSummary = orchestration.clinicalSummary;
    caseEntity.disclaimer = [
      NON_DIAGNOSTIC_DISCLAIMER,
      ...(orchestration.disclaimers ?? []),
    ].join(' ');
    caseEntity.currentNode = orchestration.currentNode;
    caseEntity.stage = orchestration.stage;
    caseEntity.status = orchestration.status;
    caseEntity.orchestratorState = orchestration.raw;
    caseEntity.redFlags = orchestration.eligibility.redFlags;

    if (orchestration.pricing) {
      const pricing = this.pricingRepository.create({
        tenantId,
        case: caseEntity,
        caseId: caseEntity.id,
        currency: orchestration.pricing.currency,
        totalAmount: orchestration.pricing.total,
        travelAmount: orchestration.pricing.travel ?? null,
        breakdown: orchestration.pricing.breakdown,
        disclaimer: orchestration.pricing.disclaimer,
      });
      await this.pricingRepository.save(pricing);
      caseEntity.pricingQuote = pricing;
    }

    if (orchestration.travelPlan) {
      const travelPlan = this.travelRepository.create({
        tenantId,
        case: caseEntity,
        caseId: caseEntity.id,
        flights: orchestration.travelPlan.flights,
        accommodations: orchestration.travelPlan.accommodations,
        transfers: orchestration.travelPlan.transfers,
        itinerary: orchestration.travelPlan.itinerary,
      });
      await this.travelRepository.save(travelPlan);
      caseEntity.travelPlan = travelPlan;
    }

    if (orchestration.approvals?.length) {
      for (const approval of orchestration.approvals) {
        const task = this.approvalRepository.create({
          tenantId,
          case: caseEntity,
          caseId: caseEntity.id,
          type: approval.type,
          status: 'PENDING',
          payload: approval.payload,
        });
        await this.approvalRepository.save(task);
      await this.eventBus.publish('approval_required', {
        tenantId,
        caseId: caseEntity.id,
        taskId: task.id,
      });
      }
    }

    return this.attachCheckpoint(await this.casesRepository.save(caseEntity));
  }

  async resolveApproval(
    caseId: string,
    taskId: string,
    payload: { decision: 'APPROVED' | 'REJECTED'; comment?: string },
  ): Promise<CaseEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const medicalCase = await this.findById(caseId);
    const task = await this.approvalRepository.findOne({
      where: { id: taskId, caseId, tenantId },
    });
    if (!task) {
      throw new NotFoundException('Approval task not found');
    }
    task.status = payload.decision;
    task.payload = {
      ...task.payload,
      decision: payload.decision,
      comment: payload.comment,
    };
    task.resolvedAt = new Date();
    await this.approvalRepository.save(task);

    const orchestration = await this.aiBridgeService.resumeCaseWithApproval({
      caseId,
      tenantId,
      taskId,
      decision: payload.decision,
      comment: payload.comment,
    });

    medicalCase.stage = orchestration.stage;
    medicalCase.status = orchestration.status;
    medicalCase.currentNode = orchestration.currentNode;
    medicalCase.orchestratorState = orchestration.raw;
    medicalCase.eligibilityStatus = orchestration.eligibility.status;
    medicalCase.clinicalSummary = orchestration.clinicalSummary;
    medicalCase.disclaimer = [
      NON_DIAGNOSTIC_DISCLAIMER,
      ...(orchestration.disclaimers ?? []),
    ].join(' ');
    await this.casesRepository.save(medicalCase);

    return this.attachCheckpoint(await this.casesRepository.save(medicalCase));
  }

  private async attachCheckpoint(medicalCase: CaseEntity): Promise<CaseEntity> {
    const checkpoint = await this.aiBridgeService.fetchCheckpoint(
      medicalCase.tenantId,
      medicalCase.id,
    );
    if (checkpoint) {
      medicalCase.orchestratorState = {
        ...(medicalCase.orchestratorState ?? {}),
        ...checkpoint,
      };
    }
    return medicalCase;
  }

  private mapPatientPayload(patient: PatientEntity) {
    return {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patient.email,
      phone: patient.phone,
      passportNumber: patient.passportNumber,
      dateOfBirth: patient.dateOfBirth,
      medicalHistory: patient.medicalHistory,
      travelPreferences: patient.travelPreferences,
      metadata: {
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt,
      },
    };
  }
}

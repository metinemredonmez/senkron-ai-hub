import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PricingQuoteEntity } from '../../database/entities/pricing-quote.entity';
import { CaseEntity } from '../../database/entities/case.entity';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { AiBridgeService } from '../ai-bridge/ai-bridge.service';

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(PricingQuoteEntity)
    private readonly pricingRepository: Repository<PricingQuoteEntity>,
    @InjectRepository(CaseEntity)
    private readonly caseRepository: Repository<CaseEntity>,
    private readonly tenantContext: TenantContextService,
    private readonly aiBridge: AiBridgeService,
  ) {}

  async list(caseId: string): Promise<PricingQuoteEntity[]> {
    const tenantId = this.tenantContext.getTenantId();
    return this.pricingRepository.find({
      where: { caseId, tenantId },
    });
  }

  async createQuote(dto: CreateQuoteDto): Promise<PricingQuoteEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const medicalCase = await this.caseRepository.findOne({
      where: { id: dto.caseId, tenantId },
      relations: ['patient', 'pricingQuote'],
    });
    if (!medicalCase) {
      throw new NotFoundException('Case not found');
    }
    const quote = await this.aiBridge.calculatePricing({
      caseId: medicalCase.id,
      tenantId,
      adjustments: dto.adjustments ?? {},
    });

    const entity = this.pricingRepository.create({
      tenantId,
      case: medicalCase,
      caseId: medicalCase.id,
      currency: quote.currency,
      totalAmount: quote.total,
      travelAmount: quote.travel ?? null,
      breakdown: quote.breakdown,
      disclaimer: quote.disclaimer,
    });
    return this.pricingRepository.save(entity);
  }
}

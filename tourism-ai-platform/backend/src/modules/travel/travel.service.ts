import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TravelPlanEntity } from '../../database/entities/travel-plan.entity';
import { CaseEntity } from '../../database/entities/case.entity';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { AiBridgeService } from '../ai-bridge/ai-bridge.service';
import { SyncTravelDto } from './dto/sync-travel.dto';
import { AmadeusClient } from '../../common/integrations/amadeus.client';

@Injectable()
export class TravelService {
  constructor(
    @InjectRepository(TravelPlanEntity)
    private readonly travelRepository: Repository<TravelPlanEntity>,
    @InjectRepository(CaseEntity)
    private readonly caseRepository: Repository<CaseEntity>,
    private readonly tenantContext: TenantContextService,
    private readonly aiBridge: AiBridgeService,
    private readonly amadeusClient: AmadeusClient,
  ) {}

  async getPlan(caseId: string): Promise<TravelPlanEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const plan = await this.travelRepository.findOne({
      where: { caseId, tenantId },
    });
    if (!plan) {
      throw new NotFoundException('Travel plan not found');
    }
    return plan;
  }

  async sync(caseId: string, dto: SyncTravelDto): Promise<TravelPlanEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const medicalCase = await this.caseRepository.findOne({
      where: { id: caseId, tenantId },
      relations: ['patient'],
    });
    if (!medicalCase) {
      throw new NotFoundException('Case not found');
    }
    const preferences = (dto.preferences ?? {}) as Record<string, any>;
    const orchestrated = await this.aiBridge.calculateTravel({
      caseId,
      tenantId,
      preferences,
    });
    let plan = await this.travelRepository.findOne({
      where: { caseId, tenantId },
    });
    if (!plan) {
      plan = this.travelRepository.create({
        tenantId,
        case: medicalCase,
        caseId: medicalCase.id,
        flights: orchestrated.flights,
        accommodations: orchestrated.accommodations,
        transfers: orchestrated.transfers,
        itinerary: orchestrated.itinerary,
      });
    } else {
      plan.flights = orchestrated.flights;
      plan.accommodations = orchestrated.accommodations;
      plan.transfers = orchestrated.transfers;
      plan.itinerary = orchestrated.itinerary;
    }

    if (preferences.originLocationCode && preferences.destinationLocationCode) {
      try {
        const offers = await this.amadeusClient.searchFlights({
          originLocationCode: preferences.originLocationCode,
          destinationLocationCode: preferences.destinationLocationCode,
          departureDate:
            preferences.departureDate ?? new Date().toISOString().slice(0, 10),
          adults: Number(preferences.adults ?? 1),
        });
        plan.flights = {
          ...plan.flights,
          amadeusOffers: offers?.data?.slice(0, 3) ?? [],
        };
      } catch (error) {
        // Swallow Amadeus errors but log for observability
        console.error('Amadeus flight search failed', error);
      }
    }
    return this.travelRepository.save(plan);
  }

  async getItineraryIcs(caseId: string): Promise<string> {
    const plan = await this.getPlan(caseId);
    const events = Array.isArray(plan.itinerary?.events)
      ? plan.itinerary.events
      : [];
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//HealthTourism//EN',
    ];
    for (const event of events) {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${event.id ?? `${caseId}-${Math.random()}`}`);
      lines.push(`DTSTAMP:${formatDate(event.start)}`);
      lines.push(`DTSTART:${formatDate(event.start)}`);
      if (event.end) {
        lines.push(`DTEND:${formatDate(event.end)}`);
      }
      lines.push(`SUMMARY:${event.title ?? 'Travel Event'}`);
      if (event.description) {
        lines.push(`DESCRIPTION:${event.description}`);
      }
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.join('\n');
  }
}

function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .split('.')[0];
}

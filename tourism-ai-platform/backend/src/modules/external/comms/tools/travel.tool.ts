import { BadRequestException, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { TravelIntegrationService } from '../../travel/travel.service';
import { KafkaService } from '@/lib/nestjs-kafka';
import { TenantContextService } from '../../../../common/context/tenant-context.service';
import { TravelPreferencesDto } from '../../travel/dto/get-travel-suggestions.dto';

@Injectable()
export class TravelTool {
  constructor(
    private readonly travelService: TravelIntegrationService,
    private readonly kafkaService: KafkaService,
    private readonly tenantContext: TenantContextService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(TravelTool.name);
  }

  async flightSuggest(caseId: string, prefs: TravelPreferencesDto) {
    const tenantId = this.safeTenantId();
    if (!prefs.originLocationCode || !prefs.destinationLocationCode) {
      throw new BadRequestException(
        'originLocationCode and destinationLocationCode are required for travel suggestions',
      );
    }
    if (!prefs.departureDate) {
      throw new BadRequestException('departureDate is required for travel suggestions');
    }

    const suggestions = await this.travelService.getSuggestions(caseId, {
      ...prefs,
      currencyCode: prefs.currencyCode ?? 'USD',
    });

    await this.emitKafka('conversation.intent.detected', {
      tenantId,
      caseId,
      intent: 'travel.suggest',
      flights: suggestions.flights.length,
      provider: suggestions.provider,
    });

    return suggestions;
  }

  private async emitKafka(topic: string, payload: Record<string, any>) {
    try {
      await this.kafkaService.emit(topic, payload);
    } catch (error) {
      this.logger.warn(
        {
          topic,
          error: (error as Error).message,
        },
        'Failed to emit Kafka event from TravelTool',
      );
    }
  }

  private safeTenantId(): string {
    try {
      return this.tenantContext.getTenantId();
    } catch {
      return 'unknown';
    }
  }
}

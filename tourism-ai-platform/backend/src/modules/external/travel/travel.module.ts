import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { TravelPlanEntity } from '../../../database/entities/travel-plan.entity';
import { CaseEntity } from '../../../database/entities/case.entity';
import { ExternalTravelController } from './travel.controller';
import { TravelIntegrationService } from './travel.service';
import { AmadeusAdapter } from './amadeus.adapter';
import { SkyscannerAdapter } from './skyscanner.adapter';
import { KafkaModule } from '@/lib/nestjs-kafka';

@Module({
  imports: [
    HttpModule,
    KafkaModule,
    TypeOrmModule.forFeature([TravelPlanEntity, CaseEntity]),
  ],
  controllers: [ExternalTravelController],
  providers: [TravelIntegrationService, AmadeusAdapter, SkyscannerAdapter],
  exports: [TravelIntegrationService],
})
export class ExternalTravelModule {}

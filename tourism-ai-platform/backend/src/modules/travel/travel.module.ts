import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TravelController } from './travel.controller';
import { TravelService } from './travel.service';
import { TravelPlanEntity } from '../../database/entities/travel-plan.entity';
import { CaseEntity } from '../../database/entities/case.entity';
import { AiBridgeModule } from '../ai-bridge/ai-bridge.module';
import { AmadeusClient } from '../../common/integrations/amadeus.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([TravelPlanEntity, CaseEntity]),
    AiBridgeModule,
    HttpModule,
  ],
  controllers: [TravelController],
  providers: [TravelService, AmadeusClient],
  exports: [TravelService],
})
export class TravelModule {}

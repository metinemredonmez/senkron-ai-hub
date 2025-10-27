import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CasesService } from './cases.service';
import { CasesController } from './cases.controller';
import { CaseEntity } from '../../database/entities/case.entity';
import { PatientEntity } from '../../database/entities/patient.entity';
import { PricingQuoteEntity } from '../../database/entities/pricing-quote.entity';
import { TravelPlanEntity } from '../../database/entities/travel-plan.entity';
import { ApprovalTaskEntity } from '../../database/entities/approval-task.entity';
import { AiBridgeModule } from '../ai-bridge/ai-bridge.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CaseEntity,
      PatientEntity,
      PricingQuoteEntity,
      TravelPlanEntity,
      ApprovalTaskEntity,
    ]),
    AiBridgeModule,
  ],
  providers: [CasesService],
  controllers: [CasesController],
  exports: [CasesService],
})
export class CasesModule {}

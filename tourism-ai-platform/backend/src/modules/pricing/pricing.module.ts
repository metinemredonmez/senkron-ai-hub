import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { PricingQuoteEntity } from '../../database/entities/pricing-quote.entity';
import { CaseEntity } from '../../database/entities/case.entity';
import { AiBridgeModule } from '../ai-bridge/ai-bridge.module';

@Module({
  imports: [TypeOrmModule.forFeature([PricingQuoteEntity, CaseEntity]), AiBridgeModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}

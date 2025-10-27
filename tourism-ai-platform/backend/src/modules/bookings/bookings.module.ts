import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingEntity } from '../../database/entities/booking.entity';
import { CaseEntity } from '../../database/entities/case.entity';
import { PaymentClient } from '../../common/integrations/payment.client';
import { EfaturaClient } from '../../common/integrations/efatura.client';

@Module({
  imports: [TypeOrmModule.forFeature([BookingEntity, CaseEntity]), HttpModule],
  controllers: [BookingsController],
  providers: [BookingsService, PaymentClient, EfaturaClient],
  exports: [BookingsService],
})
export class BookingsModule {}

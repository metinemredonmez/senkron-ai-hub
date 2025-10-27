import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { AmadeusAdapter } from '../external/travel/amadeus.adapter';

@Module({
  imports: [ConfigModule],
  controllers: [FlightsController],
  providers: [FlightsService, AmadeusAdapter],
  exports: [FlightsService],
})
export class FlightsModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { SkyscannerAdapter } from '../external/travel/skyscanner.adapter';

@Module({
  imports: [ConfigModule],
  controllers: [HotelsController],
  providers: [HotelsService, SkyscannerAdapter],
  exports: [HotelsService],
})
export class HotelsModule {}

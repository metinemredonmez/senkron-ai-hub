import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunicationLogEntity } from '../../../database/entities/communication-log.entity';
import { CaseEntity } from '../../../database/entities/case.entity';
import { CommsController } from './comms.controller';
import { CommsService } from './comms.service';
import { WhatsAppService } from './whatsapp.service';
import { NluPipeline } from './nlu.pipeline';
import { StateStore } from './state.store';
import { AppointmentsTool } from './tools/appointments.tool';
import { DocsTool } from './tools/docs.tool';
import { PaymentsTool } from './tools/payments.tool';
import { TravelTool } from './tools/travel.tool';
import { ReminderWorker } from './reminder.worker';
import { KafkaModule } from '@/lib/nestjs-kafka';
import { Doctor365Module } from '../doctor365/doctor365.module';
import { DocsVisaModule } from '../../docs-visa/docs-visa.module';
import { ExternalTravelModule } from '../travel/travel.module';
import { AiBridgeModule } from '../../ai-bridge/ai-bridge.module';
import { PaymentClient } from '../../../common/integrations/payment.client';

@Module({
  imports: [
    ConfigModule,
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        baseURL:
          configService.get<string>('WHATSAPP_GRAPH_BASE_URL') ??
          'https://graph.facebook.com',
        timeout: 8000,
      }),
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([CommunicationLogEntity, CaseEntity]),
    KafkaModule,
    Doctor365Module,
    DocsVisaModule,
    ExternalTravelModule,
    AiBridgeModule,
  ],
  controllers: [CommsController],
  providers: [
    CommsService,
    WhatsAppService,
    NluPipeline,
    StateStore,
    AppointmentsTool,
    DocsTool,
    PaymentsTool,
    TravelTool,
    ReminderWorker,
    PaymentClient,
  ],
  exports: [CommsService],
})
export class CommsModule {}

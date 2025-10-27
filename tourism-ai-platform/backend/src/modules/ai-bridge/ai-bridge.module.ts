import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiBridgeService } from './ai-bridge.service';
import { AiBridgeController } from './ai-bridge.controller';
import { KafkaModule } from '@/lib/nestjs-kafka';

@Module({
  imports: [
    ConfigModule,
    KafkaModule,
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        baseURL: configService.get<string>('integrations.orchestrator.baseUrl'),
        timeout:
          configService.get<number>('integrations.orchestrator.timeoutMs') ??
          10000,
      }),
    }),
  ],
  providers: [AiBridgeService],
  controllers: [AiBridgeController],
  exports: [AiBridgeService],
})
export class AiBridgeModule {}

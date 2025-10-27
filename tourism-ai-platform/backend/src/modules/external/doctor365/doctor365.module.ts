import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Doctor365Service } from './doctor365.service';
import { Doctor365Controller } from './doctor365.controller';
import { Doctor365Client } from './doctor365.client';

@Module({
  imports: [
    ConfigModule,
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        baseURL: configService.get<string>('integrations.doktor365.baseUrl'),
        timeout:
          configService.get<number>('integrations.doktor365.requestTimeoutMs') ??
          8000,
      }),
    }),
  ],
  controllers: [Doctor365Controller],
  providers: [Doctor365Service, Doctor365Client],
  exports: [Doctor365Service],
})
export class Doctor365Module {}

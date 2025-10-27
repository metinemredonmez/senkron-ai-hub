import { Logger, MiddlewareConsumer, Module, NestModule, OnModuleInit, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import * as redisStore from 'cache-manager-redis-store';

const resolvedEnv = (process.env.NODE_ENV ?? 'local').toLowerCase();
const envFilePath: string[] = [];

if (['development', 'dev', 'local'].includes(resolvedEnv) && !envFilePath.includes('.env.local')) {
  envFilePath.push('.env.local');
}

if ((resolvedEnv === 'production' || resolvedEnv === 'prod') && !envFilePath.includes('.env.prod')) {
  envFilePath.push('.env.prod');
}

const explicitEnvFile = `.env.${resolvedEnv}`;
if (!envFilePath.includes(explicitEnvFile)) {
  envFilePath.push(explicitEnvFile);
}

if (!envFilePath.includes('.env.local')) {
  envFilePath.push('.env.local');
}
if (!envFilePath.includes('.env')) {
  envFilePath.push('.env');
}
if (!envFilePath.includes('.env.example')) {
  envFilePath.push('.env.example');
}
import { appConfig } from './config/app.config';
import { databaseConfig, DatabaseConfig } from './config/database.config';
import { integrationsConfig } from './config/integrations.config';
import kafkaConfig from './config/kafka.config';
import { otelConfig } from './config/otel.config';
import { TenantEntity } from './database/entities/tenant.entity';
import { UserEntity } from './database/entities/user.entity';
import { PatientEntity } from './database/entities/patient.entity';
import { CaseEntity } from './database/entities/case.entity';
import { ProviderEntity } from './database/entities/provider.entity';
import { CatalogPackageEntity } from './database/entities/catalog-package.entity';
import { PricingQuoteEntity } from './database/entities/pricing-quote.entity';
import { TravelPlanEntity } from './database/entities/travel-plan.entity';
import { BookingEntity } from './database/entities/booking.entity';
import { VisaDocumentEntity } from './database/entities/visa-document.entity';
import { CommunicationLogEntity } from './database/entities/communication-log.entity';
import { AuditLogEntity } from './database/entities/audit-log.entity';
import { ApprovalTaskEntity } from './database/entities/approval-task.entity';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RateLimitInterceptor } from './common/interceptors/rate-limit.interceptor';
import { PhiRedactionInterceptor } from './common/interceptors/phi_redaction.interceptor';
import { ContextModule } from './common/context/context.module';
import { PoliciesGuard } from './common/guards/policies.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { PatientsModule } from './modules/patients/patients.module';
import { CasesModule } from './modules/cases/cases.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { TravelModule } from './modules/travel/travel.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { DocsVisaModule } from './modules/docs-visa/docs-visa.module';
import { AiBridgeModule } from './modules/ai-bridge/ai-bridge.module';
import { FlightsModule } from './modules/flights/flights.module';
import { HotelsModule } from './modules/hotels/hotels.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { QueueModule } from './modules/queue/queue.module';
import { SearchModule } from './modules/search/search.module';
import { HealthCheckModule } from './modules/health-check/health-check.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { RedisModule } from '@/lib/nestjs-redis';
import { KafkaModule } from '@/lib/nestjs-kafka';
import { EncryptionModule } from '@/lib/nestjs-encryption';
import { OtelModule } from '@/lib/nestjs-otel';
import { AppController } from './app.controller';
import { IdempotencyMiddleware } from './common/middleware/idempotency.middleware';
import { ExternalModule } from './modules/external/external.module';
import { HubCoreModule } from './hub-core/hub.module';
import { TelemetrySyncService } from './hub-core/services/telemetry-sync.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
      ignoreEnvFile: false,
      load: [appConfig, databaseConfig, integrationsConfig, kafkaConfig, otelConfig],
      expandVariables: true,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: 'SYS:standard',
                },
              }
            : undefined,
      },
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const store = await redisStore.create({
          url: configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
        });
        return {
          store,
          ttl: 60,
        };
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 120,
      },
    ]),
    RedisModule,
    KafkaModule,
    EncryptionModule,
    OtelModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    TerminusModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const db = configService.get<DatabaseConfig>('database');
        return {
          type: 'postgres' as const,
          url: db?.url,
          host: db?.host,
          port: db?.port,
          username: db?.username,
          password: db?.password,
          database: db?.name,
          ssl: db?.ssl
            ? {
                rejectUnauthorized: false,
              }
            : false,
          synchronize: false,
          autoLoadEntities: false,
          entities: [
            TenantEntity,
            UserEntity,
            PatientEntity,
            CaseEntity,
            ProviderEntity,
            CatalogPackageEntity,
            PricingQuoteEntity,
            TravelPlanEntity,
            BookingEntity,
            VisaDocumentEntity,
            CommunicationLogEntity,
            AuditLogEntity,
            ApprovalTaskEntity,
          ],
          logging: db?.logging,
        };
      },
    }),
    TypeOrmModule.forFeature([
      AuditLogEntity,
    ]),
    AuthModule,
    UsersModule,
    TenantsModule,
    PatientsModule,
    CasesModule,
    ProvidersModule,
    CatalogModule,
    PricingModule,
    TravelModule,
    BookingsModule,
    DocsVisaModule,
    FlightsModule,
    HotelsModule,
    AiBridgeModule,
    PaymentsModule,
    QueueModule,
    SearchModule,
    ExternalModule,
    HubCoreModule,
    HealthCheckModule,
    MetricsModule,
    ContextModule,
  ],
  controllers: [AppController],
  providers: [
    PoliciesGuard,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PhiRedactionInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitInterceptor,
    },
  ],
})
export class AppModule implements NestModule, OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(
    private readonly telemetrySyncService: TelemetrySyncService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const telemetryEnabled = this.configService.get<boolean>('otel.enabled') ?? false;
    if (!telemetryEnabled) {
      this.logger.log('🔕 Telemetry disabled in local mode');
      return;
    }

    this.logger.log('📊 Telemetry enabled (Prometheus + Tempo)');
    try {
      await this.telemetrySyncService.verifyPrometheusConnection();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Telemetry initialization failed: ${message}`);
    }
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(IdempotencyMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.POST });
  }
}

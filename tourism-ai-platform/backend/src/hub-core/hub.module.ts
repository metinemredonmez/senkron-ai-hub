import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity } from '../database/entities/tenant.entity';
import { KafkaModule } from '@/lib/nestjs-kafka';
import { RedisModule } from '@/lib/nestjs-redis';
import { EncryptionModule } from '@/lib/nestjs-encryption';
import { OtelModule } from '@/lib/nestjs-otel';
import { HubController } from './hub.controller';
import { HubService } from './hub.service';
import { HubEventPublisher } from './events/hub-event.publisher';
import { HubEventSubscriber } from './events/hub-event.subscriber';
import { ContextStoreService } from './services/context-store.service';
import { MetricsService } from './services/metrics.service';
import { HubEventBusService } from './services/event-bus.service';
import { RegistrySyncService } from './services/registry-sync.service';
import { OrchestratorBridgeService } from './services/orchestrator-bridge.service';
import { TelemetrySyncService } from './services/telemetry-sync.service';
import { OrchestratorAdapter } from './adapters/orchestrator.adapter';
import { TenantRegistryAdapter } from './adapters/tenant-registry.adapter';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    KafkaModule,
    RedisModule,
    EncryptionModule,
    OtelModule,
    TypeOrmModule.forFeature([TenantEntity]),
  ],
  controllers: [HubController],
  providers: [
    HubService,
    HubEventPublisher,
    HubEventSubscriber,
    ContextStoreService,
    MetricsService,
    HubEventBusService,
    RegistrySyncService,
    OrchestratorBridgeService,
    TelemetrySyncService,
    OrchestratorAdapter,
    TenantRegistryAdapter,
  ],
  exports: [
    HubService,
    HubEventPublisher,
    RegistrySyncService,
    ContextStoreService,
    MetricsService,
    TenantRegistryAdapter,
    OrchestratorBridgeService,
    TelemetrySyncService,
  ],
})
export class HubCoreModule {}

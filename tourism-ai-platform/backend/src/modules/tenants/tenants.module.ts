import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantEntity } from '../../database/entities/tenant.entity';
import { TenantRegistryService } from './tenant-registry.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity])],
  controllers: [TenantsController],
  providers: [TenantsService, TenantRegistryService],
  exports: [TenantsService, TenantRegistryService],
})
export class TenantsModule {}

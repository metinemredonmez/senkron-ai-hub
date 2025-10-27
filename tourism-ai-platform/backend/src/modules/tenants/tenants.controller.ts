import { Body, Controller, Get, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { RateLimitInterceptor } from '../../common/interceptors/rate-limit.interceptor';
import { TenantEntity } from '../../database/entities/tenant.entity';
import { TenantRegistryService } from './tenant-registry.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';

@ApiTags('tenants')
@Controller('tenants')
@UseInterceptors(TenantContextInterceptor, LoggingInterceptor, RateLimitInterceptor)
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly tenantRegistry: TenantRegistryService,
  ) {}

  @Get('current')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Retrieve the tenant resolved from the current request context' })
  @ApiOkResponse({ type: TenantEntity })
  async current() {
    return this.tenantsService.current();
  }

  @Get()
  @ApiOperation({ summary: 'List active tenants with registry metadata' })
  @ApiOkResponse({ type: TenantEntity, isArray: true })
  async list() {
    const records = await this.tenantRegistry.listActive();
    return records.map(({ tenant, metadata }) => ({
      id: tenant.id,
      name: tenant.name,
      code: tenant.code,
      isActive: tenant.isActive,
      settings: tenant.settings,
      metadata,
    }));
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform-admin')
  @ApiOperation({ summary: 'Create a new tenant' })
  @ApiBody({ type: CreateTenantDto })
  @ApiCreatedResponse({ type: TenantEntity })
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Post('register')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform-admin')
  @ApiOperation({ summary: 'Register or update metadata for a tenant' })
  @ApiBody({ type: RegisterTenantDto })
  async register(@Body() dto: RegisterTenantDto) {
    return this.tenantRegistry.upsert(dto);
  }
}

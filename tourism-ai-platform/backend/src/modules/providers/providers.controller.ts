import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ProvidersService } from './providers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { RateLimitInterceptor } from '../../common/interceptors/rate-limit.interceptor';
import { ProviderEntity } from '../../database/entities/provider.entity';

@ApiTags('providers')
@ApiBearerAuth()
@Controller('providers')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor, LoggingInterceptor, RateLimitInterceptor)
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  @Roles('case-manager', 'tenant-admin', 'clinician')
  @ApiOperation({ summary: 'List healthcare providers' })
  @ApiOkResponse({ type: ProviderEntity, isArray: true })
  async list() {
    return this.providersService.list();
  }

  @Post()
  @Roles('tenant-admin')
  @ApiOperation({ summary: 'Create a new provider' })
  @ApiBody({ type: CreateProviderDto })
  @ApiCreatedResponse({ type: ProviderEntity })
  async create(@Body() dto: CreateProviderDto) {
    return this.providersService.create(dto);
  }

  @Put(':id')
  @Roles('tenant-admin')
  @ApiOperation({ summary: 'Update provider details' })
  @ApiParam({ name: 'id', description: 'Provider identifier', type: String })
  @ApiBody({ type: UpdateProviderDto })
  @ApiOkResponse({ type: ProviderEntity })
  async update(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.providersService.update(id, dto);
  }
}

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
import { CatalogService } from './catalog.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { RateLimitInterceptor } from '../../common/interceptors/rate-limit.interceptor';
import { CatalogPackageEntity } from '../../database/entities/catalog-package.entity';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('catalog/packages')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor, LoggingInterceptor, RateLimitInterceptor)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @Roles('case-manager', 'tenant-admin', 'clinician')
  @ApiOperation({ summary: 'List catalog packages' })
  @ApiOkResponse({ type: CatalogPackageEntity, isArray: true })
  async list() {
    return this.catalogService.list();
  }

  @Post()
  @Roles('tenant-admin')
  @ApiOperation({ summary: 'Create a catalog package' })
  @ApiBody({ type: CreatePackageDto })
  @ApiCreatedResponse({ type: CatalogPackageEntity })
  async create(@Body() dto: CreatePackageDto) {
    return this.catalogService.create(dto);
  }

  @Put(':id')
  @Roles('tenant-admin')
  @ApiOperation({ summary: 'Update catalog package' })
  @ApiParam({ name: 'id', description: 'Catalog package identifier', type: String })
  @ApiBody({ type: UpdatePackageDto })
  @ApiOkResponse({ type: CatalogPackageEntity })
  async update(@Param('id') id: string, @Body() dto: UpdatePackageDto) {
    return this.catalogService.update(id, dto);
  }
}

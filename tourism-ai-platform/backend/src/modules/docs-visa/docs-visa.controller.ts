import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { DocsVisaService } from './docs-visa.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GeneratePresignDto } from './dto/generate-presign.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { PoliciesGuard } from '../../common/guards/policies.guard';
import { Policies } from '../../common/decorators/policies.decorator';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { RateLimitInterceptor } from '../../common/interceptors/rate-limit.interceptor';
import { VisaDocumentEntity } from '../../database/entities/visa-document.entity';

@ApiTags('docs-visa')
@ApiBearerAuth()
@Controller('docs-visa')
@UseGuards(JwtAuthGuard, RolesGuard, PoliciesGuard)
@UseInterceptors(TenantContextInterceptor, LoggingInterceptor, RateLimitInterceptor)
export class DocsVisaController {
  constructor(private readonly docsVisaService: DocsVisaService) {}

  @Post('presign')
  @Roles('case-manager', 'tenant-admin')
  @ApiOperation({ summary: 'Generate presigned upload URL for visa documents' })
  @ApiBody({ type: GeneratePresignDto })
  @ApiOkResponse({ description: 'Presign payload with upload URL and headers' })
  async presign(@Body() dto: GeneratePresignDto) {
    return this.docsVisaService.generatePresigned(dto);
  }

  @Post()
  @Roles('case-manager', 'tenant-admin')
  @ApiOperation({ summary: 'Persist visa document metadata after upload' })
  @ApiBody({ type: CreateDocumentDto })
  @ApiCreatedResponse({ type: VisaDocumentEntity })
  async create(@Body() dto: CreateDocumentDto) {
    return this.docsVisaService.create(dto);
  }

  @Get('cases/:caseId')
  @Roles('case-manager', 'tenant-admin', 'clinician')
  @ApiOperation({ summary: 'List visa documents for a case' })
  @ApiParam({ name: 'caseId', description: 'Case identifier', type: String })
  @ApiOkResponse({ type: VisaDocumentEntity, isArray: true })
  async list(@Param('caseId') caseId: string) {
    return this.docsVisaService.list(caseId);
  }

  @Patch(':id/verify')
  @Roles('ops-agent', 'tenant-admin')
  @Policies((user, req) => user.tenantId === req.headers['x-tenant'])
  @ApiOperation({ summary: 'Mark a visa document as verified' })
  @ApiParam({ name: 'id', description: 'Visa document identifier', type: String })
  @ApiOkResponse({ type: VisaDocumentEntity })
  async verify(@Param('id') id: string) {
    return this.docsVisaService.markVerified(id);
  }
}

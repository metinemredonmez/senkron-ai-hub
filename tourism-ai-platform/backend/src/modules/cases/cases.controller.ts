import {
  Body,
  Controller,
  Get,
  Param,
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
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ResolveApprovalDto } from './dto/resolve-approval.dto';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { RateLimitInterceptor } from '../../common/interceptors/rate-limit.interceptor';
import { CaseEntity } from '../../database/entities/case.entity';

@ApiTags('cases')
@ApiBearerAuth()
@Controller('cases')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor, LoggingInterceptor, RateLimitInterceptor)
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  @Roles('case-manager', 'tenant-admin', 'clinician')
  @ApiOperation({ summary: 'List cases for the current tenant' })
  @ApiOkResponse({ type: CaseEntity, isArray: true })
  async list() {
    return this.casesService.list();
  }

  @Get(':id')
  @Roles('case-manager', 'tenant-admin', 'clinician')
  @ApiOperation({ summary: 'Retrieve a case by identifier' })
  @ApiParam({ name: 'id', description: 'Case identifier', type: String })
  @ApiOkResponse({ type: CaseEntity })
  async find(@Param('id') id: string) {
    return this.casesService.findById(id);
  }

  @Post()
  @Roles('case-manager', 'tenant-admin')
  @ApiOperation({ summary: 'Create a new case' })
  @ApiBody({ type: CreateCaseDto })
  @ApiCreatedResponse({ type: CaseEntity })
  async create(@Body() dto: CreateCaseDto, @CurrentUser() user: RequestUser) {
    return this.casesService.create(dto, user.id);
  }

  @Post(':caseId/approvals/:taskId')
  @Roles('ops-agent', 'tenant-admin')
  @ApiOperation({ summary: 'Resolve an approval task for a case' })
  @ApiParam({ name: 'caseId', type: String, description: 'Case identifier' })
  @ApiParam({ name: 'taskId', type: String, description: 'Approval task identifier' })
  @ApiBody({ type: ResolveApprovalDto })
  @ApiOkResponse({ description: 'Approval resolution outcome returned' })
  async resolve(
    @Param('caseId') caseId: string,
    @Param('taskId') taskId: string,
    @Body() dto: ResolveApprovalDto,
  ) {
    return this.casesService.resolveApproval(caseId, taskId, {
      decision: dto.decision,
      comment: dto.comment,
    });
  }
}

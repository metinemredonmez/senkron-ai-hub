import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AiBridgeService } from './ai-bridge.service';
import { StartCaseDto } from './dto/start-case.dto';
import { ResumeCaseDto } from './dto/resume-case.dto';
import { StateQueryDto } from './dto/state-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { RateLimitInterceptor } from '../../common/interceptors/rate-limit.interceptor';

@ApiTags('ai-bridge')
@ApiBearerAuth()
@Controller('ai-bridge')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor, LoggingInterceptor, RateLimitInterceptor)
export class AiBridgeController {
  constructor(private readonly aiBridgeService: AiBridgeService) {}

  @Post('start-case')
  @Roles('tenant-admin', 'case-manager')
  @ApiOperation({
    summary: 'Kick off orchestrator workflow for a case',
    description:
      'Bridges the case FSM to the AI Orchestrator service, persisting the latest checkpoint in Redis.',
  })
  @ApiBody({ type: StartCaseDto })
  @ApiOkResponse({ description: 'Current orchestrator state for the case' })
  async startCase(@Body() dto: StartCaseDto) {
    return this.aiBridgeService.startCaseOrchestration({
      caseId: dto.caseId,
      tenantId: dto.tenantId,
      patient: dto.patient,
      intake: dto.intake,
    });
  }

  @Post('resume-case')
  @Roles('tenant-admin', 'ops-agent')
  @ApiOperation({
    summary: 'Resume orchestrator workflow after manual approval',
  })
  @ApiBody({ type: ResumeCaseDto })
  @ApiOkResponse({ description: 'Updated orchestrator state for the case' })
  async resumeCase(@Body() dto: ResumeCaseDto) {
    return this.aiBridgeService.resumeCaseWithApproval({
      caseId: dto.caseId,
      tenantId: dto.tenantId,
      taskId: dto.taskId,
      decision: dto.decision,
      comment: dto.comment,
    });
  }

  @Get('state/:caseId')
  @Roles('tenant-admin', 'case-manager', 'clinician')
  @ApiOperation({
    summary: 'Retrieve orchestrator checkpoint for a case',
  })
  @ApiParam({ name: 'caseId', description: 'Case identifier', type: String })
  @ApiQuery({ name: 'tenantId', type: String, required: true })
  @ApiOkResponse({ description: 'Latest orchestrator checkpoint payload' })
  async getCheckpoint(
    @Param('caseId') caseId: string,
    @Query() query: StateQueryDto,
  ) {
    return (
      (await this.aiBridgeService.fetchCheckpoint(
        query.tenantId,
        caseId,
      )) ?? {}
    );
  }
}

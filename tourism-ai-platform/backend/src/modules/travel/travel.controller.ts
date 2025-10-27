import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { TravelService } from './travel.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SyncTravelDto } from './dto/sync-travel.dto';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { RateLimitInterceptor } from '../../common/interceptors/rate-limit.interceptor';
import { TravelPlanEntity } from '../../database/entities/travel-plan.entity';

@ApiTags('travel')
@ApiBearerAuth()
@Controller('travel')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor, LoggingInterceptor, RateLimitInterceptor)
export class TravelController {
  constructor(private readonly travelService: TravelService) {}

  @Get('cases/:caseId')
  @Roles('case-manager', 'tenant-admin', 'clinician')
  @ApiOperation({ summary: 'Retrieve travel plan for a case' })
  @ApiParam({ name: 'caseId', description: 'Case identifier', type: String })
  @ApiOkResponse({ type: TravelPlanEntity })
  async get(@Param('caseId') caseId: string) {
    return this.travelService.getPlan(caseId);
  }

  @Post('cases/:caseId/sync')
  @Roles('case-manager', 'tenant-admin')
  @ApiOperation({ summary: 'Sync travel plan data from orchestrator' })
  @ApiParam({ name: 'caseId', description: 'Case identifier', type: String })
  @ApiBody({ type: SyncTravelDto })
  @ApiOkResponse({ type: TravelPlanEntity })
  async sync(@Param('caseId') caseId: string, @Body() dto: SyncTravelDto) {
    return this.travelService.sync(caseId, dto);
  }

  @Get('cases/:caseId/itinerary.ics')
  @Roles('case-manager', 'tenant-admin', 'clinician')
  @Header('Content-Type', 'text/calendar')
  @ApiOperation({ summary: 'Download travel itinerary iCalendar file' })
  @ApiParam({ name: 'caseId', description: 'Case identifier', type: String })
  @ApiProduces('text/calendar')
  async ics(@Param('caseId') caseId: string, @Res() res: Response) {
    const ics = await this.travelService.getItineraryIcs(caseId);
    res.send(ics);
  }
}

import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { PricingQuoteEntity } from '../../database/entities/pricing-quote.entity';
import { TenantContextInterceptor } from '../../common/interceptors/tenant-context.interceptor';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { RateLimitInterceptor } from '../../common/interceptors/rate-limit.interceptor';

@ApiTags('pricing')
@ApiBearerAuth()
@Controller('pricing')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor, LoggingInterceptor, RateLimitInterceptor)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('cases/:caseId')
  @Roles('case-manager', 'tenant-admin', 'clinician')
  @ApiOperation({ summary: 'List pricing quotes for a case' })
  @ApiParam({ name: 'caseId', type: String, description: 'Case identifier' })
  @ApiOkResponse({ type: [PricingQuoteEntity] })
  async list(@Param('caseId') caseId: string) {
    return this.pricingService.list(caseId);
  }

  @Post('quotes')
  @Roles('case-manager', 'tenant-admin')
  @ApiOperation({ summary: 'Create a pricing quote for a case via AI orchestrator' })
  @ApiBody({ type: CreateQuoteDto })
  @ApiCreatedResponse({ type: PricingQuoteEntity })
  async create(@Body() dto: CreateQuoteDto) {
    return this.pricingService.createQuote(dto);
  }
}

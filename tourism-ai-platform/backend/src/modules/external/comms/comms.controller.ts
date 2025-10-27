import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TENANT_HEADER } from '../../../common/constants/app.constants';
import { CommsService } from './comms.service';
import { SendTemplateMessageDto } from './dto/send-template-message.dto';
import { WhatsAppService } from './whatsapp.service';
import { redactPII } from '../../../common/filters/pii-redaction.util';
import { TenantContextInterceptor } from '../../../common/interceptors/tenant-context.interceptor';
import { LoggingInterceptor } from '../../../common/interceptors/logging.interceptor';
import { RateLimitInterceptor } from '../../../common/interceptors/rate-limit.interceptor';
import { SkipRateLimit } from '../../../common/decorators/skip-rate-limit.decorator';

@ApiTags('comms')
@Controller()
@UseInterceptors(TenantContextInterceptor, LoggingInterceptor, RateLimitInterceptor)
export class CommsController {
  constructor(
    private readonly commsService: CommsService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  @Post('webhooks/whatsapp')
  @SkipRateLimit()
  @ApiOperation({
    summary: 'WhatsApp inbound webhook',
    description:
      'Receives WhatsApp Cloud API callbacks, verifies signature, performs NLU/tooling, and responds asynchronously.',
  })
  @ApiBody({ description: 'WhatsApp Cloud API payload', schema: { type: 'object' } })
  @ApiOkResponse({ description: 'Webhook accepted' })
  async handleWebhook(
    @Body() body: any,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body is required for signature verification');
    }
    const verified = this.whatsappService.verifyWebhook(signature, rawBody);
    if (!verified) {
      throw new BadRequestException('Invalid WhatsApp signature');
    }
    await this.commsService.handleWhatsappWebhook(body);
    return { ok: true };
  }

  @Post('comms/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: TENANT_HEADER,
    description: 'Tenant identifier',
    required: true,
  })
  @ApiHeader({
    name: 'x-idempotency-key',
    description: 'Idempotency key to prevent duplicate sends',
    required: true,
  })
  @ApiOperation({
    summary: 'Send a templated WhatsApp message',
    description: 'Dispatches a WhatsApp template using the configured integration. Messages are logged and idempotent.',
  })
  @ApiBody({ type: SendTemplateMessageDto })
  @ApiOkResponse({ description: 'Message enqueued to WhatsApp' })
  async sendTemplate(
    @Body() dto: SendTemplateMessageDto,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Headers(TENANT_HEADER) tenantId: string,
  ) {
    const result = await this.commsService.sendTemplateMessage(
      tenantId,
      idempotencyKey,
      {
        caseId: dto.caseId,
        to: dto.to,
        templateName: dto.templateName,
        params: dto.params ?? [],
        locale: dto.locale,
        metadata: dto.metadata ?? {},
      },
    );
    return {
      ...result,
      template: dto.templateName,
      to: redactPII(dto.to),
    };
  }

  @Get('comms/state/:caseId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: TENANT_HEADER,
    description: 'Tenant identifier',
    required: true,
  })
  @ApiOperation({ summary: 'Get conversation state snapshot' })
  @ApiOkResponse({ description: 'Conversation state returned' })
  async state(@Param('caseId') caseId: string) {
    return this.commsService.getConversationState(caseId);
  }
}

import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  InternalServerErrorException,
  NotFoundException,
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
import { StripeService } from './stripe.service';
import { IyzicoService } from './iyzico.service';
import { RedisService } from '@/lib/nestjs-redis';
import { TENANT_HEADER } from '../../../common/constants/app.constants';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PaymentCacheEntry } from './types';
import { TenantContextInterceptor } from '../../../common/interceptors/tenant-context.interceptor';
import { LoggingInterceptor } from '../../../common/interceptors/logging.interceptor';
import { RateLimitInterceptor } from '../../../common/interceptors/rate-limit.interceptor';
import { SkipRateLimit } from '../../../common/decorators/skip-rate-limit.decorator';

@ApiTags('external.payments')
@Controller()
@UseInterceptors(TenantContextInterceptor, LoggingInterceptor, RateLimitInterceptor)
export class PaymentsController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly iyzicoService: IyzicoService,
    private readonly redisService: RedisService,
  ) {}

  @Post('webhooks/payments')
  @SkipRateLimit()
  @ApiOperation({
    summary: 'Stripe & Iyzico payment webhook receiver',
    description:
      'Processes Stripe and Iyzico webhook callbacks with signature validation and idempotency protection.',
  })
  @ApiBody({
    description: 'Webhook payload emitted by Stripe or Iyzico',
    schema: {
      example: {
        event: 'payment.success',
        tenant: 'chat365',
        provider: 'stripe',
        data: { reference: 'booking-123', amount: 1999, currency: 'USD' },
      },
    },
  })
  @ApiOkResponse({ description: 'Webhook processed successfully', schema: { example: { ok: true } } })
  @ApiOkResponse({ description: 'Webhook processed successfully' })
  async handleWebhook(
    @Headers() headers: Record<string, string | string[]>,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body buffer is required for signature verification');
    }

    const normalized = this.normalizeHeaders(headers);
    if (normalized['stripe-signature']) {
      await this.stripeService.handleWebhook(normalized['stripe-signature'], rawBody);
    } else if (normalized['iyzi-signature']) {
      await this.iyzicoService.handleWebhook(normalized, rawBody);
    } else {
      throw new BadRequestException('Unable to determine payment provider from headers');
    }

    return { ok: true };
  }

  @Get('payments/sessions/:reference')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: TENANT_HEADER,
    description: 'Tenant identifier',
    required: true,
  })
  @ApiOperation({
    summary: 'Fetch cached payment session status',
  })
  @ApiOkResponse({
    description: 'Payment session status returned',
    schema: {
      example: {
        reference: 'booking-123',
        provider: 'stripe',
        status: 'pending',
        sessionId: 'cs_abc123',
        url: 'https://checkout.stripe.com/pay/cs_abc123',
        amount: 1299,
        currency: 'USD',
        updatedAt: '2024-05-01T12:00:00.000Z',
        metadata: {},
        tenantId: 'chat365',
      },
    },
  })
  async getSession(
    @Param('reference') reference: string,
    @Headers(TENANT_HEADER) tenantId?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException(`Missing required ${TENANT_HEADER} header`);
    }

    let cacheTenant = tenantId;
    let snapshotRaw = await this.redisService.get(this.cacheKey(cacheTenant, reference));
    if (!snapshotRaw) {
      const lookupTenant = await this.redisService.get(this.lookupKey(reference));
      if (lookupTenant) {
        cacheTenant = lookupTenant;
        snapshotRaw = await this.redisService.get(this.cacheKey(cacheTenant, reference));
      }
    }

    if (!snapshotRaw) {
      throw new NotFoundException('Payment session not found');
    }

    let snapshot: PaymentCacheEntry;
    try {
      snapshot = JSON.parse(snapshotRaw) as PaymentCacheEntry;
    } catch {
      throw new InternalServerErrorException('Stored payment session is corrupted');
    }

    return {
      reference,
      provider: snapshot.provider ?? 'unknown',
      status: snapshot.status ?? 'pending',
      sessionId: snapshot.sessionId,
      url: snapshot.sessionUrl,
      amount: snapshot.amount,
      currency: snapshot.currency,
      updatedAt: snapshot.updatedAt,
      metadata: snapshot.metadata ?? {},
      tenantId: cacheTenant,
    };
  }

  private normalizeHeaders(headers: Record<string, string | string[]>): Record<string, string> {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (Array.isArray(value)) {
        normalized[key.toLowerCase()] = value.join(',');
      } else if (typeof value === 'string') {
        normalized[key.toLowerCase()] = value;
      }
    }
    return normalized;
  }

  private cacheKey(tenantId: string, reference: string) {
    return this.redisService.buildTenantKey(tenantId, 'payments', 'session', reference);
  }

  private lookupKey(reference: string) {
    return this.redisService.buildTenantKey('system', 'payments', 'lookup', reference);
  }
}

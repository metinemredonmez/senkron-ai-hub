import { Injectable, ConflictException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { Redis } from 'ioredis';
import qs from 'qs';
import crypto from 'crypto';
import { SpanStatusCode } from '@opentelemetry/api';
import { RedisService } from '@/lib/nestjs-redis';
import { KafkaService } from '@/lib/nestjs-kafka';
import { paymentsTracer, integrationDurationMetric } from './metrics';
import { PinoLogger } from 'nestjs-pino';
import { PaymentCacheEntry, PaymentSuccessPayload } from './types';
import Stripe from 'stripe';
import { isTestMode } from '../../../common/utils/test-mode.util';
import { TenantContextService } from '../../../common/context/tenant-context.service';

interface StripeCheckoutPayload {
  bookingId: string;
  reference: string;
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
  productName?: string;
}

interface StripeEvent<T = any> {
  id: string;
  type: string;
  data: {
    object: T;
  };
}

interface StripeCheckoutSession {
  id: string;
  mode: string;
  client_reference_id?: string | null;
  metadata?: Record<string, string>;
  amount_total?: number | null;
  currency?: string | null;
  payment_intent?: string | null;
  payment_status?: string;
  status?: string;
}

interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

@Injectable()
export class StripeService {
  private readonly logger: PinoLogger;
  private readonly axios: AxiosInstance;
  private readonly redis: Redis;
  private readonly redisService: RedisService;
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly keyTtlSeconds = 60 * 60 * 24;
  private readonly testMode: boolean;
  private readonly stripeClient: Stripe;

  constructor(
    configService: ConfigService,
    redisService: RedisService,
    private readonly kafkaService: KafkaService,
    private readonly tenantContext: TenantContextService,
    logger: PinoLogger,
  ) {
    this.logger = logger;
    this.logger.setContext(StripeService.name);
    this.redisService = redisService;
    this.redis = redisService.getClient();
    this.testMode = isTestMode('stripe');
    const configuredKey = configService.get<string>('STRIPE_SECRET_KEY') ?? '';
    if (this.testMode) {
      this.secretKey = 'sk_test_dummy';
      this.logger.warn('Stripe in TEST MODE (no real payments)');
    } else {
      this.secretKey = configuredKey;
      if (!this.secretKey) {
        this.logger.warn('STRIPE_SECRET_KEY is not set; Stripe integration disabled');
      }
    }
    this.webhookSecret =
      configService.get<string>('STRIPE_WEBHOOK_SECRET') ??
      (this.testMode ? 'whsec_dummy' : '');

    this.stripeClient = new Stripe(this.secretKey || 'sk_test_dummy', {
      apiVersion: '2023-10-16',
    });

    const baseURL = configService.get<string>('STRIPE_API_BASE_URL') ?? 'https://api.stripe.com/v1';
    this.axios = axios.create({
      baseURL,
      timeout: 10_000,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  async createCheckoutSession(payload: StripeCheckoutPayload): Promise<CheckoutSessionResult> {
    if (!this.secretKey && !this.testMode) {
      throw new InternalServerErrorException('Stripe configuration missing');
    }

    const tenantId = this.tenantContext.getTenantId();
    const cacheKey = this.cacheKey(tenantId, payload.reference);
    const existingRaw = await this.redis.get(cacheKey);
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw) as PaymentCacheEntry;
        if (existing.sessionId && existing.sessionUrl) {
          return {
            sessionId: existing.sessionId,
            url: existing.sessionUrl,
          };
        }
        if (existing.status === 'creating') {
          throw new ConflictException('Payment session is currently being created');
        }
      } catch {
        // Ignore parse errors and continue with creation
      }
    }

    const placeholder: PaymentCacheEntry = { status: 'creating', tenantId };
    const placeholderAcquired = await this.redisService.setnx(cacheKey, JSON.stringify(placeholder), this.keyTtlSeconds);
    await this.redisService.setex(this.lookupKey(payload.reference), this.keyTtlSeconds, tenantId);
    if (!placeholderAcquired) {
      const snapshotRaw = await this.redis.get(cacheKey);
      if (snapshotRaw) {
        try {
          const snapshot = JSON.parse(snapshotRaw) as PaymentCacheEntry;
          if (snapshot.sessionId && snapshot.sessionUrl) {
            return {
              sessionId: snapshot.sessionId,
              url: snapshot.sessionUrl,
            };
          }
        } catch {
          // continue to creation below
        }
      } else {
        // Key expired between calls; proceed to create session
      }
    }

    const span = paymentsTracer.startSpan('stripe.createCheckoutSession', {
      attributes: {
        integration_call: 'stripe',
      },
    });
    const startedAt = process.hrtime.bigint();

    try {
      if (this.testMode) {
        const sessionId = `cs_test_${crypto.randomBytes(8).toString('hex')}`;
        const url = `https://checkout.stripe.test/${sessionId}`;
        const cacheEntry: PaymentCacheEntry = {
          provider: 'stripe',
          sessionId,
          sessionUrl: url,
          status: 'pending',
          updatedAt: new Date().toISOString(),
        };
        await this.redisService.set(
          cacheKey,
          JSON.stringify(cacheEntry),
          this.keyTtlSeconds,
        );
        integrationDurationMetric.observe(
          { provider: 'stripe', status: '200' },
          Number(process.hrtime.bigint() - startedAt) / 1_000_000_000,
        );
        span.setStatus({ code: SpanStatusCode.OK });
        return { sessionId, url };
      }
      payload.metadata = {
        ...(payload.metadata ?? {}),
        tenantId,
      };
      const formBody = qs.stringify({
        mode: 'payment',
        client_reference_id: payload.reference,
        success_url: payload.successUrl,
        cancel_url: payload.cancelUrl,
        'line_items[0][quantity]': 1,
        'line_items[0][price_data][currency]': payload.currency.toLowerCase(),
        'line_items[0][price_data][unit_amount]': Math.round(payload.amount * 100),
        'line_items[0][price_data][product_data][name]':
          payload.productName ?? `Booking ${payload.reference}`,
        ...(payload.customerEmail
          ? {
              customer_email: payload.customerEmail,
            }
          : {}),
        ...this.flattenMetadata({
          bookingId: payload.bookingId,
          reference: payload.reference,
          tenantId,
          ...(payload.metadata ?? {}),
        }),
      });

      const response = await this.axios.post('/checkout/sessions', formBody);
      const { id, url } = response.data as { id: string; url: string };

      const cacheEntry: PaymentCacheEntry = {
        provider: 'stripe',
        sessionId: id,
        sessionUrl: url,
        status: 'pending',
        tenantId,
        updatedAt: new Date().toISOString(),
      };
      await this.redisService.set(cacheKey, JSON.stringify(cacheEntry), this.keyTtlSeconds);

      const duration =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      integrationDurationMetric.observe(
        { provider: 'stripe', status: String(response.status) },
        duration,
      );

      span.setStatus({ code: SpanStatusCode.OK });

      return {
        sessionId: id,
        url,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status ?? 0;
      const duration =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      integrationDurationMetric.observe(
        { provider: 'stripe', status: String(status || 0) },
        duration,
      );
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: axiosError.message,
      });
      span.recordException(error);

      this.logger.error(
        {
          reference: payload.reference,
          status,
          response: axiosError.response?.data,
        },
        'Failed to create Stripe checkout session',
      );

      await this.redisService.del(cacheKey);
      throw new InternalServerErrorException('Stripe checkout session failed');
    } finally {
      span.end();
    }
  }

  async handleWebhook(signature: string | undefined, rawBody: Buffer): Promise<void> {
    if (this.testMode) {
      const event = this.parseTestEvent(rawBody);
      if (event.type === 'checkout.session.completed') {
        await this.handleCheckoutCompleted(event as StripeEvent<StripeCheckoutSession>);
      } else {
        this.logger.debug({ type: event.type }, 'Test Stripe webhook ignored');
      }
      return;
    }

    if (!this.webhookSecret) {
      throw new InternalServerErrorException('Stripe webhook secret is not configured');
    }
    if (!signature) {
      throw new UnauthorizedException('Missing Stripe-Signature header');
    }

    const event = this.verifySignature(signature, rawBody);
    if (!event) {
      throw new UnauthorizedException('Invalid Stripe signature');
    }

    if (event.type === 'checkout.session.completed') {
      await this.handleCheckoutCompleted(event as StripeEvent<StripeCheckoutSession>);
    } else {
      this.logger.debug({ type: event.type }, 'Ignoring unsupported Stripe webhook');
    }
  }

  private async handleCheckoutCompleted(event: StripeEvent<StripeCheckoutSession>) {
    const session = event.data.object;
    const reference =
      session.client_reference_id ??
      session.metadata?.reference ??
      session.metadata?.bookingId ??
      session.id;

    let tenantId =
      session.metadata?.tenantId ??
      session.metadata?.tenant_id ??
      session.metadata?.tenant ??
      session.metadata?.TENANT_ID ??
      undefined;

    if (!tenantId) {
      tenantId = await this.redis.get(this.lookupKey(reference)) ?? 'system';
    }

    tenantId = tenantId.toString();

    const cacheKey = this.cacheKey(tenantId, reference);
    const existingRaw = await this.redis.get(cacheKey);
    let cached: PaymentCacheEntry | undefined;
    if (existingRaw) {
      try {
        cached = JSON.parse(existingRaw) as PaymentCacheEntry;
        if (cached.lastEventId === event.id || cached.status === 'succeeded') {
          this.logger.debug(
            { reference, eventId: event.id },
            'Skipping duplicate Stripe webhook',
          );
          return;
        }
      } catch {
        // proceed and overwrite corrupt cache
      }
    }

    const amountInMajor =
      typeof session.amount_total === 'number'
        ? session.amount_total / 100
        : undefined;

    const payload: PaymentSuccessPayload = {
      bookingId: session.metadata?.bookingId ?? reference,
      reference,
      amount: amountInMajor ?? 0,
      currency: (session.currency ?? 'usd').toUpperCase(),
      txnId: session.payment_intent ?? session.id,
      tenantId,
    };

    try {
      await this.kafkaService.emit(
        this.kafkaService.formatTenantTopic(tenantId, 'payments.events'),
        { ...payload, tenantId },
      );
    } catch (error) {
      this.logger.warn(
        {
          reference,
          eventId: event.id,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to publish payment.succeeded Kafka event',
      );
    }

    const cacheEntry: PaymentCacheEntry = {
      provider: 'stripe',
      sessionId: session.id,
      sessionUrl: cached?.sessionUrl,
      status: 'succeeded',
      lastEventId: event.id,
      amount: payload.amount,
      currency: payload.currency,
      transactionId: payload.txnId,
      updatedAt: new Date().toISOString(),
      tenantId,
    };
    await this.redisService.set(cacheKey, JSON.stringify(cacheEntry), this.keyTtlSeconds);
    await this.redisService.setex(this.lookupKey(reference), this.keyTtlSeconds, tenantId);
  }

  private verifySignature(signature: string, rawBody: Buffer): StripeEvent | null {
    if (this.testMode) {
      return this.parseTestEvent(rawBody);
    }
    const timestampAndSignatures = signature.split(',');
    let timestamp: string | null = null;
    const signatures: string[] = [];
    for (const item of timestampAndSignatures) {
      const [key, value] = item.split('=');
      if (key === 't') {
        timestamp = value;
      } else if (key === 'v1') {
        signatures.push(value);
      }
    }

    if (!timestamp || !signatures.length) {
      return null;
    }

    const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    const signatureValid = signatures.some((sig) =>
      this.safeCompare(sig, expectedSignature),
    );

    if (!signatureValid) {
      this.logger.warn('Stripe webhook signature mismatch');
      return null;
    }

    try {
      return JSON.parse(rawBody.toString('utf8')) as StripeEvent;
    } catch (error) {
      this.logger.error({ error }, 'Failed to parse Stripe webhook payload');
      return null;
    }
  }

  private flattenMetadata(metadata: Record<string, string>) {
    const flattened: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      flattened[`metadata[${key}]`] = value;
    }
    return flattened;
  }

  private cacheKey(tenantId: string, reference: string) {
    return this.redisService.buildTenantKey(tenantId, 'payments', 'session', reference);
  }

  private lookupKey(reference: string) {
    return this.redisService.buildTenantKey('system', 'payments', 'lookup', reference);
  }

  private safeCompare(a: string, b: string): boolean {
    const buffA = Buffer.from(a);
    const buffB = Buffer.from(b);
    if (buffA.length !== buffB.length) {
      return false;
    }
    return crypto.timingSafeEqual(buffA, buffB);
  }

  private parseTestEvent(rawBody: Buffer): StripeEvent<StripeCheckoutSession> {
    try {
      return JSON.parse(rawBody.toString('utf8')) as StripeEvent<StripeCheckoutSession>;
    } catch {
      const reference = `test-${crypto.randomUUID()}`;
      return {
        id: `evt_test_${crypto.randomBytes(6).toString('hex')}`,
        type: 'checkout.session.completed',
        data: {
          object: {
            id: `cs_test_${crypto.randomBytes(8).toString('hex')}`,
            mode: 'payment',
            client_reference_id: reference,
            metadata: {
              reference,
              bookingId: reference,
            },
            amount_total: 0,
            currency: 'usd',
            payment_intent: `pi_test_${crypto.randomBytes(8).toString('hex')}`,
            payment_status: 'paid',
            status: 'complete',
          },
        },
      };
    }
  }
}

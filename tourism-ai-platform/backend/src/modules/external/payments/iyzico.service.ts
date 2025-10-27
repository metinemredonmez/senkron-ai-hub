import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import crypto from 'crypto';
import { Redis } from 'ioredis';
import { SpanStatusCode } from '@opentelemetry/api';
import { PinoLogger } from 'nestjs-pino';
import { RedisService } from '@/lib/nestjs-redis';
import { KafkaService } from '@/lib/nestjs-kafka';
import { integrationDurationMetric, paymentsTracer } from './metrics';
import { PaymentCacheEntry, PaymentSuccessPayload } from './types';
import { isTestMode } from '../../../common/utils/test-mode.util';
import { TenantContextService } from '../../../common/context/tenant-context.service';

interface IyzicoCheckoutPayload {
  bookingId: string;
  reference: string;
  amount: number;
  currency: string;
  callbackUrl: string;
  customerEmail?: string;
  customerName?: string;
  customerSurname?: string;
  metadata?: Record<string, string>;
}

interface IyzicoCheckoutResponse {
  status: string;
  errorCode?: string;
  errorMessage?: string;
  token?: string;
  checkoutFormContent?: string;
  paymentPageUrl?: string;
}

interface IyzicoWebhookPayload {
  status: string;
  paymentId?: string;
  conversationId?: string;
  token?: string;
  paidPrice?: string;
  price?: string;
  currency?: string;
  metadata?: Record<string, string>;
}

@Injectable()
export class IyzicoService {
  private readonly logger: PinoLogger;
  private readonly axios: AxiosInstance;
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly redisClient: Redis;
  private readonly redisService: RedisService;
  private readonly keyTtlSeconds = 60 * 60 * 24;
  private readonly testMode: boolean;

  constructor(
    configService: ConfigService,
    redisService: RedisService,
    private readonly kafkaService: KafkaService,
    private readonly tenantContext: TenantContextService,
    logger: PinoLogger,
  ) {
    this.logger = logger;
    this.logger.setContext(IyzicoService.name);
    this.redisClient = redisService.getClient();
    this.redisService = redisService;
    this.testMode = isTestMode('iyzico');
    const configuredApiKey = configService.get<string>('IYZICO_API_KEY') ?? '';
    const configuredSecret = configService.get<string>('IYZICO_SECRET_KEY') ?? '';
    if (this.testMode) {
      this.apiKey = configuredApiKey || 'iyzico_test_key';
      this.secretKey = configuredSecret || 'iyzico_test_secret';
      this.logger.warn('Iyzico in TEST MODE (sandbox active)');
    } else {
      this.apiKey = configuredApiKey;
      this.secretKey = configuredSecret;
      if (!this.apiKey || !this.secretKey) {
        this.logger.warn('Iyzico credentials are not fully configured');
      }
    }

    const configuredBaseUrl =
      configService.get<string>('IYZICO_API_BASE_URL') ??
      'https://sandbox-api.iyzipay.com';
    const baseURL = this.testMode
      ? 'https://sandbox-api.iyzipay.com'
      : configuredBaseUrl;

    this.axios = axios.create({
      baseURL,
      timeout: 10_000,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-iyzi-client-version': 'tourism-app-nest/1.0.0',
      },
    });
  }

  async createHostedPaymentPage(payload: IyzicoCheckoutPayload): Promise<{ token: string; url: string }> {
    if (!this.apiKey || !this.secretKey) {
      if (this.testMode) {
        // continue with mocked response
      } else {
        throw new InternalServerErrorException('Iyzico configuration missing');
      }
    }

    const tenantId = this.tenantContext.getTenantId();
    const cacheKey = this.cacheKey(tenantId, payload.reference);
    const snapshotRaw = await this.redisClient.get(cacheKey);
    if (snapshotRaw) {
      try {
        const snapshot = JSON.parse(snapshotRaw) as PaymentCacheEntry;
        if (snapshot.sessionId && snapshot.sessionUrl) {
          return {
            token: snapshot.sessionId,
            url: snapshot.sessionUrl,
          };
        }
      } catch {
        // ignore parse errors and continue
      }
    }

    const lockEntry: PaymentCacheEntry = {
      status: 'creating',
      provider: 'iyzico',
      tenantId,
    };
    const acquired = await this.redisService.setnx(
      cacheKey,
      JSON.stringify(lockEntry),
      this.keyTtlSeconds,
    );
    await this.redisService.setex(this.lookupKey(payload.reference), this.keyTtlSeconds, tenantId);
    if (!acquired) {
      const currentRaw = await this.redisClient.get(cacheKey);
      if (currentRaw) {
        try {
          const current = JSON.parse(currentRaw) as PaymentCacheEntry;
          if (current.sessionId && current.sessionUrl) {
            return {
              token: current.sessionId,
              url: current.sessionUrl,
            };
          }
        } catch {
          // continue with creation
        }
      }
    }

    const span = paymentsTracer.startSpan('iyzico.createHostedPaymentPage', {
      attributes: {
        integration_call: 'iyzico',
      },
    });
    const startedAt = process.hrtime.bigint();

    payload.metadata = {
      ...(payload.metadata ?? {}),
      tenantId,
    };

    const bodyPayload = this.buildCheckoutPayload(payload);
    const requestBody = JSON.stringify(bodyPayload);
    const rnd = crypto.randomBytes(8).toString('hex');
    const signature = this.generateSignature(rnd, requestBody);

    try {
      if (this.testMode) {
        const token = `iyzico_test_${crypto.randomBytes(8).toString('hex')}`;
        const url = `https://sandbox.iyzipay.com/pay/${token}`;
        const cacheEntry: PaymentCacheEntry = {
          provider: 'iyzico',
          sessionId: token,
          sessionUrl: url,
          status: 'pending',
          tenantId,
          updatedAt: new Date().toISOString(),
          metadata: {
            bookingId: payload.bookingId,
            tenantId,
          },
        };
        await this.redisService.set(
          cacheKey,
          JSON.stringify(cacheEntry),
          this.keyTtlSeconds,
        );
        await this.redisService.setex(this.lookupKey(payload.reference), this.keyTtlSeconds, tenantId);
        integrationDurationMetric.observe(
          { provider: 'iyzico', status: '200' },
          Number(process.hrtime.bigint() - startedAt) / 1_000_000_000,
        );
        span.setStatus({ code: SpanStatusCode.OK });
        return { token, url };
      }

      const response = await this.axios.post<IyzicoCheckoutResponse>(
        '/checkoutform/initialize',
        requestBody,
        {
          headers: {
            Authorization: `IYZWS ${this.apiKey}:${signature}`,
            'x-iyzi-rnd': rnd,
          },
        },
      );

      const duration =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      integrationDurationMetric.observe(
        { provider: 'iyzico', status: String(response.status) },
        duration,
      );
      span.setStatus({ code: SpanStatusCode.OK });

      const data = response.data;
      if (data.status !== 'success' || !data.token) {
        this.logger.error(
          { reference: payload.reference, response: data },
          'Iyzico returned non-success status',
        );
        throw new InternalServerErrorException('Iyzico checkout creation failed');
      }

      const cacheEntry: PaymentCacheEntry = {
        provider: 'iyzico',
        sessionId: data.token,
        sessionUrl: data.paymentPageUrl ?? `https://sandbox.iyzipay.com/pay/${data.token}`,
        status: 'pending',
        tenantId,
        updatedAt: new Date().toISOString(),
        metadata: {
          bookingId: payload.bookingId,
          tenantId,
        },
      };

      await this.redisService.set(
        cacheKey,
        JSON.stringify(cacheEntry),
        this.keyTtlSeconds,
      );
      await this.redisService.setex(this.lookupKey(payload.reference), this.keyTtlSeconds, tenantId);

      return {
        token: data.token,
        url: cacheEntry.sessionUrl ?? '',
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status ?? 0;
      const duration =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      integrationDurationMetric.observe(
        { provider: 'iyzico', status: String(status || 0) },
        duration,
      );
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: axiosError.message,
      });
      span.recordException(error);
      await this.redisService.del(cacheKey);
      throw new InternalServerErrorException('Iyzico checkout creation failed');
    } finally {
      span.end();
    }
  }

  async handleWebhook(headers: Record<string, string | undefined>, rawBody: Buffer): Promise<void> {
    if (!this.apiKey || !this.secretKey) {
      if (!this.testMode) {
        throw new InternalServerErrorException('Iyzico configuration missing');
      }
    }

    let payload: IyzicoWebhookPayload;
    if (this.testMode) {
      payload = this.parseTestPayload(rawBody);
    } else {
      const signatureHeader = headers['iyzi-signature'] ?? headers['iyzi-signature'.toLowerCase()];
      const randomHeader = headers['iyzi-rnd'] ?? headers['iyzi-rnd'.toLowerCase()];
      if (!signatureHeader || !randomHeader) {
        throw new BadRequestException('Missing iyzico signature headers');
      }

      const expected = this.generateSignature(randomHeader, rawBody.toString('utf8'));
      if (!this.safeCompare(expected, signatureHeader)) {
        this.logger.warn('Iyzico webhook signature mismatch');
        throw new BadRequestException('Invalid iyzico signature');
      }

      try {
        payload = JSON.parse(rawBody.toString('utf8')) as IyzicoWebhookPayload;
      } catch (error) {
        this.logger.error({ error }, 'Failed to parse Iyzico webhook payload');
        throw new BadRequestException('Invalid webhook payload');
      }
    }

    if (payload.status?.toLowerCase() !== 'success') {
      this.logger.debug(
        { payload },
        'Ignoring Iyzico webhook with non-success status',
      );
      return;
    }

    const reference = payload.conversationId ?? payload.token;
    if (!reference) {
      throw new BadRequestException('Iyzico payload is missing reference identifiers');
    }

    let tenantId =
      payload.metadata?.tenantId ??
      payload.metadata?.tenant_id ??
      payload.metadata?.tenant ??
      undefined;

    if (!tenantId) {
      tenantId = await this.redisClient.get(this.lookupKey(reference)) ?? 'system';
    }

    tenantId = tenantId.toString();

    const cacheKey = this.cacheKey(tenantId, reference);
    const cachedRaw = await this.redisClient.get(cacheKey);
    let cached: PaymentCacheEntry | undefined;
    if (cachedRaw) {
      try {
        cached = JSON.parse(cachedRaw) as PaymentCacheEntry;
        if (cached.lastEventId === payload.paymentId || cached.status === 'succeeded') {
          this.logger.debug(
            { reference, paymentId: payload.paymentId },
            'Skipping duplicate Iyzico webhook',
          );
          return;
        }
      } catch {
        // continue and overwrite cache
      }
    }

    const amount =
      parseFloat(payload.paidPrice ?? payload.price ?? '0') || 0;
    const paymentPayload: PaymentSuccessPayload = {
      bookingId:
        cached?.metadata?.bookingId ??
        payload.metadata?.bookingId ??
        reference,
      reference,
      amount,
      currency: (payload.currency ?? 'TRY').toUpperCase(),
      txnId: payload.paymentId ?? reference,
      tenantId,
    };

    try {
      await this.kafkaService.emit(
        this.kafkaService.formatTenantTopic(tenantId, 'payments.events'),
        { ...paymentPayload, tenantId },
      );
    } catch (error) {
      this.logger.warn(
        {
          reference,
          paymentId: payload.paymentId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to publish payment.succeeded event for Iyzico',
      );
    }

    const cacheEntry: PaymentCacheEntry = {
      provider: 'iyzico',
      sessionId: cached?.sessionId ?? payload.token,
      sessionUrl: cached?.sessionUrl,
      status: 'succeeded',
      lastEventId: payload.paymentId,
      amount: paymentPayload.amount,
      currency: paymentPayload.currency,
      transactionId: paymentPayload.txnId,
      updatedAt: new Date().toISOString(),
      metadata: {
        ...(cached?.metadata ?? {}),
        ...(payload.metadata ?? {}),
      },
      tenantId,
    };

    await this.redisService.set(
      cacheKey,
      JSON.stringify(cacheEntry),
      this.keyTtlSeconds,
    );
    await this.redisService.setex(this.lookupKey(reference), this.keyTtlSeconds, tenantId);
  }

  private buildCheckoutPayload(payload: IyzicoCheckoutPayload) {
    const amount = payload.amount.toFixed(2);
    return {
      locale: 'en',
      conversationId: payload.reference,
      price: amount,
      paidPrice: amount,
      basketId: payload.reference,
      paymentGroup: 'PRODUCT',
      currency: payload.currency.toUpperCase(),
      callbackUrl: payload.callbackUrl,
      buyer: {
        id: payload.bookingId,
        name: payload.customerName ?? 'Guest',
        surname: payload.customerSurname ?? 'Customer',
        email: payload.customerEmail ?? 'guest@example.com',
        gsmNumber: '+900000000000',
        identityNumber: '11111111111',
        registrationAddress: 'Unknown',
        ip: '127.0.0.1',
        city: 'Istanbul',
        country: 'Turkey',
      },
      shippingAddress: {
        contactName: payload.customerName ?? 'Guest',
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Shipping address',
        zipCode: '34000',
      },
      billingAddress: {
        contactName: payload.customerName ?? 'Guest',
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Billing address',
        zipCode: '34000',
      },
      basketItems: [
        {
          id: payload.reference,
          name: payload.metadata?.productName ?? `Booking ${payload.reference}`,
          category1: 'Health Services',
          itemType: 'VIRTUAL',
          price: amount,
        },
      ],
    };
  }

  private generateSignature(random: string, body: string): string {
    const hashString = `${random}${this.apiKey}${random}${this.secretKey}${body}`;
    return crypto
      .createHmac('sha1', this.secretKey)
      .update(hashString, 'utf8')
      .digest('base64');
  }

  private cacheKey(tenantId: string, reference: string): string {
    return this.redisService.buildTenantKey(tenantId, 'payments', 'session', reference);
  }

  private lookupKey(reference: string): string {
    return this.redisService.buildTenantKey('system', 'payments', 'lookup', reference);
  }

  private safeCompare(expected: string, given: string): boolean {
    const a = Buffer.from(expected);
    const b = Buffer.from(given);
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  private parseTestPayload(rawBody: Buffer): IyzicoWebhookPayload {
    try {
      const parsed = JSON.parse(rawBody.toString('utf8')) as IyzicoWebhookPayload;
      return {
        status: parsed.status ?? 'success',
        paymentId: parsed.paymentId ?? `pay_test_${crypto.randomBytes(6).toString('hex')}`,
        conversationId: parsed.conversationId ?? `conv_test_${crypto.randomBytes(6).toString('hex')}`,
        token: parsed.token ?? `token_test_${crypto.randomBytes(6).toString('hex')}`,
        paidPrice: parsed.paidPrice ?? '0.00',
        price: parsed.price ?? '0.00',
        currency: parsed.currency ?? 'TRY',
        metadata: parsed.metadata ?? {},
      };
    } catch {
      return {
        status: 'success',
        paymentId: `pay_test_${crypto.randomBytes(6).toString('hex')}`,
        conversationId: `conv_test_${crypto.randomBytes(6).toString('hex')}`,
        token: `token_test_${crypto.randomBytes(6).toString('hex')}`,
        paidPrice: '0.00',
        price: '0.00',
        currency: 'TRY',
      };
    }
  }
}

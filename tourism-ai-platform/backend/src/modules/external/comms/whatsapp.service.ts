import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import crypto from 'crypto';
import { Redis } from 'ioredis';
import { PinoLogger } from 'nestjs-pino';
import { RedisService } from '@/lib/nestjs-redis';
import { integrationDurationMetric, whatsappTracer } from './metrics';
import { SpanStatusCode } from '@opentelemetry/api';
import { redactPII } from '../../../common/filters/pii-redaction.util';

const ACCESS_TOKEN_KEY = 'whatsapp:access_token';
const DEFAULT_TTL_SECONDS = 55 * 60;

type TemplateParam =
  | string
  | {
      type?: 'text' | 'currency' | 'date_time';
      value: string;
    };

interface TemplateSendResult {
  id: string;
  to: string;
  status: string;
  timestamp: string;
}

@Injectable()
export class WhatsAppService {
  private readonly phoneNumberId: string;
  private readonly appSecret: string;
  private readonly apiVersion: string;
  private readonly defaultLocale: string;
  private readonly redis: Redis;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    redisService: RedisService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(WhatsAppService.name);
    this.phoneNumberId =
      this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') ?? '';
    this.appSecret =
      this.configService.get<string>('WHATSAPP_APP_SECRET') ?? '';
    this.apiVersion =
      this.configService.get<string>('WHATSAPP_API_VERSION') ?? 'v17.0';
    this.defaultLocale =
      this.configService.get<string>('WHATSAPP_DEFAULT_LOCALE') ?? 'en_US';
    this.redis = redisService.getClient();
  }

  async sendTemplate(
    to: string,
    templateName: string,
    params: TemplateParam[],
    locale?: string,
  ): Promise<TemplateSendResult> {
    const token = await this.getAccessToken();
    if (!this.phoneNumberId) {
      throw new InternalServerErrorException(
        'WHATSAPP_PHONE_NUMBER_ID is not configured',
      );
    }

    const body = this.buildPayload(to, templateName, params, locale);
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

    const span = whatsappTracer.startSpan('whatsapp.sendTemplate', {
      attributes: {
        integration_call: 'whatsapp',
        'messaging.template': templateName,
      },
    });
    const startedAt = process.hrtime.bigint();

    try {
      const response = await firstValueFrom(
        this.httpService.post<{ messages: TemplateSendResult[] }>(url, body, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      const duration =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      integrationDurationMetric.observe(
        { provider: 'whatsapp', status: String(response.status) },
        duration,
      );
      span.setStatus({ code: SpanStatusCode.OK });

      const result = response.data?.messages?.[0];
      if (!result) {
        throw new InternalServerErrorException(
          'WhatsApp API did not return message identifier',
        );
      }
      this.logger.debug(
        {
          to,
          templateName,
          response: redactPII(result),
        },
        'WhatsApp template sent',
      );
      return result;
    } catch (error) {
      const duration =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      const status =
        (error as any)?.response?.status ?? (error as Error)?.message ?? 0;
      integrationDurationMetric.observe(
        { provider: 'whatsapp', status: String(status || 0) },
        duration,
      );
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      span.recordException(error);

      this.logger.error(
        {
          error:
            (error as any)?.response?.data ??
            (error as Error)?.message ??
            'unknown',
          templateName,
          to: redactPII(to),
        },
        'Failed to send WhatsApp template message',
      );
      throw new InternalServerErrorException(
        'Failed to deliver WhatsApp template message',
      );
    } finally {
      span.end();
    }
  }

  verifyWebhook(
    signature: string | undefined,
    rawBody: Buffer,
    appSecret?: string,
  ): boolean {
    const secret = appSecret ?? this.appSecret;
    if (!signature || !secret) {
      throw new UnauthorizedException('Missing WhatsApp signature headers');
    }
    const [scheme, value] = signature.split('=');
    if (scheme?.toLowerCase() !== 'sha256' || !value) {
      throw new UnauthorizedException('Invalid WhatsApp signature scheme');
    }
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    const isValid = crypto.timingSafeEqual(
      Buffer.from(value, 'hex'),
      Buffer.from(expected, 'hex'),
    );
    if (!isValid) {
      this.logger.warn('WhatsApp webhook signature mismatch');
    }
    return isValid;
  }

  private buildPayload(
    to: string,
    templateName: string,
    params: TemplateParam[],
    locale?: string,
  ) {
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'template' as const,
      template: {
        name: templateName,
        language: {
          code: locale ?? this.defaultLocale,
        },
        components: [
          {
            type: 'body',
            parameters: this.normalizeParameters(params),
          },
        ],
      },
    };
  }

  private normalizeParameters(params: TemplateParam[]) {
    return params.map((param) => {
      if (typeof param === 'string') {
        return {
          type: 'text',
          text: param,
        };
      }
      return {
        type: param.type ?? 'text',
        text: param.value,
      };
    });
  }

  private async getAccessToken(): Promise<string> {
    const cached = await this.redis.get(ACCESS_TOKEN_KEY);
    if (cached) {
      return cached;
    }
    const fallback = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    if (!fallback) {
      throw new InternalServerErrorException(
        'WHATSAPP_ACCESS_TOKEN is not configured',
      );
    }
    await this.redis.set(
      ACCESS_TOKEN_KEY,
      fallback,
      'EX',
      DEFAULT_TTL_SECONDS,
    );
    return fallback;
  }
}

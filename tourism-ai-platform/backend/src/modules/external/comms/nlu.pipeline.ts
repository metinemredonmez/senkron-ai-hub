import { Injectable, Optional } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AiBridgeService } from '../../ai-bridge/ai-bridge.service';
import { pipelineDurationMetric, intentCounter, pipelineTracer } from './metrics';
import { SpanStatusCode } from '@opentelemetry/api';
import { redactPII } from '../../../common/filters/pii-redaction.util';

export interface DetectedIntent {
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  locale: string;
}

interface Rule {
  intent: string;
  keywords: string[];
  minConfidence: number;
}

const RULES: Rule[] = [
  {
    intent: 'appointment.book',
    keywords: ['book appointment', 'schedule visit', 'book a visit'],
    minConfidence: 0.92,
  },
  {
    intent: 'appointment.reschedule',
    keywords: ['reschedule', 'change appointment', 'move appointment'],
    minConfidence: 0.88,
  },
  {
    intent: 'documents.missing',
    keywords: ['missing document', 'upload document', 'send report'],
    minConfidence: 0.85,
  },
  {
    intent: 'payment.link',
    keywords: ['pay', 'payment link', 'invoice'],
    minConfidence: 0.86,
  },
  {
    intent: 'payment.status',
    keywords: ['payment status', 'paid?', 'did you receive payment'],
    minConfidence: 0.8,
  },
  {
    intent: 'travel.suggest',
    keywords: ['flight option', 'travel plan', 'tickets'],
    minConfidence: 0.84,
  },
  {
    intent: 'agent.handoff',
    keywords: ['speak to agent', 'call me', 'human'],
    minConfidence: 0.7,
  },
];

@Injectable()
export class NluPipeline {
  constructor(
    private readonly logger: PinoLogger,
    @Optional()
    private readonly aiBridgeService?: AiBridgeService,
  ) {
    this.logger.setContext(NluPipeline.name);
  }

  async detectIntent(
    text: string,
    locale = 'en',
    history: Array<Record<string, any>> = [],
  ): Promise<DetectedIntent> {
    const sanitized = text?.trim() ?? '';
    const span = pipelineTracer.startSpan('conversation.nlu', {
      attributes: {
        integration_call: 'whatsapp',
        'conversation.locale': locale,
      },
    });
    const startedAt = process.hrtime.bigint();

    try {
      const ruleMatch = this.applyRules(sanitized);
      let result: DetectedIntent | null = null;

      if (ruleMatch) {
        result = {
          intent: ruleMatch.intent,
          confidence: ruleMatch.confidence,
          entities: this.extractEntities(sanitized),
          locale,
        };
      } else {
        const fallback = await this.tryFallbackModel(sanitized, locale, history);
        result = fallback ?? {
          intent: 'unknown',
          confidence: 0.35,
          entities: {},
          locale,
        };
      }

      const duration =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      pipelineDurationMetric.observe({ intent: result.intent }, duration);
      intentCounter.inc({
        intent: result.intent,
        outcome: result.confidence >= 0.6 ? 'matched' : 'low_confidence',
      });
      span.setStatus({ code: SpanStatusCode.OK });
      this.logger.debug(
        {
          text: redactPII(sanitized),
          intent: result.intent,
          confidence: result.confidence,
        },
        'NLU intent detected',
      );
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  private applyRules(text: string): { intent: string; confidence: number } | null {
    if (!text) {
      return null;
    }
    const normalized = text.toLowerCase();
    for (const rule of RULES) {
      if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
        return {
          intent: rule.intent,
          confidence: rule.minConfidence,
        };
      }
    }
    return null;
  }

  private async tryFallbackModel(
    text: string,
    locale: string,
    history: Array<Record<string, any>>,
  ): Promise<DetectedIntent | null> {
    if (!text || !this.aiBridgeService) {
      return null;
    }
    this.logger.debug(
      { text: redactPII(text), locale },
      'Fallback NLP model unavailable, returning null intent',
    );
    return null;
  }

  private extractEntities(text: string): Record<string, any> {
    const entities: Record<string, any> = {};
    const isoDateMatch = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (isoDateMatch) {
      entities.date = isoDateMatch[0];
    }
    const amountMatch = text.match(/(\d+[.,]\d{1,2})\s?(usd|eur|try)/i);
    if (amountMatch) {
      entities.amount = Number(amountMatch[1].replace(',', '.'));
      entities.currency = amountMatch[2].toUpperCase();
    }
    return entities;
  }
}

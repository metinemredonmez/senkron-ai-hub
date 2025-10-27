import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, JobsOptions, Job } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from '@/lib/nestjs-redis';
import { PinoLogger } from 'nestjs-pino';
import { StateStore } from './state.store';
import { CommsService } from './comms.service';
import crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

const REMINDER_QUEUE = 'reminder_queue';

interface ReminderJobData {
  tenantId: string;
  caseId: string;
}

@Injectable()
export class ReminderWorker implements OnModuleInit, OnModuleDestroy {
  private queue!: Queue<ReminderJobData>;
  private worker!: Worker<ReminderJobData>;

  constructor(
    private readonly redisService: RedisService,
    private readonly stateStore: StateStore,
    private readonly commsService: CommsService,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ReminderWorker.name);
  }

  async onModuleInit(): Promise<void> {
    const connection = this.redisService.getClient().duplicate();
    this.queue = new Queue<ReminderJobData>(REMINDER_QUEUE, {
      connection,
    });
    this.worker = new Worker<ReminderJobData>(
      REMINDER_QUEUE,
      async (job) => this.processJob(job),
      { connection },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        {
          jobId: job?.id,
          name: job?.name,
          error: error?.message,
        },
        'Reminder job failed',
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.worker?.close(), this.queue?.close()]);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleAppointmentReminders() {
    const caseIds = await this.stateStore.listActiveCases('*');
    for (const caseId of caseIds) {
      const state = await this.stateStore.getState<any>(caseId);
      if (!state?.nextAppointmentAt || !state?.tenantId || !state?.contact?.phone) {
        continue;
      }
      const nextAppointment = new Date(state.nextAppointmentAt).getTime();
      const hoursUntil = (nextAppointment - Date.now()) / (1000 * 60 * 60);
      if (hoursUntil < 23 || hoursUntil > 26) {
        continue;
      }
      if (state.lastAppointmentReminderAt) {
        const lastReminder = new Date(state.lastAppointmentReminderAt).getTime();
        if (Date.now() - lastReminder < 6 * 60 * 60 * 1000) {
          continue;
        }
      }
      await this.enqueueJob('APPT_REMINDER_24H', {
        tenantId: state.tenantId,
        caseId,
      });
      await this.stateStore.setState(caseId, {
        lastAppointmentReminderAt: new Date().toISOString(),
      });
    }
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduleDocumentReminders() {
    const caseIds = await this.stateStore.listActiveCases('*');
    for (const caseId of caseIds) {
      const state = await this.stateStore.getState<any>(caseId);
      if (!state?.tenantId || !state?.contact?.phone) {
        continue;
      }
      const missingDocs = Array.isArray(state.missingDocuments)
        ? state.missingDocuments
        : [];
      if (!missingDocs.length) {
        continue;
      }
      if (state.lastDocsReminderAt) {
        const lastReminder = new Date(state.lastDocsReminderAt).getTime();
        if (Date.now() - lastReminder < 48 * 60 * 60 * 1000) {
          continue;
        }
      }
      await this.enqueueJob('DOCS_MISSING_48H', {
        tenantId: state.tenantId,
        caseId,
      });
      await this.stateStore.setState(caseId, {
        lastDocsReminderAt: new Date().toISOString(),
      });
    }
  }

  private async enqueueJob(name: string, data: ReminderJobData) {
    const options: JobsOptions = {
      jobId: `${name}:${data.caseId}`,
      removeOnComplete: true,
      removeOnFail: true,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    };
    await this.queue.add(name, data, options);
  }

  private async processJob(job: Job<ReminderJobData>) {
    const state = await this.stateStore.getState<any>(job.data.caseId);
    if (!state || !state.contact?.phone) {
      this.logger.warn(
        { jobId: job.id, caseId: job.data.caseId },
        'Skipping reminder job; conversation state incomplete',
      );
      return;
    }

    const templateName = this.getTemplateName(
      job.name === 'APPT_REMINDER_24H'
        ? 'appointment.reminder'
        : 'documents.summary',
    );
    const params =
      job.name === 'APPT_REMINDER_24H'
        ? [
            this.formatTime(
              state.nextAppointmentAt,
              state.locale ?? 'en',
            ),
          ]
        : [
            (state.missingDocuments ?? []).join(', ') ||
              'No pending documents',
          ];

    const idempotencyKey = `${job.name}:${job.data.caseId}:${job.id}`;
    await this.commsService.sendTemplateMessage(job.data.tenantId, idempotencyKey, {
      caseId: job.data.caseId,
      to: state.contact.phone,
      templateName,
      params,
      locale: state.locale ?? 'en_US',
      metadata: {
        reminder: job.name,
      },
    });
  }

  private getTemplateName(slot: string): string {
    const mapping = this.configService.get<Record<string, string>>(
      'comms.templates',
    ) ?? {
      'appointment.reminder': 'appt_reminder_24h',
      'documents.summary': 'docs_missing_alert',
    };
    return mapping[slot] ?? slot;
  }

  private formatTime(timestamp: string, locale: string): string {
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(timestamp));
    } catch {
      return timestamp;
    }
  }
}

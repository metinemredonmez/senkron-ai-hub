import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DocsVisaService } from '../../../docs-visa/docs-visa.service';
import { KafkaService } from '@/lib/nestjs-kafka';
import { TenantContextService } from '../../../../common/context/tenant-context.service';

const REQUIRED_DOCUMENTS = [
  'passport_copy',
  'medical_report',
  'consent_form',
] as const;

@Injectable()
export class DocsTool {
  constructor(
    private readonly docsService: DocsVisaService,
    private readonly kafkaService: KafkaService,
    private readonly tenantContext: TenantContextService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(DocsTool.name);
  }

  async missingDocs(caseId: string) {
    const tenantId = this.safeTenantId();
    const docs = await this.docsService.list(caseId);
    const uploadedTypes = new Set(docs.map((doc) => doc.documentType));
    const missing = REQUIRED_DOCUMENTS.filter(
      (docType) => !uploadedTypes.has(docType),
    );

    await this.emitKafka('conversation.intent.detected', {
      tenantId,
      caseId,
      intent: 'documents.missing',
      missing,
    });

    return { missing };
  }

  async presignUpload(caseId: string, fileName: string, mimeType: string) {
    const tenantId = this.safeTenantId();
    const presigned = await this.docsService.generatePresigned({
      caseId,
      fileName,
      mimeType,
    });

    await this.emitKafka('conversation.intent.detected', {
      tenantId,
      caseId,
      intent: 'documents.upload',
      fileName,
    });

    return presigned;
  }

  private async emitKafka(topic: string, payload: Record<string, any>) {
    try {
      await this.kafkaService.emit(topic, payload);
    } catch (error) {
      this.logger.warn(
        {
          topic,
          error: (error as Error).message,
        },
        'Failed to emit Kafka event from DocsTool',
      );
    }
  }

  private safeTenantId(): string {
    try {
      return this.tenantContext.getTenantId();
    } catch {
      return 'unknown';
    }
  }
}

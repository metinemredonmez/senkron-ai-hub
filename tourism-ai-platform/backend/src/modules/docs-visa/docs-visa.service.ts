import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { VisaDocumentEntity } from '../../database/entities/visa-document.entity';
import { CaseEntity } from '../../database/entities/case.entity';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { GeneratePresignDto } from './dto/generate-presign.dto';
import { EventBusService } from '../../common/services/event-bus.service';
import { AuditLogService } from '../../common/services/audit-log.service';

@Injectable()
export class DocsVisaService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectRepository(VisaDocumentEntity)
    private readonly docsRepository: Repository<VisaDocumentEntity>,
    @InjectRepository(CaseEntity)
    private readonly caseRepository: Repository<CaseEntity>,
    private readonly tenantContext: TenantContextService,
    private readonly configService: ConfigService,
    private readonly eventBus: EventBusService,
    private readonly auditLog: AuditLogService,
  ) {
    const endpoint = this.configService.get<string>('integrations.s3.endpoint');
    this.bucket = this.configService.get<string>('integrations.s3.bucket') ?? 'health-tourism-docs';
    const region = this.configService.get<string>('integrations.s3.region') ?? 'us-east-1';
    const accessKeyId = this.configService.get<string>('integrations.s3.accessKeyId') ?? 'minioadmin';
    const secretAccessKey = this.configService.get<string>('integrations.s3.secretAccessKey') ?? 'minioadmin';
    this.s3 = new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async list(caseId: string): Promise<VisaDocumentEntity[]> {
    const tenantId = this.tenantContext.getTenantId();
    return this.docsRepository.find({ where: { caseId, tenantId } });
  }

  async generatePresigned(dto: GeneratePresignDto) {
    const tenantId = this.tenantContext.getTenantId();
    const key = `${tenantId}/${dto.caseId}/${dto.fileName}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.mimeType,
    });
    const url = await getSignedUrl(this.s3, command, { expiresIn: 900 });
    await this.auditLog.record({
      action: 'docs-visa.presign',
      resource: `cases/${dto.caseId}/documents`,
      details: {
        fileName: dto.fileName,
        mimeType: dto.mimeType,
      },
    });
    return {
      url,
      fields: {
        key,
      },
    };
  }

  async create(dto: CreateDocumentDto): Promise<VisaDocumentEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const medicalCase = await this.caseRepository.findOne({
      where: { id: dto.caseId, tenantId },
    });
    if (!medicalCase) {
      throw new NotFoundException('Case not found');
    }
    const document = this.docsRepository.create({
      tenantId,
      case: medicalCase,
      caseId: medicalCase.id,
      documentType: dto.documentType,
      storageKey: dto.storageKey,
      metadata: dto.metadata ?? {},
      presignedUrl: dto.presignedUrl ?? null,
      isVerified: false,
    });
    const saved = await this.docsRepository.save(document);
    await this.eventBus.publish('doc_uploaded', {
      tenantId,
      caseId: medicalCase.id,
      documentId: saved.id,
    });
    await this.auditLog.record({
      action: 'docs-visa.upload',
      resource: `cases/${medicalCase.id}/documents`,
      resourceId: saved.id,
      details: {
        documentType: dto.documentType,
      },
    });
    return saved;
  }

  async markVerified(id: string): Promise<VisaDocumentEntity> {
    const tenantId = this.tenantContext.getTenantId();
    const document = await this.docsRepository.findOne({
      where: { id, tenantId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    document.isVerified = true;
    const saved = await this.docsRepository.save(document);
    await this.auditLog.record({
      action: 'docs-visa.verify',
      resource: `cases/${saved.caseId}/documents`,
      resourceId: saved.id,
      details: {
        verified: true,
      },
    });
    return saved;
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EfaturaClient {
  constructor(private readonly configService: ConfigService) {}

  async queueInvoice(payload: {
    caseId: string;
    amount: number;
    currency: string;
  }): Promise<{ status: string }> {
    // Stub integration - real implementation would call e-Fatura SOAP/REST API
    const token = this.configService.get<string>('EFATURA_WEBHOOK_TOKEN');
    if (!token) {
      throw new Error('EFATURA token not configured');
    }
    return { status: 'queued' };
  }
}

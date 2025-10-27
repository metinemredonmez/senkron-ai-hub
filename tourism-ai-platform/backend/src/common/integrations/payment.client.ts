import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentClient {
  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async generatePaymentLink(payload: {
    amount: number;
    currency: string;
    reference: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }> {
    const baseUrl = this.configService.get<string>('PAYMENT_BASE_URL');
    const apiKey = this.configService.get<string>('PAYMENT_API_KEY');
    const response = await this.http.axiosRef.post(
      `${baseUrl}/links`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );
    return response.data;
  }
}

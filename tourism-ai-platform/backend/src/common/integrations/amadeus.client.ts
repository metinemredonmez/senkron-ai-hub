import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import NodeCache from 'node-cache';

interface FlightSearchParams {
  originLocationCode: string;
  destinationLocationCode: string;
  departureDate: string;
  adults: number;
}

@Injectable()
export class AmadeusClient {
  private readonly cache = new NodeCache({ stdTTL: 60 * 55 });

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private async getAccessToken(): Promise<string> {
    const cached = this.cache.get<string>('amadeus-token');
    if (cached) {
      return cached;
    }
    const clientId = this.configService.get<string>('AMADEUS_CLIENT_ID');
    const clientSecret = this.configService.get<string>('AMADEUS_CLIENT_SECRET');
    const baseUrl = this.configService.get<string>('AMADEUS_BASE_URL');
    const response = await this.http.axiosRef.post(
      `${baseUrl}/v1/security/oauth2/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId ?? '',
        client_secret: clientSecret ?? '',
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
    const token = response.data.access_token as string;
    this.cache.set('amadeus-token', token, response.data.expires_in ?? 3000);
    return token;
  }

  async searchFlights(params: FlightSearchParams): Promise<any> {
    const baseUrl = this.configService.get<string>('AMADEUS_BASE_URL');
    const token = await this.getAccessToken();
    const response = await this.http.axiosRef.get(
      `${baseUrl}/v2/shopping/flight-offers`,
      {
        params,
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.data;
  }
}

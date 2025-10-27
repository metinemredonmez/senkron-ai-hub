import { Injectable } from '@nestjs/common';
import { AmadeusAdapter } from '../external/travel/amadeus.adapter';
import { FlightSearchQueryDto } from './dto/flight-search.dto';

@Injectable()
export class FlightsService {
  constructor(private readonly amadeusAdapter: AmadeusAdapter) {}

  async search(dto: FlightSearchQueryDto) {
    const params: Record<string, any> = {
      originLocationCode: dto.origin.toUpperCase(),
      destinationLocationCode: dto.destination.toUpperCase(),
      departureDate: dto.departureDate,
      adults: dto.adults ?? 1,
    };

    if (dto.currency) {
      params.currencyCode = dto.currency.toUpperCase();
    }

    return this.amadeusAdapter.searchFlights(params);
  }

  async getById(offerId: string) {
    return this.amadeusAdapter.getFlightOffer(offerId);
  }
}

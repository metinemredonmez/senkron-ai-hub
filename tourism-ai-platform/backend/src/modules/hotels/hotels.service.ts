import { Injectable } from '@nestjs/common';
import { SkyscannerAdapter } from '../external/travel/skyscanner.adapter';
import { HotelSearchQueryDto } from './dto/hotel-search.dto';

@Injectable()
export class HotelsService {
  constructor(private readonly skyscannerAdapter: SkyscannerAdapter) {}

  async search(dto: HotelSearchQueryDto) {
    const params: Record<string, any> = {
      market: 'TR',
      locale: 'en-US',
      currency: 'USD',
      entity_id: dto.location,
      checkin_date: dto.checkInDate,
      checkout_date: dto.checkOutDate,
      guests: dto.guests ?? 1,
    };

    return this.skyscannerAdapter.searchHotels(params);
  }
}

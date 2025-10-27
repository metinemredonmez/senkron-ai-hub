import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsNumberString, IsOptional, IsString } from 'class-validator';

export class TravelPreferencesDto {
  @ApiPropertyOptional({ description: 'Origin airport/location code', example: 'IST' })
  @IsOptional()
  @IsString()
  originLocationCode?: string;

  @ApiPropertyOptional({ description: 'Destination airport/location code', example: 'LHR' })
  @IsOptional()
  @IsString()
  destinationLocationCode?: string;

  @ApiPropertyOptional({ description: 'Departure date (YYYY-MM-DD)', example: '2025-11-12' })
  @IsOptional()
  @IsDateString()
  departureDate?: string;

  @ApiPropertyOptional({ description: 'Return date (YYYY-MM-DD)', example: '2025-11-20' })
  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @ApiPropertyOptional({ description: 'Number of adults', example: 2 })
  @IsOptional()
  @IsNumberString()
  adults?: string;

  @ApiPropertyOptional({ description: 'Preferred currency', example: 'USD' })
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiPropertyOptional({
    description: 'Minimum hotel rating (1-5)',
    example: 4,
  })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  minHotelRating?: number;
}

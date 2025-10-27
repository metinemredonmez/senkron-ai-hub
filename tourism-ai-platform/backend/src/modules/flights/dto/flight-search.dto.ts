import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class FlightSearchQueryDto {
  @ApiProperty({
    description: 'Origin airport IATA code',
    example: 'IST',
  })
  @IsString()
  @Length(3, 3)
  origin!: string;

  @ApiProperty({
    description: 'Destination airport IATA code',
    example: 'JFK',
  })
  @IsString()
  @Length(3, 3)
  destination!: string;

  @ApiProperty({
    description: 'Departure date in ISO-8601 format (YYYY-MM-DD)',
    example: '2025-11-01',
  })
  @IsDateString()
  departureDate!: string;

  @ApiProperty({
    description: 'Number of adults travelling',
    example: 1,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  adults?: number;

  @ApiProperty({
    description: 'Preferred currency code for results',
    example: 'USD',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class CreateFlightDto {
  @ApiProperty({
    description: 'Unique flight number provided by the carrier',
    example: 'TK1234',
  })
  @IsString()
  @IsNotEmpty()
  flightNumber: string;

  @ApiProperty({ description: 'Departure airport IATA code', example: 'IST' })
  @IsString()
  @IsNotEmpty()
  origin: string;

  @ApiProperty({ description: 'Arrival airport IATA code', example: 'JFK' })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty({
    description: 'Scheduled departure date in ISO 8601 format',
    example: '2024-05-01T09:30:00.000Z',
  })
  @IsDateString()
  departureDate: string;

  @ApiProperty({
    description: 'Scheduled arrival date in ISO 8601 format',
    example: '2024-05-01T15:45:00.000Z',
  })
  @IsDateString()
  arrivalDate: string;
}

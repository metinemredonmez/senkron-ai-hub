import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PassengerDto {
  @ApiProperty({ description: 'Passenger unique identifier', example: 'PAX1' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ description: 'Passenger first name', example: 'Ada' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ description: 'Passenger last name', example: 'Lovelace' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiPropertyOptional({ description: 'Passenger email', example: 'ada@example.com' })
  @IsOptional()
  @IsString()
  email?: string;
}

export class BookItineraryDto {
  @ApiProperty({ description: 'Case identifier to associate booking with', example: 'case_123' })
  @IsString()
  @IsNotEmpty()
  caseId!: string;

  @ApiProperty({ description: 'Selected offer identifier', example: 'offer_abc' })
  @IsString()
  @IsNotEmpty()
  offerId!: string;

  @ApiProperty({ description: 'Passengers travelling', type: [PassengerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  passengers!: PassengerDto[];

  @ApiPropertyOptional({
    description: 'Additional booking details forwarded to Amadeus payload',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  details?: Record<string, any>;
}

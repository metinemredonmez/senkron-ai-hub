import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class HotelSearchQueryDto {
  @ApiProperty({
    description: 'Location or city identifier supported by Skyscanner',
    example: 'istanbul',
  })
  @IsString()
  @IsNotEmpty()
  location!: string;

  @ApiProperty({
    description: 'Check-in date in ISO-8601 format (YYYY-MM-DD)',
    example: '2025-11-05',
  })
  @IsDateString()
  checkInDate!: string;

  @ApiProperty({
    description: 'Check-out date in ISO-8601 format (YYYY-MM-DD)',
    example: '2025-11-10',
  })
  @IsDateString()
  checkOutDate!: string;

  @ApiProperty({
    description: 'Number of guests that will stay',
    example: 2,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  guests?: number;
}

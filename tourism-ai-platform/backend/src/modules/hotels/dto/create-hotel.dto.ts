import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateHotelDto {
  @ApiProperty({ description: 'Hotel display name', example: 'Grand Istanbul Hotel' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'City where the hotel is located', example: 'Istanbul' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'Hotel star rating', example: 5, minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ description: 'Optional short description of the property', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

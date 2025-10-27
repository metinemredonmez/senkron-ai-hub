import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class PaymentRequestDto {
  @ApiProperty({ description: 'Amount to be charged in the smallest currency unit', example: 150.5 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'ISO 4217 currency code', example: 'USD' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({ description: 'Identifier for the customer or case', example: 'case_12345' })
  @IsString()
  @IsNotEmpty()
  referenceId: string;

  @ApiProperty({
    description: 'Optional description that will appear in payment statements',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

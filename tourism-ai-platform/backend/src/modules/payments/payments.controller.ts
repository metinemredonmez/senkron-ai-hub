import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentRequestDto } from './dto/payment-request.dto';
import { PaymentStatusDto } from './dto/payment-status.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  @Get('status/:id')
  @ApiOperation({ summary: 'Retrieve payment status by identifier' })
  @ApiResponse({
    status: 200,
    description: 'Payment status retrieved successfully',
    type: PaymentStatusDto,
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  getStatus(@Param('id') id: string): PaymentStatusDto {
    return {
      id,
      status: 'pending',
      amount: 0,
      currency: 'USD',
      metadata: { message: 'Placeholder status response' },
    };
  }

  @Post('create')
  @ApiOperation({ summary: 'Create and initialize a new payment' })
  @ApiBody({ type: PaymentRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Payment created successfully',
    type: PaymentStatusDto,
  })
  create(@Body() dto: PaymentRequestDto): PaymentStatusDto {
    return {
      id: 'pay_mock',
      status: 'created',
      amount: dto.amount,
      currency: dto.currency,
      metadata: { referenceId: dto.referenceId, description: dto.description },
    };
  }
}

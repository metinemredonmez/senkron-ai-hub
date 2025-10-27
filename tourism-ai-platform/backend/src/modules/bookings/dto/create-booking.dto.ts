import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createBookingSchema = z.object({
  caseId: z.string().uuid(),
  status: z.string().default('PENDING').optional(),
  confirmation: z.record(z.any()).optional(),
  paymentInfo: z
    .object({
      amount: z.number().optional(),
      currency: z.string().optional(),
      generateLink: z.boolean().optional(),
      issueInvoice: z.boolean().optional(),
      successUrl: z.string().url().optional(),
      cancelUrl: z.string().url().optional(),
      status: z.string().optional(),
    })
    .optional(),
});

export class CreateBookingDto extends createZodDto(createBookingSchema) {}

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

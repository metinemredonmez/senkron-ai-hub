import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateBookingStatusSchema = z.object({
  status: z.string().min(3),
  notes: z.string().optional(),
});

export class UpdateBookingStatusDto extends createZodDto(updateBookingStatusSchema) {}

export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;

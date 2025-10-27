import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createPatientSchema = z.object({
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().min(5).max(32).optional(),
  passportNumber: z.string().min(5).max(64).optional(),
  dateOfBirth: z.string().optional(),
  medicalHistory: z.record(z.any()).optional(),
  travelPreferences: z.record(z.any()).optional(),
});

export class CreatePatientDto extends createZodDto(createPatientSchema) {}

export type CreatePatientInput = z.infer<typeof createPatientSchema>;

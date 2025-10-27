import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { createPatientSchema } from './create-patient.dto';

export const updatePatientSchema = createPatientSchema.partial();

export class UpdatePatientDto extends createZodDto(updatePatientSchema) {}

export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

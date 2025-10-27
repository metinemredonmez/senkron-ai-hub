import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const patientSchema = z
  .object({
    id: z.string().uuid(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().min(3).max(32).optional(),
    passportNumber: z.string().max(64).optional(),
    metadata: z.record(z.any()).optional(),
    medicalHistory: z.record(z.any()).optional(),
  })
  .passthrough();

const intakeSchema = z
  .object({
    targetProcedure: z.string().min(2),
    symptoms: z.array(z.string()).optional(),
    travelPreferences: z.record(z.any()).optional(),
    budget: z
      .object({
        minAmount: z.number().nonnegative().optional(),
        maxAmount: z.number().nonnegative().optional(),
        currency: z.string().length(3).optional(),
      })
      .optional(),
  })
  .passthrough();

export const startCaseSchema = z.object({
  caseId: z.string().uuid(),
  tenantId: z.string().uuid(),
  patient: patientSchema,
  intake: intakeSchema,
});

export class StartCaseDto extends createZodDto(startCaseSchema) {}

export type StartCaseInput = z.infer<typeof startCaseSchema>;

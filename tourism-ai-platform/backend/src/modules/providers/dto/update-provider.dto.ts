import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { createProviderSchema } from './create-provider.dto';

export const updateProviderSchema = createProviderSchema.partial();

export class UpdateProviderDto extends createZodDto(updateProviderSchema) {}

export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;

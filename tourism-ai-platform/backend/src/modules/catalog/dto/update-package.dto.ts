import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { createPackageSchema } from './create-package.dto';

export const updatePackageSchema = createPackageSchema.partial();

export class UpdatePackageDto extends createZodDto(updatePackageSchema) {}

export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;

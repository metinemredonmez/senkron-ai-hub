import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class SyncPatientDto {
  @ApiProperty({
    description:
      'Stable patient identifier within the Health Tourism AI Platform',
    example: '7a3d9c58-9b0c-4b49-8bd1-c0c4055062ea',
  })
  @IsUUID()
  patientId!: string;

  @ApiPropertyOptional({
    description:
      'External patient identifier at Doktor365 (omit to create a new record)',
    example: 'd365_pat_123456',
  })
  @IsOptional()
  @IsString()
  doktor365Id?: string;

  @ApiProperty({
    description: 'Given name as captured during clinical intake',
    example: 'Ayşe',
  })
  @IsString()
  @Length(1, 120)
  givenName!: string;

  @ApiProperty({
    description: 'Family name as captured during clinical intake',
    example: 'Yılmaz',
  })
  @IsString()
  @Length(1, 120)
  familyName!: string;

  @ApiPropertyOptional({
    description: 'ISO-8601 birth date',
    example: '1990-04-21',
  })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({
    description: 'Patient gender identity (free text, max 40 chars)',
    example: 'female',
  })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  gender?: string;

  @ApiPropertyOptional({
    description: 'Patient email address (will not be persisted in caches)',
    example: 'ayse@example.com',
  })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({
    description: 'E.164 formatted phone number',
    example: '+905301112233',
  })
  @IsOptional()
  @IsString()
  @Length(5, 20)
  contactPhone?: string;

  @ApiPropertyOptional({
    description:
      'Hashed identifier for compliance (e.g. SHA-256 of national identity)',
    example: 'c8f5a0ca296abf6a4ebe12e954edbe178a1e0fb7a5b0f4cfe1d9a8de2a2c6af4',
  })
  @IsOptional()
  @IsString()
  @Length(32, 128)
  identityHash?: string;

  @ApiProperty({
    description:
      'Whether explicit KVKK/GDPR consent exists to share clinical data with Doktor365',
  })
  @IsBoolean()
  consentGranted!: boolean;

  @ApiPropertyOptional({
    description: 'ISO-8601 timestamp when consent was recorded',
    example: '2024-01-05T10:24:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  consentRecordedAt?: string;

  @ApiPropertyOptional({
    description:
      'Minimal medical context to assist matching (exclude free-form PII)',
    example: 'seeking hair transplant package with 2000 grafts',
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  clinicalSummary?: string;

  @ApiPropertyOptional({
    description: 'List of known allergies recorded for the patient',
    type: [String],
    example: ['penicillin', 'nuts'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @ApiPropertyOptional({
    description: 'ABO/Rh blood type if available',
    example: 'O+',
  })
  @IsOptional()
  @IsString()
  @Length(1, 8)
  bloodType?: string;

  @ApiPropertyOptional({
    description: 'Structured laboratory results or vitals metadata',
    type: Object,
    example: { hemoglobin: { value: 13.5, unit: 'g/dL' } },
  })
  @IsOptional()
  @IsObject()
  labResults?: Record<string, any>;
}

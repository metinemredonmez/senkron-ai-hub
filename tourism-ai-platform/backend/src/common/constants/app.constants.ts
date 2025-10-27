export const TENANT_HEADER = 'x-tenant';
export const REQUEST_ID_HEADER = 'x-request-id';
export const NON_DIAGNOSTIC_DISCLAIMER =
  'This platform provides educational, non-diagnostic support only. All medical decisions must be validated by licensed clinicians at the destination provider.';
export const REDACTION_MASK = '***';

export const FEATURE_FLAGS = {
  SPEECH: 'FEATURE_SPEECH',
  VISION: 'FEATURE_VISION',
  PERSONALIZATION: 'FEATURE_PERSONALIZATION',
} as const;

export const DATA_RETENTION_DAYS = {
  PATIENT_INACTIVE: 365,
  COMMUNICATION_LOGS: 180,
  ANALYTICS: 730,
} as const;

import crypto from 'crypto';

type Primitive = string | number | boolean | null | undefined;

const EMAIL_REGEX = /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[A-Za-z]{2,})/g;
const PHONE_REGEX = /\+?\d[\d\s\-()]{7,}\d/g;
const PASSPORT_REGEX = /\b([A-Z]{1,2}\d{6,9})\b/g;
const NATIONAL_ID_REGEX = /\b\d{11}\b/g;
const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;

const MASK = '***REDACTED***';
const SENSITIVE_KEYS = new Set([
  'firstName',
  'lastName',
  'fullName',
  'patientName',
  'givenName',
  'surname',
  'email',
  'phone',
  'phoneNumber',
  'mobile',
  'passport',
  'passportNumber',
  'nationalId',
  'ssn',
  'address',
  'street',
  'city',
  'zip',
  'dateOfBirth',
  'dob',
  'cardNumber',
  'insuranceNumber',
]);

function maskEmail(match: string) {
  const hash = crypto.createHash('sha1').update(match).digest('hex').slice(0, 8);
  return `***email-${hash}***`;
}

function maskPhone(match: string) {
  const digits = match.replace(/\D/g, '');
  if (digits.length < 6) {
    return MASK;
  }
  return `***phone-${digits.slice(-4)}***`;
}

function maskPassport(match: string) {
  return `***passport-${match.slice(-2)}***`;
}

function redactPrimitive(value: Primitive): Primitive {
  if (typeof value !== 'string') {
    return value;
  }
  return value
    .replace(EMAIL_REGEX, (match) => maskEmail(match))
    .replace(PHONE_REGEX, (match) => maskPhone(match))
    .replace(PASSPORT_REGEX, (match) => maskPassport(match))
    .replace(NATIONAL_ID_REGEX, () => MASK)
    .replace(CREDIT_CARD_REGEX, () => MASK);
}

function redactArray(values: any[]): any[] {
  return values.map((item) => redactPII(item));
}

function redactObject<T extends Record<string, any>>(value: T): T {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(value)) {
    if (val === null || val === undefined) {
      result[key] = val;
      continue;
    }
    if (typeof val === 'string' && SENSITIVE_KEYS.has(key)) {
      result[key] = MASK;
      continue;
    }
    if (typeof val === 'object' && !Array.isArray(val) && SENSITIVE_KEYS.has(key)) {
      result[key] = MASK;
      continue;
    }
    result[key] = redactPII(val);
  }
  return result as T;
}

export function redactPII<T>(payload: T): T {
  if (payload === null || payload === undefined) {
    return payload;
  }
  if (Array.isArray(payload)) {
    return redactArray(payload) as any;
  }
  if (typeof payload === 'object') {
    return redactObject(payload as Record<string, any>) as T;
  }
  return redactPrimitive(payload as Primitive) as T;
}

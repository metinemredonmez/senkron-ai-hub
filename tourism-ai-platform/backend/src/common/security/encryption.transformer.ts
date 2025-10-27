import crypto from 'crypto';
import { ValueTransformer } from 'typeorm';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const secret =
    process.env.FIELD_ENCRYPTION_KEY ??
    process.env.FIELD_ENCRYPTION_KEY_BASE64 ??
    '';
  if (!secret) {
    // Fallback for local development only. NEVER use in production.
    return crypto.createHash('sha256').update('local-dev-key').digest();
  }
  if (secret.length === 43 || secret.length === 44) {
    return Buffer.from(secret, 'base64');
  }
  if (secret.length === 64) {
    return Buffer.from(secret, 'hex');
  }
  if (secret.length === 32) {
    return Buffer.from(secret);
  }
  return crypto.createHash('sha256').update(secret).digest();
}

export function createEncryptedTransformer(
  fieldName: string,
): ValueTransformer {
  return {
    to(value: string | null): string | null {
      if (value === null || value === undefined || value === '') {
        return value;
      }
      const key = getKey();
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      const encrypted = Buffer.concat([
        cipher.update(value, 'utf8'),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();
      return `${iv.toString('hex')}.${authTag.toString(
        'hex',
      )}.${encrypted.toString('hex')}`;
    },
    from(value: string | null): string | null {
      if (!value) {
        return value;
      }
      try {
        const key = getKey();
        const [ivHex, tagHex, payloadHex] = value.split('.');
        if (!ivHex || !tagHex || !payloadHex) {
          return value;
        }
        const decipher = crypto.createDecipheriv(
          ALGORITHM,
          key,
          Buffer.from(ivHex, 'hex'),
        );
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        const decrypted = Buffer.concat([
          decipher.update(Buffer.from(payloadHex, 'hex')),
          decipher.final(),
        ]);
        return decrypted.toString('utf8');
      } catch (error) {
        console.error(
          `Failed to decrypt field ${fieldName}. Returning masked value.`,
          error,
        );
        return '***';
      }
    },
  };
}

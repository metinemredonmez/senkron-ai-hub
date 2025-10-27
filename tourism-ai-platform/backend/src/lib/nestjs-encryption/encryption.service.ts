import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EncryptedPayload {
  iv: string;
  ciphertext: string;
  tag: string;
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    this.key = this.resolveKey();
    if (!this.key || this.key.length === 0) {
      throw new Error('FIELD_ENCRYPTION_KEY must be configured');
    }
  }

  encrypt(plaintext: string, aad?: string): EncryptedPayload {
    if (plaintext === undefined || plaintext === null) {
      throw new Error('Cannot encrypt undefined or null payload');
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    if (aad) {
      cipher.setAAD(Buffer.from(aad, 'utf8'));
    }
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('base64'),
      ciphertext: encrypted.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  decrypt(payload: string | EncryptedPayload, aad?: string): string {
    if (!payload) {
      return '';
    }

    const envelope = this.normalizePayload(payload);
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(envelope.iv, 'base64'),
    );
    if (aad) {
      decipher.setAAD(Buffer.from(aad, 'utf8'));
    }
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  encryptToString(plaintext: string, aad?: string): string {
    return JSON.stringify(this.encrypt(plaintext, aad));
  }

  decryptFromString(payload: string, aad?: string): string {
    return this.decrypt(payload, aad);
  }

  private normalizePayload(value: string | EncryptedPayload): EncryptedPayload {
    if (typeof value !== 'string') {
      return value;
    }

    // Handle legacy base64 encoded JSON envelope
    let json = value;
    try {
      const base64Decoded = Buffer.from(value, 'base64').toString('utf8');
      if (base64Decoded.trim().startsWith('{')) {
        json = base64Decoded;
      }
    } catch {
      // noop
    }

    try {
      const parsed = JSON.parse(json) as Partial<EncryptedPayload>;
      if (
        parsed &&
        typeof parsed.iv === 'string' &&
        typeof parsed.ciphertext === 'string' &&
        typeof parsed.tag === 'string'
      ) {
        return parsed as EncryptedPayload;
      }
    } catch (error) {
      this.logger.error('Failed to parse encrypted payload', error as any);
    }

    throw new Error('Invalid encrypted payload supplied');
  }

  private resolveKey(): Buffer {
    const secret =
      this.configService.get<string>('FIELD_ENCRYPTION_KEY') ??
      process.env.FIELD_ENCRYPTION_KEY ??
      '';

    if (!secret) {
      throw new Error('FIELD_ENCRYPTION_KEY must be configured');
    }

    if (secret.length === 64 && /^[0-9a-f]+$/i.test(secret)) {
      return Buffer.from(secret, 'hex');
    }

    if (secret.length === 44 || secret.length === 43) {
      return Buffer.from(secret, 'base64');
    }

    if (secret.length === 32) {
      return Buffer.from(secret, 'utf8');
    }

    return createHash('sha256').update(secret).digest();
  }
}

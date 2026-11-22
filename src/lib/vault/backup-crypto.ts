/**
 * Native Web Crypto client-side backup encryption & decryption using AES-256-GCM + PBKDF2.
 * Zero third-party dependencies required.
 */

export interface EncryptedBackupPayload {
  version: 2;
  encrypted: true;
  algorithm: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string; // Base64
  iv: string; // Base64
  ciphertext: string; // Base64
  exportedAt: string;
}

export interface PlainBackupPayload {
  version: 2;
  encrypted: false;
  exportedAt: string;
  tables: Record<string, any[]>;
}

export type BackupFileFormat = EncryptedBackupPayload | PlainBackupPayload;

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const ITERATIONS = 100_000;

async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts arbitrary JavaScript object data with a user passphrase.
 */
export async function encryptBackupData(
  tables: Record<string, any[]>,
  passphrase: string
): Promise<EncryptedBackupPayload> {
  if (!passphrase || passphrase.length < 4) {
    throw new Error('Passphrase must be at least 4 characters');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);

  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify({ tables }));

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as any,
    },
    key,
    plaintext
  );

  return {
    version: 2,
    encrypted: true,
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: ITERATIONS,
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(encryptedBuffer),
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Decrypts an encrypted backup file payload using user passphrase.
 */
export async function decryptBackupData(
  payload: EncryptedBackupPayload,
  passphrase: string
): Promise<{ tables: Record<string, any[]> }> {
  if (!passphrase) {
    throw new Error('Please enter the backup passphrase');
  }

  try {
    const salt = base64ToBuffer(payload.salt);
    const iv = base64ToBuffer(payload.iv);
    const ciphertext = base64ToBuffer(payload.ciphertext);

    const key = await deriveAesKey(passphrase, salt);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as any,
      },
      key,
      ciphertext as any
    );

    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(decryptedBuffer);
    const parsed = JSON.parse(jsonStr);

    if (!parsed || typeof parsed !== 'object' || !parsed.tables) {
      throw new Error('Decrypted backup does not contain valid database tables');
    }

    return parsed;
  } catch (err: any) {
    if (err.name === 'OperationError' || err.message?.includes('operation failed')) {
      throw new Error('Incorrect passphrase or corrupted backup file');
    }
    throw err;
  }
}

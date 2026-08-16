import { argon2id } from 'hash-wasm';
import type { Bootstrap } from './types';

const MAGIC = new TextEncoder().encode('BUB1');
const IV_LENGTH = 12;

export const DEFAULT_KDF: Bootstrap['kdf'] = {
  algorithm: 'argon2id',
  iterations: 3,
  memorySize: 64 * 1024,
  parallelism: 1,
  hashLength: 32
};

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function validatePassphrase(value: string): string | null {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length < 4) return 'Použijte alespoň čtyři slova.';
  if (value.trim().length < 20) return 'Fráze musí mít alespoň 20 znaků.';
  return null;
}

export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  kdf: Bootstrap['kdf'] = DEFAULT_KDF
): Promise<CryptoKey> {
  const raw = await argon2id({
    password: passphrase.normalize('NFKC'),
    salt,
    parallelism: kdf.parallelism,
    iterations: kdf.iterations,
    memorySize: kdf.memorySize,
    hashLength: kdf.hashLength,
    outputType: 'binary'
  });
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function contextBytes(context: string): Uint8Array {
  return new TextEncoder().encode(`bubackov:${context}`);
}

export async function encryptBytes(plain: Uint8Array, key: CryptoKey, context: string): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: contextBytes(context), tagLength: 128 },
    key,
    plain
  );
  const result = new Uint8Array(MAGIC.length + iv.length + cipher.byteLength);
  result.set(MAGIC, 0);
  result.set(iv, MAGIC.length);
  result.set(new Uint8Array(cipher), MAGIC.length + iv.length);
  return result;
}

export async function decryptBytes(encrypted: Uint8Array, key: CryptoKey, context: string): Promise<Uint8Array> {
  if (encrypted.byteLength < MAGIC.length + IV_LENGTH + 16) throw new Error('Poškozený šifrovaný soubor.');
  if (!MAGIC.every((byte, index) => encrypted[index] === byte)) throw new Error('Neznámý formát archivu.');
  const iv = encrypted.slice(MAGIC.length, MAGIC.length + IV_LENGTH);
  const cipher = encrypted.slice(MAGIC.length + IV_LENGTH);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: contextBytes(context), tagLength: 128 },
      key,
      cipher
    );
    return new Uint8Array(plain);
  } catch {
    throw new Error('Nesprávná přístupová fráze nebo poškozený archiv.');
  }
}

export async function encryptJson(value: unknown, key: CryptoKey, context: string): Promise<Uint8Array> {
  return encryptBytes(new TextEncoder().encode(JSON.stringify(value)), key, context);
}

export async function decryptJson<T>(encrypted: Uint8Array, key: CryptoKey, context: string): Promise<T> {
  const plain = await decryptBytes(encrypted, key, context);
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

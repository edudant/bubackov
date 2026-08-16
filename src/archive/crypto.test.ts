import { describe, expect, it } from 'vitest';
import { decryptBytes, deriveKey, encryptBytes, validatePassphrase } from './crypto';

const phrase = 'vyhradne testovaci fraze nema pristup';
const salt = new Uint8Array(16).fill(7);
const fastKdf = { algorithm: 'argon2id' as const, iterations: 1, memorySize: 1024, parallelism: 1, hashLength: 32 as const };

describe('encrypted archive', () => {
  it('round-trips authenticated bytes', async () => {
    const key = await deriveKey(phrase, salt, fastKdf);
    const plain = new TextEncoder().encode('rodinná vzpomínka');
    const encrypted = await encryptBytes(plain, key, 'test');
    expect(new TextDecoder().decode(await decryptBytes(encrypted, key, 'test'))).toBe('rodinná vzpomínka');
    expect(new TextDecoder().decode(encrypted)).not.toContain('vzpomínka');
  });

  it('rejects a wrong passphrase', async () => {
    const encrypted = await encryptBytes(new Uint8Array([1, 2, 3]), await deriveKey(phrase, salt, fastKdf), 'test');
    const wrong = await deriveKey('uplne jina rodinna pristupova fraze', salt, fastKdf);
    await expect(decryptBytes(encrypted, wrong, 'test')).rejects.toThrow('Nesprávná');
  });

  it('rejects modified ciphertext and mismatched context', async () => {
    const key = await deriveKey(phrase, salt, fastKdf);
    const encrypted = await encryptBytes(new Uint8Array([1, 2, 3]), key, 'media:one');
    encrypted[encrypted.length - 1] ^= 1;
    await expect(decryptBytes(encrypted, key, 'media:one')).rejects.toThrow();
    const intact = await encryptBytes(new Uint8Array([1]), key, 'media:one');
    await expect(decryptBytes(intact, key, 'media:two')).rejects.toThrow();
  });

  it('requires a meaningful family phrase', () => {
    expect(validatePassphrase('1234')).toMatch('čtyři');
    expect(validatePassphrase('a b c d')).toMatch('20 znaků');
    expect(validatePassphrase(phrase)).toBeNull();
  });
});

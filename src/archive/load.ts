import { base64ToBytes, decryptBytes, decryptJson, deriveKey } from './crypto';
import { archiveManifestSchema, bootstrapSchema, type ArchiveManifest, type ArchiveMedia, type Bootstrap } from './types';

const root = `${import.meta.env.BASE_URL}archive/`;

async function fetchBytes(path: string): Promise<Uint8Array> {
  const response = await fetch(`${root}${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Archiv se nepodařilo načíst. Zkontrolujte připojení.');
  return new Uint8Array(await response.arrayBuffer());
}

export async function loadBootstrap(): Promise<Bootstrap> {
  const response = await fetch(`${root}bootstrap.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Kronika zatím není publikovaná.');
  return bootstrapSchema.parse(await response.json());
}

export async function unlockArchive(passphrase: string, bootstrap: Bootstrap): Promise<{ key: CryptoKey; archive: ArchiveManifest }> {
  const key = await deriveKey(passphrase, base64ToBytes(bootstrap.salt), bootstrap.kdf);
  const encrypted = await fetchBytes(bootstrap.manifest);
  const raw = await decryptJson<unknown>(encrypted, key, bootstrap.manifestContext);
  return { key, archive: archiveManifestSchema.parse(raw) };
}

export async function unlockWithKey(key: CryptoKey, bootstrap: Bootstrap): Promise<ArchiveManifest> {
  const encrypted = await fetchBytes(bootstrap.manifest);
  const raw = await decryptJson<unknown>(encrypted, key, bootstrap.manifestContext);
  return archiveManifestSchema.parse(raw);
}

export async function loadMediaUrl(media: ArchiveMedia, key: CryptoKey, targetWidth: number): Promise<string> {
  const ordered = [...media.variants].sort((a, b) => a.width - b.width);
  const variant = ordered.find((candidate) => candidate.width >= targetWidth) ?? ordered.at(-1);
  if (!variant) throw new Error('Fotografie nemá použitelnou variantu.');
  const encrypted = await fetchBytes(variant.file);
  const plain = await decryptBytes(encrypted, key, variant.context);
  return URL.createObjectURL(new Blob([plain], { type: variant.mime }));
}

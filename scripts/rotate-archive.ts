import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { password } from '@inquirer/prompts';
import { archiveManifestSchema, bootstrapSchema } from '../src/archive/types';
import { base64ToBytes, bytesToBase64, decryptBytes, decryptJson, DEFAULT_KDF, deriveKey, encryptBytes, encryptJson, validatePassphrase } from '../src/archive/crypto';

const workspace = resolve(import.meta.dirname, '..');
const archiveRoot = join(workspace, 'public', 'archive');
const randomName = () => randomBytes(18).toString('base64url');

const oldPhrase = await password({ message: 'Dosavadní rodinná fráze:', mask: '•' });
const nextPhrase = await password({ message: 'Nová rodinná fráze:', mask: '•' });
const confirmation = await password({ message: 'Zopakujte novou frázi:', mask: '•' });
if (nextPhrase !== confirmation) throw new Error('Zadané nové fráze se neshodují.');
const invalid = validatePassphrase(nextPhrase);
if (invalid) throw new Error(invalid);

const bootstrap = bootstrapSchema.parse(JSON.parse(await readFile(join(archiveRoot, 'bootstrap.json'), 'utf8')));
const oldKey = await deriveKey(oldPhrase, base64ToBytes(bootstrap.salt), bootstrap.kdf);
const oldManifestBytes = new Uint8Array(await readFile(join(archiveRoot, bootstrap.manifest)));
const manifest = archiveManifestSchema.parse(await decryptJson<unknown>(oldManifestBytes, oldKey, bootstrap.manifestContext));

const nextSalt = randomBytes(16);
const nextKey = await deriveKey(nextPhrase, nextSalt, DEFAULT_KDF);
const staging = join(workspace, 'public', `.archive-rotation-${randomName()}`);
await mkdir(join(staging, 'files'), { recursive: true });

for (const media of manifest.media) {
  for (const variant of media.variants) {
    const encrypted = new Uint8Array(await readFile(join(archiveRoot, variant.file)));
    const plain = await decryptBytes(encrypted, oldKey, variant.context);
    variant.file = `files/${randomName()}.bin`;
    await writeFile(join(staging, variant.file), await encryptBytes(plain, nextKey, variant.context));
  }
}

const manifestFile = `${randomName()}.bin`;
await writeFile(join(staging, manifestFile), await encryptJson(manifest, nextKey, 'manifest'));
await writeFile(join(staging, 'bootstrap.json'), JSON.stringify({
  format: 'bubackov-archive-v1', salt: bytesToBase64(nextSalt), manifest: manifestFile, manifestContext: 'manifest', kdf: DEFAULT_KDF
}, null, 2));

const previous = `${archiveRoot}.previous`;
await rm(previous, { recursive: true, force: true });
await rename(archiveRoot, previous);
await rename(staging, archiveRoot);
await rm(previous, { recursive: true, force: true });
console.log('Archiv byl bez zápisu otevřených dat přešifrován novou frází. Starší commity stále vyžadují původní frázi.');

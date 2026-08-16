import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { password } from '@inquirer/prompts';
import { bytesToBase64, DEFAULT_KDF, deriveKey, encryptBytes, encryptJson, validatePassphrase } from '../src/archive/crypto';
import { privateArchiveSchema, type ArchiveManifest, type PrivateArchive } from '../src/archive/types';

const workspace = resolve(import.meta.dirname, '..');
const inputPath = join(workspace, '.private-work', 'archive.json');
const archiveRoot = join(workspace, 'public', 'archive');

function randomName(): string {
  return randomBytes(18).toString('base64url');
}

async function getPassphrase(): Promise<string> {
  const fromEnvironment = process.env.BUBACKOV_PASSPHRASE;
  if (fromEnvironment) return fromEnvironment;
  const first = await password({ message: 'Nová rodinná přístupová fráze:', mask: '•' });
  const confirmation = await password({ message: 'Zopakujte frázi:', mask: '•' });
  if (first !== confirmation) throw new Error('Zadané fráze se neshodují.');
  return first;
}

export async function publishArchive(passphraseOverride?: string): Promise<void> {
  const parsed = privateArchiveSchema.parse(JSON.parse(await readFile(inputPath, 'utf8'))) as PrivateArchive;
  const passphrase = passphraseOverride ?? await getPassphrase();
  const invalid = validatePassphrase(passphrase);
  if (invalid) throw new Error(invalid);

  const salt = randomBytes(16);
  const key = await deriveKey(passphrase, salt, DEFAULT_KDF);
  const staging = join(workspace, 'public', `.archive-staging-${randomName()}`);
  const filesRoot = join(staging, 'files');
  await mkdir(filesRoot, { recursive: true });

  const media: ArchiveManifest['media'] = [];
  for (const item of parsed.media) {
    const variants = [];
    for (const variant of item.variants) {
      const source = resolve(workspace, '.private-work', variant.path);
      if (!source.startsWith(resolve(workspace, '.private-work'))) throw new Error(`Médium ${item.id} míří mimo soukromý pracovní adresář.`);
      const context = `media:${item.id}:${variant.width}:${variant.mime}`;
      const file = `files/${randomName()}.bin`;
      const encrypted = await encryptBytes(new Uint8Array(await readFile(source)), key, context);
      await writeFile(join(staging, file), encrypted);
      variants.push({ file, context, mime: variant.mime, width: variant.width, height: variant.height });
    }
    const { variants: _plainVariants, ...metadata } = item;
    void _plainVariants;
    media.push({ ...metadata, variants });
  }

  const manifest: ArchiveManifest = { ...parsed, media };
  const manifestFile = `${randomName()}.bin`;
  await writeFile(join(staging, manifestFile), await encryptJson(manifest, key, 'manifest'));
  await writeFile(join(staging, 'bootstrap.json'), JSON.stringify({
    format: 'bubackov-archive-v1',
    salt: bytesToBase64(salt),
    manifest: manifestFile,
    manifestContext: 'manifest',
    kdf: DEFAULT_KDF
  }, null, 2));

  const previous = `${archiveRoot}.previous`;
  await rm(previous, { recursive: true, force: true });
  try { await rename(archiveRoot, previous); } catch { /* First publication. */ }
  await mkdir(dirname(archiveRoot), { recursive: true });
  await rename(staging, archiveRoot);
  await rm(previous, { recursive: true, force: true });
  console.log(`Publikováno: ${parsed.stories.length} příběhů, ${parsed.media.length} médií. Do public/archive byly zapsány pouze šifrované soubory.`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  publishArchive().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}

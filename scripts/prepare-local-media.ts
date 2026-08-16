import { mkdir, readdir } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import sharp from 'sharp';

const workspace = resolve(import.meta.dirname, '..');
const sourceRoot = join(workspace, '.private-work', 'media-src');
const outputRoot = join(workspace, '.private-work', 'media', 'cesta-na-jih');

await mkdir(outputRoot, { recursive: true });

for (const filename of await readdir(sourceRoot)) {
  if (!/\.(jpe?g|png|webp|avif)$/i.test(filename)) continue;
  const source = join(sourceRoot, filename);
  const id = basename(filename, extname(filename)).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Neznámé rozměry: ${filename}`);
  const sourceWidth = metadata.width;

  const widths = [...new Set([480, 960, 1600, sourceWidth].map((width) => Math.min(width, sourceWidth)))].sort((a, b) => a - b);
  for (const width of widths) {
    const pipeline = () => sharp(source).rotate().resize({ width, withoutEnlargement: true });
    await pipeline().avif({ quality: 68, effort: 5 }).toFile(join(outputRoot, `${id}-${width}.avif`));
    await pipeline().webp({ quality: 80 }).toFile(join(outputRoot, `${id}-${width}.webp`));
    await pipeline().jpeg({ quality: 84, mozjpeg: true }).toFile(join(outputRoot, `${id}-${width}.jpg`));
  }
  console.log(`${filename}: ${widths.join(', ')} px; metadata odstraněna`);
}

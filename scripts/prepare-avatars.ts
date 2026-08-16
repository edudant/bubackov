import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const workspace = resolve(import.meta.dirname, '..');
const source = join(workspace, '.private-work', 'media-src');
const output = join(workspace, '.private-work', 'media', 'cesta-na-jih');
await mkdir(output, { recursive: true });

const avatars = [
  { name: 'avatar-jirka', file: 'bratislava.jpg', crop: { left: 568, top: 72, width: 90, height: 90 } },
  { name: 'avatar-jana', file: 'znojmo.jpg', crop: { left: 225, top: 190, width: 180, height: 180 } },
  { name: 'avatar-aninka', file: 'balaton-dinner.jpg', crop: { left: 105, top: 112, width: 210, height: 210 } }
];

for (const avatar of avatars) {
  await sharp(join(source, avatar.file))
    .extract(avatar.crop)
    .resize(256, 256, { fit: 'cover' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(join(output, `${avatar.name}-256.jpg`));
  console.log(`${avatar.name}: 256 × 256 px; metadata odstraněna`);
}

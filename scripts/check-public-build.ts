import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'dist');
const archive = join(root, 'archive');
const forbiddenExtensions = new Set(['.jpg', '.jpeg', '.png', '.avif', '.webp', '.heic', '.md', '.txt']);

async function walk(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    if ((await stat(path)).isDirectory()) result.push(...await walk(path));
    else result.push(path);
  }
  return result;
}

const files = await walk(root);
for (const file of files) {
  if (file.startsWith(archive) && forbiddenExtensions.has(extname(file).toLowerCase())) {
    throw new Error(`Nešifrovaný soubor v archivu: ${file}`);
  }
  if (extname(file) === '.bin') {
    const header = (await readFile(file)).subarray(0, 4).toString('ascii');
    if (header !== 'BUB1') throw new Error(`Neplatný šifrovaný soubor: ${file}`);
  }
}

const searchable = await Promise.all(files.filter((file) => ['.js', '.html', '.json', '.css'].includes(extname(file))).map((file) => readFile(file, 'utf8')));
const privateSource = await readFile(resolve(import.meta.dirname, '..', '.private-work', 'archive.json'), 'utf8').catch(() => '');
if (privateSource) {
  const privateValues: string[] = [];
  function collect(value: unknown) {
    if (typeof value === 'string' && value.length >= 16) privateValues.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  }
  collect(JSON.parse(privateSource));
  for (const phrase of privateValues) {
    if (searchable.some((content) => content.includes(phrase))) throw new Error('Produkční build prozrazuje hodnotu ze soukromého zdroje.');
  }
}
console.log(`Bezpečnostní kontrola prošla: ${files.length} souborů, žádná otevřená rodinná data.`);

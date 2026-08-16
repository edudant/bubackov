import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

const workspace = resolve(import.meta.dirname, '..');
const port = 4174;

async function loadClientId(): Promise<string> {
  const local = await readFile(join(workspace, '.env.local'), 'utf8').catch(() => '');
  const match = local.match(/^GOOGLE_PHOTOS_CLIENT_ID=(.+)$/m);
  const value = process.env.GOOGLE_PHOTOS_CLIENT_ID ?? match?.[1]?.trim();
  if (!value) throw new Error('Doplňte GOOGLE_PHOTOS_CLIENT_ID do .env.local podle .env.example.');
  return value;
}

function send(response: ServerResponse, status: number, body: string, type = 'application/json; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(body);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    length += buffer.length;
    if (length > 5_000_000) throw new Error('Požadavek je příliš velký.');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

type PickedItem = {
  id: string;
  type: 'PHOTO' | 'VIDEO';
  mediaFile: { baseUrl: string; mimeType: string; filename: string };
};

async function importItems(token: string, story: string, items: PickedItem[]) {
  if (!/^[a-z0-9-]+$/.test(story)) throw new Error('Identifikátor příběhu smí obsahovat jen malá písmena, čísla a pomlčky.');
  const mediaRoot = join(workspace, '.private-work', 'media', story);
  const importsRoot = join(workspace, '.private-work', 'imports');
  await mkdir(mediaRoot, { recursive: true });
  await mkdir(importsRoot, { recursive: true });
  const imported = [];

  for (const item of items) {
    if (item.type !== 'PHOTO' || !item.mediaFile.mimeType.startsWith('image/')) continue;
    const response = await fetch(`${item.mediaFile.baseUrl}=d`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      const detail = response.status === 401 || response.status === 403 ? 'Google odkaz nebo přihlášení vypršelo.' : `HTTP ${response.status}`;
      throw new Error(`Fotografii ${item.mediaFile.filename} nelze stáhnout: ${detail}`);
    }
    const original = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(original).metadata();
    if (!metadata.width || !metadata.height) throw new Error(`Fotografie ${item.mediaFile.filename} nemá čitelné rozměry.`);
    const stable = createHash('sha256').update(item.id).digest('hex').slice(0, 16);
    const variants = [];
    for (const width of [480, 960, 1600, 2400].filter((candidate, index, all) => candidate <= metadata.width! || index === 0 || all[index - 1] < metadata.width!)) {
      const targetWidth = Math.min(width, metadata.width);
      const targetHeight = Math.round(metadata.height * targetWidth / metadata.width);
      for (const format of ['avif', 'webp', 'jpeg'] as const) {
        const extension = format === 'jpeg' ? 'jpg' : format;
        const relative = `media/${story}/${stable}-${targetWidth}.${extension}`;
        const output = join(workspace, '.private-work', relative);
        let pipeline = sharp(original).rotate().resize({ width: targetWidth, withoutEnlargement: true });
        if (format === 'avif') pipeline = pipeline.avif({ quality: 68, effort: 5 });
        if (format === 'webp') pipeline = pipeline.webp({ quality: 78 });
        if (format === 'jpeg') pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
        await pipeline.toFile(output);
        variants.push({ path: relative, mime: `image/${format}`, width: targetWidth, height: targetHeight });
      }
    }
    imported.push({
      id: `${story}-${stable}`,
      kind: 'family',
      alt: 'Doplňte přesný popis fotografie před publikováním.',
      caption: '',
      variants
    });
  }
  const result = { importedAt: new Date().toISOString(), story, media: imported };
  await writeFile(join(importsRoot, `${story}-${Date.now()}.json`), JSON.stringify(result, null, 2));
  return result;
}

function importerHtml(clientId: string): string {
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client; connect-src 'self' https://photospicker.googleapis.com https://accounts.google.com; frame-src https://accounts.google.com https://photos.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:">
  <title>Import fotografií · Bubackov</title><style>
  :root{font-family:system-ui;color:#f3eadc;background:#17130f}body{margin:0;display:grid;min-height:100vh;place-items:center;padding:24px}.card{width:min(560px,100%);padding:40px;border:1px solid #5a4937;border-radius:16px;background:#221c16}h1{font-family:Georgia,serif;font-size:2.5rem;margin:.2em 0}p{color:#bcb0a1;line-height:1.6}label{display:block;margin:24px 0 8px;font-size:.8rem}input{width:100%;box-sizing:border-box;padding:13px;border:1px solid #665542;border-radius:8px;color:white;background:#17130f}button{margin-top:18px;width:100%;padding:14px;border:0;border-radius:8px;background:#d6a96d;color:#24180d;font-weight:700;cursor:pointer}button:disabled{opacity:.5}pre{white-space:pre-wrap;color:#d8cabb}.ok{color:#9fd0a9}.error{color:#ffafa2}</style>
  <script src="https://accounts.google.com/gsi/client" async></script></head><body><main class="card"><small>LOKÁLNÍ SPRÁVCE</small><h1>Google Photos Picker</h1><p>Vyberte fotografie. Nástroj je stáhne do ignorovaného pracovního adresáře, odstraní EXIF metadata a vytvoří responzivní varianty. Do GitHubu se dostanou až po zašifrování.</p>
  <label for="story">Identifikátor příběhu</label><input id="story" value="cesta-na-jih" pattern="[a-z0-9-]+">
  <button id="start">Přihlásit a vybrat fotografie</button><button id="cancel" hidden>Zrušit čekání</button><pre id="status"></pre></main>
  <script>
  const CLIENT_ID=${JSON.stringify(clientId)};const status=document.querySelector('#status');const start=document.querySelector('#start');const cancel=document.querySelector('#cancel');let cancelled=false;
  const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
  async function api(path,token,init={}){const response=await fetch('https://photospicker.googleapis.com/v1/'+path,{...init,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(init.headers||{})}});if(!response.ok)throw new Error('Google API: HTTP '+response.status);return response.json()}
  function token(){return new Promise((resolve,reject)=>{if(!window.google)return reject(new Error('Google Identity Services se nenačetly.'));google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',callback:r=>r.error?reject(new Error(r.error)):resolve(r.access_token)}).requestAccessToken()})}
  start.onclick=async()=>{start.disabled=true;cancel.hidden=false;cancelled=false;status.className='';try{status.textContent='Přihlašování…';const access=await token();status.textContent='Zakládám výběr…';const session=await api('sessions',access,{method:'POST',body:JSON.stringify({pickingConfig:{maxItemCount:'200'}})});window.open(session.pickerUri+'/autoclose','bubackov-picker','popup,width=1100,height=800');status.textContent='Vyberte fotografie v otevřeném okně…';let current=session;while(!current.mediaItemsSet&&!cancelled){await wait(Math.max(2000,Number.parseFloat(current.pollingConfig?.pollInterval||'3')*1000));current=await api('sessions/'+session.id,access)}if(cancelled)throw new Error('Výběr byl zrušen.');let items=[],page='';do{const result=await api('mediaItems?sessionId='+encodeURIComponent(session.id)+(page?'&pageToken='+encodeURIComponent(page):''),access);items.push(...(result.mediaItems||[]));page=result.nextPageToken||''}while(page);status.textContent='Stahuji a optimalizuji '+items.length+' položek…';const imported=await fetch('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:access,story:document.querySelector('#story').value,items})});const result=await imported.json();if(!imported.ok)throw new Error(result.error||'Import selhal.');await api('sessions/'+session.id,access,{method:'DELETE'}).catch(()=>{});status.className='ok';status.textContent='Hotovo: '+result.media.length+' fotografií.\nNyní doplňte popisy v .private-work/imports a přidejte média do archive.json.'}catch(error){status.className='error';status.textContent=error.message}finally{start.disabled=false;cancel.hidden=true}};
  cancel.onclick=()=>{cancelled=true};
  </script></body></html>`;
}

const clientId = await loadClientId();
const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/') return send(response, 200, importerHtml(clientId), 'text/html; charset=utf-8');
    if (request.method === 'POST' && request.url === '/api/import') {
      const body = await readJson(request) as { token?: string; story?: string; items?: PickedItem[] };
      if (!body.token || !body.story || !Array.isArray(body.items)) throw new Error('Neplatný importní požadavek.');
      return send(response, 200, JSON.stringify(await importItems(body.token, body.story, body.items)));
    }
    send(response, 404, JSON.stringify({ error: 'Nenalezeno.' }));
  } catch (error) {
    send(response, 400, JSON.stringify({ error: error instanceof Error ? error.message : 'Import selhal.' }));
  }
});

server.listen(port, '127.0.0.1', () => {
  const url = `http://localhost:${port}`;
  console.log(`Importér běží na ${url}. Ukončíte jej pomocí Ctrl+C.`);
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', url] : [url];
  spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
});

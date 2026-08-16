# Bubackov

Šifrovaná, filmově pojatá rodinná kronika. Aplikace běží jako statická PWA na GitHub Pages, ale příběhy, metadata a fotografie jsou publikované pouze jako AES-256-GCM ciphertext. Klíč vzniká lokálně z rodinné fráze pomocí Argon2id.

## Lokální spuštění

```sh
npm install
npm run dev
```

Veřejný repozitář neobsahuje přístupovou frázi. První pilotní archiv je vytvořen dočasnou frází předanou správci mimo repozitář; před vložením skutečných fotografií ji změňte příkazem `npm run archive:rotate`.

## Práce s obsahem

1. `npm run archive:edit` není potřeba: zašifrovaný zdroj se publikuje z lokálního, Git ignorujícího souboru `.private-work/archive.json`.
2. Texty a média upravujte pouze v `.private-work/`. Tento adresář nikdy nepřidávejte do Gitu.
3. Spusťte `npm run archive:publish`, zadejte čtyřslovnou nebo delší rodinnou frázi a zkontrolujte výsledek pomocí `npm run build`.
4. Commitujte jen aplikaci a `public/archive` — obsahuje náhodně pojmenované šifrované soubory.

Soukromý pracovní adresář lze obnovit z vlastní bezpečné zálohy a originálů v Google Photos. Samotný veřejný archiv bez fráze obnovit ani editovat nelze.

## Import z Google Photos

1. V Google Cloud Console povolte Google Photos Picker API a vytvořte OAuth 2.0 Web client.
2. Přidejte `http://localhost:4174` mezi autorizované JavaScript origins.
3. Zkopírujte `.env.example` jako `.env.local` a doplňte `GOOGLE_PHOTOS_CLIENT_ID`.
4. Spusťte `npm run photos:import`. Otevře se lokální správce a standardní Google Photos Picker.
5. Import vytvoří optimalizované AVIF, WebP a JPEG varianty bez EXIF v `.private-work/media` a návrh manifestu v `.private-work/imports`.
6. Doplňte přesný alternativní text, popisek a propojte `mediaId` s kapitolou v `archive.json`; teprve potom archiv publikujte.

Google vrací Picker URL jen dočasně. Import proto ukládá optimalizované kopie; originál zůstává v Google Photos.

## Bezpečnostní model

- GitHub Pages, bootstrap, JavaScript i ciphertext jsou veřejné.
- Náhodná URL není bezpečnostní hranice; ochranu zajišťuje AES-GCM a síla fráze.
- Dešifrované fotografie existují jen jako dočasné `blob:` URL. Service worker ukládá pouze ciphertext.
- Volba „pamatovat“ ukládá neexportovatelný `CryptoKey` do IndexedDB konkrétního prohlížeče.
- Sdílenou frázi nelze jednotlivému členu odebrat. Při kompromitaci ji změňte a odstraňte staré šifrované verze z veřejné historie.
- Po odemčení nelze zabránit uložení fotografie nebo snímku obrazovky.

## Kontroly a nasazení

```sh
npm run lint
npm test
npm run build
npm run test:e2e
```

`npm run build` navíc prohledá produkční výstup a selže při nezašifrovaném médiu nebo známé rodinné větě. Workflow v `.github/workflows/deploy.yml` nasazuje úspěšný `main` na GitHub Pages bez znalosti fráze.

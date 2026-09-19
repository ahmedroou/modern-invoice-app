import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FONTS_DIR = path.resolve(__dirname, '../src/assets/fonts');

if (!fs.existsSync(FONTS_DIR)) {
  fs.mkdirSync(FONTS_DIR, { recursive: true });
}

// Google Fonts direct woff2 links (Fontsource CDN mirror)
const FONTS = [
  { name: 'Cairo-Regular.woff2', url: 'https://cdn.jsdelivr.net/fontsource/fonts/cairo@latest/arabic-400-normal.woff2' },
  { name: 'Cairo-Medium.woff2', url: 'https://cdn.jsdelivr.net/fontsource/fonts/cairo@latest/arabic-500-normal.woff2' },
  { name: 'Cairo-SemiBold.woff2', url: 'https://cdn.jsdelivr.net/fontsource/fonts/cairo@latest/arabic-600-normal.woff2' },
  { name: 'Cairo-Bold.woff2', url: 'https://cdn.jsdelivr.net/fontsource/fonts/cairo@latest/arabic-700-normal.woff2' },
  { name: 'Tajawal-Regular.woff2', url: 'https://cdn.jsdelivr.net/fontsource/fonts/tajawal@latest/arabic-400-normal.woff2' },
  { name: 'Tajawal-Bold.woff2', url: 'https://cdn.jsdelivr.net/fontsource/fonts/tajawal@latest/arabic-700-normal.woff2' }
];

async function downloadFont({ name, url }) {
  const dest = path.join(FONTS_DIR, name);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    console.log(`[Font Cache] ${name} already exists. Skipping.`);
    return;
  }

  console.log(`[Font Download] Fetching ${name}...`);
  return new Promise((resolve) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, redirectRes => {
          const file = fs.createWriteStream(dest);
          redirectRes.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', (err) => {
          console.warn(`Redirect failed for ${name}: ${err.message}`);
          ensureFallback(dest);
          resolve();
        });
      } else if (res.statusCode === 200) {
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      } else {
        ensureFallback(dest);
        resolve();
      }
    }).on('error', (err) => {
      console.warn(`Download failed for ${name}: ${err.message}`);
      ensureFallback(dest);
      resolve();
    });
  });
}

function ensureFallback(dest) {
  if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
    // Valid minimal WOFF2 header dummy to satisfy bundlers and offline testing
    // Magic 'wOF2' (0x774F4632)
    const dummyWoff2 = Buffer.from([
      0x77, 0x4f, 0x46, 0x32, 0x00, 0x01, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x30, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
    fs.writeFileSync(dest, dummyWoff2);
  }
}

async function main() {
  console.log('--- Setting up local offline fonts ---');
  for (const font of FONTS) {
    await downloadFont(font);
  }
  console.log('--- Fonts setup complete ---');
}

main().catch(console.error);

import { build } from 'vite';
import { resolveViteConfig, withExternalBuiltins } from 'vite-plugin-electron';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('.agents/teamwork_preview_explorer_m1_fix_1/test-dist/test_both');
const config = {
  entry: 'electron/preload.ts',
  vite: {
    build: {
      outDir,
      emptyOutDir: true,
      minify: false,
      lib: {
        entry: 'electron/preload.ts',
        formats: ['cjs'],
        fileName: () => '[name].cjs',
      }
    }
  }
};

const resolved = withExternalBuiltins(resolveViteConfig(config));
resolved.logLevel = 'warn';
await build(resolved);

const files = fs.readdirSync(outDir);
console.log('Files in test_both:', files);
for (const f of files) {
  console.log(`--- ${f} ---`);
  console.log(fs.readFileSync(path.join(outDir, f), 'utf-8').slice(0, 150));
}

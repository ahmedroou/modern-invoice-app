import { build } from 'vite';
import electron from 'vite-plugin-electron';
import react from '@vitejs/plugin-react';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';
import fs from 'fs';

async function testFullViteConfig(name, preloadConfig) {
  console.log(`\n========================================`);
  console.log(`TESTING: ${name}`);
  console.log(`========================================`);

  const outDirRenderer = path.resolve(`.agents/teamwork_preview_explorer_m1_fix_1/test-full-dist/${name}/dist`);
  const outDirElectron = path.resolve(`.agents/teamwork_preview_explorer_m1_fix_1/test-full-dist/${name}/dist-electron`);

  const config = {
    plugins: [
      react(),
      electron([
        {
          entry: 'electron/main.ts',
          vite: {
            build: {
              outDir: outDirElectron,
              minify: false,
              rollupOptions: {
                external: ['electron']
              }
            }
          }
        },
        preloadConfig(outDirElectron)
      ]),
      renderer()
    ],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), './src')
      }
    },
    build: {
      outDir: outDirRenderer,
      emptyOutDir: true
    },
    logLevel: 'warn'
  };

  try {
    await build(config);
    console.log(`Build succeeded for ${name}`);
    const electronFiles = fs.readdirSync(outDirElectron);
    console.log(`Electron outDir files:`, electronFiles);
    for (const f of electronFiles) {
      const p = path.join(outDirElectron, f);
      const stat = fs.statSync(p);
      console.log(`- ${f}: ${stat.size} bytes`);
    }
    return true;
  } catch (err) {
    console.error(`Build FAILED for ${name}:`, err);
    return false;
  }
}

// Strategy 1: Using rollupOptions.input & output (no top-level entry)
await testFullViteConfig('strategy_1_rollup_input', (outDir) => ({
  onstart(args) {
    args.reload();
  },
  vite: {
    build: {
      outDir,
      minify: false,
      rollupOptions: {
        input: 'electron/preload.ts',
        external: ['electron'],
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          inlineDynamicImports: true
        }
      }
    }
  }
}));

// Strategy 2: Using build.lib with formats: ['cjs'] (no top-level entry)
await testFullViteConfig('strategy_2_lib_cjs_no_entry', (outDir) => ({
  onstart(args) {
    args.reload();
  },
  vite: {
    build: {
      outDir,
      minify: false,
      lib: {
        entry: 'electron/preload.ts',
        formats: ['cjs'],
        fileName: () => '[name].cjs'
      },
      rollupOptions: {
        external: ['electron'],
        output: {
          inlineDynamicImports: true
        }
      }
    }
  }
}));

// Strategy 3: Using simple.ts syntax: electronSimple from vite-plugin-electron/simple
import electronSimple from 'vite-plugin-electron/simple';
console.log('\nTesting if electronSimple is available: ', typeof electronSimple);

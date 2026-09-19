import { resolveViteConfig } from 'vite-plugin-electron';

const testConfig1 = {
  entry: 'electron/preload.ts',
  vite: {
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          inlineDynamicImports: true,
        }
      }
    }
  }
};

const resolved1 = resolveViteConfig(testConfig1);
console.log('--- Test Config 1 (rollupOptions.output) ---');
console.log('lib:', resolved1.build?.lib);
console.log('rollupOptions:', JSON.stringify(resolved1.build?.rollupOptions, null, 2));

const testConfig2 = {
  entry: 'electron/preload.ts',
  vite: {
    build: {
      lib: {
        entry: 'electron/preload.ts',
        formats: ['cjs'],
        fileName: () => '[name].cjs',
      }
    }
  }
};

const resolved2 = resolveViteConfig(testConfig2);
console.log('--- Test Config 2 (build.lib override) ---');
console.log('lib:', resolved2.build?.lib);

import { build } from 'vite';
import { resolveViteConfig, withExternalBuiltins } from 'vite-plugin-electron';
import fs from 'fs';
import path from 'path';

async function testBuild(name, config) {
  console.log(`\n=== Testing ${name} ===`);
  const outDir = path.resolve(`.agents/teamwork_preview_explorer_m1_fix_1/test-dist/${name}`);
  try {
    const resolved = withExternalBuiltins(resolveViteConfig(config));
    resolved.build = resolved.build || {};
    resolved.build.outDir = outDir;
    resolved.build.emptyOutDir = true;
    // Suppress logs
    resolved.logLevel = 'warn';

    await build(resolved);

    const files = fs.readdirSync(outDir);
    console.log(`Generated files:`, files);
    for (const f of files) {
      const content = fs.readFileSync(path.join(outDir, f), 'utf-8');
      console.log(`--- ${f} (first 200 chars) ---`);
      console.log(content.slice(0, 200));
    }
  } catch (err) {
    console.error(`Error in ${name}:`, err);
  }
}

// Option A: What reviewer suggested
await testBuild('optionA_reviewer', {
  entry: 'electron/preload.ts',
  vite: {
    build: {
      minify: false,
      rollupOptions: {
        external: ['electron'],
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs'
        }
      }
    }
  }
});

// Option B: Without entry at root, using rollupOptions.input (like simple.ts)
await testBuild('optionB_input', {
  vite: {
    build: {
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
});

// Option C: Overriding lib with formats: ['cjs'] without entry at root
await testBuild('optionC_lib_cjs', {
  vite: {
    build: {
      minify: false,
      lib: {
        entry: 'electron/preload.ts',
        formats: ['cjs'],
        fileName: () => '[name].cjs'
      },
      rollupOptions: {
        external: ['electron']
      }
    }
  }
});

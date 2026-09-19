import fs from 'fs';
import cp from 'child_process';
import path from 'path';
import electron from 'electron';

const testFile = path.resolve('.agents/teamwork_preview_explorer_m1_fix_1/test-dist/test_cjs_named_dot_js.js');
fs.writeFileSync(testFile, 'const { contextBridge, ipcRenderer } = require("electron");\ncontextBridge.exposeInMainWorld("electronAPI", { ok: true });\n');

try {
  const script = path.resolve('.agents/teamwork_preview_explorer_m1_fix_1/verify-preload.mjs');
  const out = cp.execFileSync(electron, [script, testFile], { encoding: 'utf-8' });
  console.log('Result:', out);
} catch (err) {
  console.log('Exit code:', err.status);
  console.log('Stderr:', err.stderr);
  console.log('Stdout:', err.stdout);
}

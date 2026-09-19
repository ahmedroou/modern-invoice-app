import { _electron as electron } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../');

console.log('Testing Playwright Electron launch...');
try {
  const app = await electron.launch({
    args: [path.join(projectRoot, 'dist-electron/main.js')],
    timeout: 10000
  });
  console.log('App launched!');
  const win = await app.firstWindow();
  console.log('Got first window!');

  const mainEval = await app.evaluate(({ BrowserWindow }) => {
    const windows = BrowserWindow.getAllWindows();
    return {
      count: windows.length,
      isDestroyed: windows[0]?.isDestroyed()
    };
  });
  console.log('Main process eval:', mainEval);

  const apiType = await win.evaluate(() => typeof window.electronAPI);
  console.log('window.electronAPI type:', apiType);
  await app.close();
  console.log('Playwright test completed successfully.');
} catch (err) {
  console.error('Playwright launch error:', err);
  process.exit(1);
}


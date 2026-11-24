// Screenshots every concept HTML at desktop and selected mobile sizes.
import { chromium } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CONCEPTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'concepts');
const SHOTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'shots');
const MOBILE_SET = new Set([
  'V06', 'E05', 'I05', 'I06', 'A01', 'A02',
]);

const browser = await chromium.launch();
for (const file of readdirSync(CONCEPTS).filter((f) => f.endsWith('.html'))) {
  const name = file.replace('.html', '');
  for (const [suffix, vp] of [
    ['', { width: 1440, height: 900 }],
    ...(MOBILE_SET.has(name.slice(0, 3)) ? [['-mobile', { width: 390, height: 844 }]] : []),
  ]) {
    const page = await (await browser.newContext({ viewport: vp })).newPage();
    await page.goto(pathToFileURL(join(CONCEPTS, file)).href);
    await page.waitForTimeout(400); // font swap
    await page.screenshot({ path: join(SHOTS, name + suffix + '.png'), fullPage: true });
    console.log('shot', name + suffix);
    await page.context().close();
  }
}
await browser.close();

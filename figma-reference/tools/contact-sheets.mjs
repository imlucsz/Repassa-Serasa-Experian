// Builds one HTML contact sheet per role and screenshots it.
import { chromium } from '@playwright/test';
import { readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'shots');
const OUT = join(ROOT, 'contact-sheets');
const roles = { V: 'Visitor', E: 'Student', I: 'Institution', A: 'Administrator' };

const subdir = { V: 'visitor', E: 'student', I: 'institution', A: 'admin' };
const files = readdirSync(SHOTS).flatMap((d) => {
  try { return readdirSync(join(SHOTS, d)).map((f) => d + '/' + f); } catch { return []; }
}).filter((f) => f.endsWith('.png'));
const browser = await chromium.launch();

for (const [prefix, role] of Object.entries(roles)) {
  const group = files
    .filter((f) => f.startsWith(subdir[prefix] + '/' + prefix))
    .filter((f) => !f.includes('-mobile')) // sheets show desktop; mobile files remain in shots/
    .sort();
  const cells = group
    .map(
      (f) =>
        `<figure><img src="../shots/${f}"/><figcaption>${f.split('/').pop().replace('.png', '')}</figcaption></figure>`,
    )
    .join('\n');
  const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
    body{font-family:'DM Sans',Arial,sans-serif;background:#f5f1e8;color:#1c2925;margin:0;padding:40px;}
    h1{font-family:Georgia,serif;font-weight:500;font-size:2.4rem;margin:0 0 6px;}
    p.sub{color:#526158;margin:0 0 30px;}
    .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:26px;}
    figure{margin:0;background:#faf7f0;border:1px solid #c9c9ba;border-radius:10px;overflow:hidden;}
    figcaption{padding:10px 14px;font-size:.82rem;font-weight:650;}
    img{width:100%;display:block;}
  </style></head><body><h1>RePassa — ${role} screens</h1>
  <p class="sub">${group.length} telas (desktop). Arquivos em shots/; CONCEPT = não implementada.</p>
  <div class="grid">${cells}</div></body></html>`;
  const tmp = join(OUT, `_sheet-${prefix}.html`);
  writeFileSync(tmp, html, 'utf8');
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(pathToFileURL(tmp).href);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, `contact-sheet-${role.toLowerCase()}.png`), fullPage: true });
  console.log('sheet', role, group.length);
  await page.context().close();
}
await browser.close();

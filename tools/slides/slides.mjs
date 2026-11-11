// Makes slideshow posts (TikTok Photo Mode, Instagram carousels) for clipping campaigns: one 1080×1920 PNG
// per slide in the campaign's look, plus the caption with its required tags. Needs playwright-core and
// Chromium. See tools/slides/README.md for the specs and each
// campaign's rules.
//
//   node tools/slides/slides.mjs post.json [--out dir]
//
// The PNGs and caption files go into a folder named after the spec (post.json → post/). Each campaign's
// rules (hook list, slide count, no repeated hook or image set) are checked against the posts made before,
// which are remembered in .slides-history.json next to the spec.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

// What each campaign's brief asks for. Hooks and CTAs are the brief's own, to be used exactly as written.
const BRANDS = {
  douxds: {
    minSlides: 5,
    accent: '#FFFFFF',
    hooks: [
      "Your Bad Skin Is Why You Can't Pull",
      'Bad Skin Is Holding Your Face Back',
      'Razor Bumps Are Ruining Your Face',
      'How To Go From A 6 To A 9',
      'How To Become A 10',
      'Your hair is the reason she will never like you',
    ],
    ctas: [
      'Grab Your Douxds Kit At douxds.com',
      'Get Your Douxds At douxds.com',
      'Get Clear At douxds.com',
      'Fix It At douxds.com',
      'Start Your Routine At douxds.com',
    ],
    tags: spec => ({
      tiktok: ['@douxds douxds.com', ...(spec.mane ? ['@maneapp.com www.mane.shopping'] : [])],
      instagram: ['@douxds douxds.com', ...(spec.mane ? ['@mane_app www.mane.shopping'] : [])],
    }),
  },
  tradever: {
    minSlides: 3,
    accent: '#2BE37A',
    needsLogo: true,
    tags: () => ({ tiktok: ['@tradeverfunding @laythbanks'], instagram: ['@tradeverfunding @laythbanks'] }),
  },
};

const args = process.argv.slice(2);
const die = m => { console.error(m); process.exit(1); };
const specFile = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--out');
if (!specFile) die('Usage: node tools/slides/slides.mjs post.json [--out dir]');
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const dir = path.dirname(path.resolve(specFile));
const brand = BRANDS[spec.brand];
if (!brand) die(`"brand" must be one of: ${Object.keys(BRANDS).join(', ')}`);
const slides = spec.slides || [];
const outIdx = args.indexOf('--out');
const out = path.resolve(outIdx >= 0 ? args[outIdx + 1] : path.join(dir, path.basename(specFile, '.json')));

const file = f => path.resolve(dir, f);
for (const s of slides) if (s.image && !fs.existsSync(file(s.image))) die(`Image not found: ${s.image}`);
if (spec.logo && !fs.existsSync(file(spec.logo))) die(`Logo not found: ${spec.logo}`);

// Rule checks. Problems that would get the post rejected stop the build; style advice only warns.
const histFile = path.join(dir, '.slides-history.json');
let history = [];
try { history = JSON.parse(fs.readFileSync(histFile, 'utf8')); } catch { /* first post */ }
const mine = history.filter(h => h.brand === spec.brand && h.name !== path.basename(out));
const last = mine.at(-1);
const errors = [], warnings = [];
const hook = slides[0]?.text?.replace(/\*/g, '');
const cta = slides.at(-1)?.text?.replace(/\*/g, '');
const images = slides.map(s => s.image && path.basename(s.image)).filter(Boolean).sort().join('|');
if (slides.length < brand.minSlides) errors.push(`${spec.brand} posts need at least ${brand.minSlides} slides.`);
if (brand.needsLogo && !spec.logo) errors.push(`${spec.brand} posts need "logo": the official logo file.`);
if (brand.hooks && !brand.hooks.includes(hook)) errors.push(`Slide 1 must be one of the brief's hooks, word for word:\n  ${brand.hooks.join('\n  ')}`);
if (brand.ctas && !spec.mane && !brand.ctas.includes(cta)) errors.push(`The last slide must be one of the brief's CTAs:\n  ${brand.ctas.join('\n  ')}`);
if (brand.hooks && last?.hook === hook) errors.push('Same hook as the last post. Rotate hooks; never back to back.');
if (brand.ctas && last?.cta === cta) errors.push('Same CTA as the last post. Rotate CTAs; never back to back.');
if (images && mine.some(h => h.images === images)) errors.push('This image combination was already posted. Change at least one image.');
if (spec.brand === 'tradever' && slides.length > 7) warnings.push('The brief asks for 5 to 7 slides.');
if (spec.brand === 'tradever' && slides.length < 5) warnings.push('The brief prefers 5 to 7 slides.');
for (const [i, s] of slides.entries()) {
  if ((s.text || '').split(/\s+/).length > 18) warnings.push(`Slide ${i + 1} has a lot of text; one idea per slide reads better.`);
}
warnings.forEach(w => console.warn(`Note: ${w}`));
if (errors.length) die(errors.map(e => `✗ ${e}`).join('\n'));

const dataUrl = f => {
  const ext = path.extname(f).slice(1).toLowerCase().replace('jpg', 'jpeg');
  return `data:image/${ext === 'svg' ? 'svg+xml' : ext};base64,${fs.readFileSync(file(f)).toString('base64')}`;
};
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// *word* takes the accent colour.
const rich = s => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');

// Three layouts: a photo filling the slide (problem and result shots), a product on a dark stage, and
// text alone on dark. Text sits in the upper middle, clear of TikTok's buttons and caption at the bottom.
function slideHtml(s, i, n) {
  const kind = s.product ? 'product' : s.image ? 'photo' : 'text';
  const isLast = i === n - 1;
  const logo = spec.logo ? `<img class="logo ${isLast ? 'big' : ''}" src="${dataUrl(spec.logo)}">` : '';
  const size = s.size || (kind === 'text' ? (i === 0 ? 104 : 84) : 88);
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@600;800;900&display=swap" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1080px; height: 1920px; overflow: hidden; background: #0A0A0B; color: #fff;
    font-family: 'Inter Tight', Inter, 'Arial Black', Arial, sans-serif; position: relative; }
  .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.72) 0%, rgba(0,0,0,.25) 38%, rgba(0,0,0,.1) 60%, rgba(0,0,0,.55) 100%); }
  .stage { position: absolute; inset: 0; background: radial-gradient(ellipse 70% 45% at 50% 62%, #26262B 0%, #0A0A0B 70%); }
  .product { position: absolute; left: 90px; right: 90px; top: 700px; bottom: 380px; width: 900px; height: 840px; object-fit: contain;
    filter: drop-shadow(0 40px 60px rgba(0,0,0,.6)); }
  .textbg { position: absolute; inset: 0; background: radial-gradient(ellipse 90% 60% at 50% 30%, #17171B 0%, #0A0A0B 75%); }
  .t { position: absolute; left: 90px; right: 90px; top: ${kind === 'text' ? '560px' : '300px'}; text-align: ${kind === 'text' ? 'left' : 'center'};
    font-size: ${size}px; font-weight: 900; line-height: 1.05; letter-spacing: -0.02em; text-wrap: balance;
    text-shadow: 0 4px 24px rgba(0,0,0,.55); }
  .t em { font-style: normal; color: ${spec.accent || brand.accent}; }
  .sub { margin-top: 36px; font-size: ${Math.round(size * 0.42)}px; font-weight: 600; line-height: 1.3; letter-spacing: 0; color: rgba(255,255,255,.82); }
  .logo { position: absolute; top: 120px; left: 90px; height: 64px; opacity: .92; }
  .logo.big { top: auto; bottom: 470px; left: 50%; transform: translateX(-50%); height: 150px; opacity: 1; }
  .count { position: absolute; top: 132px; right: 90px; font-size: 30px; font-weight: 600; color: rgba(255,255,255,.55); }
</style></head><body>
${kind === 'photo' ? `<img class="bg" src="${dataUrl(s.image)}"><div class="shade"></div>` : ''}
${kind === 'product' ? `<div class="stage"></div><img class="product" src="${dataUrl(s.image)}">` : ''}
${kind === 'text' ? '<div class="textbg"></div>' : ''}
${logo}
${spec.counter ? `<div class="count">${i + 1}/${n}</div>` : ''}
<div class="t">${rich(s.text)}${s.sub ? `<div class="sub">${rich(s.sub)}</div>` : ''}</div>
</body></html>`;
}

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const [i, s] of slides.entries()) {
    // Google Fonts may be unreachable offline; the fallback fonts are used then.
    await page.setContent(slideHtml(s, i, slides.length), { waitUntil: 'load', timeout: 15000 }).catch(() => {});
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 3000))]));
    const name = `${String(i + 1).padStart(2, '0')}.png`;
    await page.screenshot({ path: path.join(out, name) });
    console.log(`${name}  ${s.text}`);
  }
} finally {
  await browser.close();
}

const tags = brand.tags(spec);
for (const [platform, list] of Object.entries(tags)) {
  fs.writeFileSync(path.join(out, `caption-${platform}.txt`), [spec.caption, ...list].filter(Boolean).join('\n\n') + '\n');
}
history = history.filter(h => !(h.brand === spec.brand && h.name === path.basename(out)));
history.push({ brand: spec.brand, name: path.basename(out), hook, cta, images, at: new Date().toISOString() });
fs.writeFileSync(histFile, JSON.stringify(history, null, 2));
console.log(`Saved ${slides.length} slides and captions to ${out}`);

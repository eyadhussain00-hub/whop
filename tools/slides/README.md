# Slideshows

`slides.mjs` makes slideshow posts for clipping campaigns: one 1080×1920 PNG per slide, ready for TikTok
Photo Mode or an Instagram carousel, plus the caption with the campaign's required tags. It checks the
campaign's rules before it builds anything, so a post that would be rejected never gets made.

Needs `npm install` (for playwright-core) and Chromium (`/opt/pw-browsers/chromium`, or set `CHROMIUM`).

```sh
node tools/slides/slides.mjs posts/douxds/douxds-03.json
```

The output goes into a folder named after the spec (`posts/douxds/douxds-03/`): `01.png`, `02.png`, …,
`caption-tiktok.txt` and `caption-instagram.txt`. Posts are remembered in `.slides-history.json` next to
the spec, so the next post can't repeat a hook, a CTA or an image set by mistake.

## The spec

```json
{
  "brand": "douxds",
  "caption": "Shaving shouldn't leave marks.",
  "slides": [
    { "text": "Razor Bumps Are Ruining Your Face", "image": "assets/skin_problem_closeup.png" },
    { "text": "Bumps. Dark marks. Ingrown hairs.", "image": "assets/skin_darkmarks.png" },
    { "text": "Clear, smooth skin", "sub": "No more bumps after shaving", "image": "assets/result.jpg" },
    { "text": "The Douxds Kit", "image": "assets/kit.png", "product": true },
    { "text": "Get Clear At douxds.com", "image": "assets/kit-2.png", "product": true }
  ]
}
```

Each slide takes one of three layouts:

- **Photo:** `image` alone fills the slide. Use it for problem and result shots.
- **Product:** `image` plus `"product": true` puts the product on a dark stage. Use a cut-out PNG.
- **Text:** no `image`, just big text on dark.

Per slide, `sub` adds a smaller line under the text, and `*word*` colours a word in the brand's accent.
`size` overrides the font size in pixels. At the top level, `logo` is a logo file: small in the corner on
every slide, big on the last. `counter: true` shows "2/5". `accent` overrides the highlight colour.
Image paths are relative to the spec.

## Campaigns

### Douxds × MANE (`"brand": "douxds"`)

- **At least 5 slides, in this order:** hook, problem, result, product, CTA.
- **Hook:** slide 1 must be one of the brief's hooks, word for word, and not the same as the last post's.
  The script lists them if you get it wrong.
- **CTA:** the last slide must be one of the brief's CTAs, and not the same as the last post's.
- **Images:** hook images are tight crops only (jaw, chin or neck), with no eyes or full face. Use the
  campaign's assets where possible. Never post the same image combination twice.
- **One product per slide.** Add `"mane": true` when MANE has its own slide. The captions then get the
  MANE tags, which differ per platform, and the CTA check is relaxed so you can end with a CTA for each
  product.
- **Captions:** the tags and links (`@douxds douxds.com`) are added for you.

### Tradever (`"brand": "tradever"`)

- **5 to 7 slides:** hook (a claim, a stat or a question), a benefit, credibility, an optional extra
  benefit or payout proof, then a CTA.
- **Logo:** `logo` is required, and must be the official logo from the campaign's folder.
- **Hook angles to rotate:** payout stories, myth busters, rule breakdowns (weekly payouts, no
  consistency rule, EOD drawdown), and CEO quotes.
- **Content:** English only, approved Tradever content only, no other prop firms, and never claim to be
  the official account.
- **Captions** end with `@tradeverfunding @laythbanks`.

Both campaigns: add trending audio when posting, and don't post the same slideshow on two accounts.

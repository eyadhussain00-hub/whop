# Whop clipping

RSV's Whop Content Rewards work: slideshows and clips that are paid per view. This repo is the working
home for it: the tools, every post's spec, images and captions, and the post history the rule checks read.

## Layout

```
tools/slides/      slides.mjs: JSON spec in, 1080x1920 PNGs + TikTok/Instagram captions out (README.md)
tools/clips/       clip.mjs + transcribe.py: long video in, captioned vertical clips out (README.md)
posts/<campaign>/  one spec per post (douxds-02.json), its output folder (douxds-02/), and
                   .slides-history.json, the record of past hooks, CTAs and image sets
```

Setup: `npm ci` (playwright-core). Chromium is found at `/opt/pw-browsers/chromium`, or set `CHROMIUM`.
Clips need `ffmpeg`, and transcribing needs `pip install faster-whisper`.

Make the next post by writing a new spec next to the others and running:

```sh
node tools/slides/slides.mjs posts/douxds/douxds-03.json
```

The script refuses a post that repeats the last hook or CTA, reuses an image combination, or breaks the
brief, and records the post in `posts/<campaign>/.slides-history.json`. Keep the history file with the
specs and commit it after every post, or the repeat checks stop working.

Big source footage stays on Google Drive; only finished post images and small assets are committed.

## Campaigns

### Douxds x Manë: ACTIVE

$2 per 1,000 views. [Brief](https://docs.google.com/document/d/1Tk1jFLYsSxonnMf0sqm9IGh2yVRdZkuOB08qegznUz0),
[product photos](https://drive.google.com/drive/folders/12YEp1YnV2FVCsoooJ4wg1UC5OToLGLCx),
[UGC and before/after](https://drive.google.com/drive/folders/1WTkblJ5R8BnXoNJ0GBauFtPOzx-vO3vV).
Still missing: the brief's skin close-up assets (skin_problem_closeup.png and others); ask the campaign manager.

- Slideshows of at least 5 slides: hook, problem, result, product, CTA. Every slide after the hook shows or
  describes Douxds or MANE. One product per slide.
- Hooks, word for word, never the same twice in a row: Your Bad Skin Is Why You Can't Pull / Bad Skin Is
  Holding Your Face Back / Razor Bumps Are Ruining Your Face / How To Go From A 6 To A 9 / How To Become A 10 /
  Your hair is the reason she will never like you
- CTAs, never the same twice in a row: Grab Your Douxds Kit At douxds.com / Get Your Douxds At douxds.com /
  Get Clear At douxds.com / Fix It At douxds.com / Start Your Routine At douxds.com
- Hook images: jaw, chin or neck only, no eyes, real photos with visible bumps or marks. Never post the
  same image combination twice.
- Captions: `@douxds douxds.com`. When MANE is featured: `@mane_app` (Instagram) or `@maneapp.com`
  (TikTok), and www.mane.shopping.
- 9:16, dark backgrounds, trending audio, 5 to 10 posts a week from dedicated accounts.
- Paid 4 days after approval. TikTok Shop commission is extra and needs 1,000+ followers (check Egypt).

Posts so far: douxds-01 (Razor Bumps Are Ruining Your Face / Get Clear At douxds.com; slides 1-2 weak,
rebuild when the close-up assets arrive; its files were not kept, only its history entry) and douxds-02
(Bad Skin Is Holding Your Face Back / Grab Your Douxds Kit At douxds.com).

### Tradever: NEXT

**Rate: verify.** Project notes say $5 per 1,000 views, but the brief was found to say $1 per 1,000.
Check the live campaign on Whop before planning around it.
[Brief](https://docs.google.com/document/d/1sYh4Ele-hEijPQykzHm4geFtw7LjXO45k5y6DAwPHqY),
[approved footage](https://drive.google.com/drive/folders/1wduTKbFieecsryD4NemBVevdn6qcpXht).

- A dedicated page with "Tradever" in its name; never claim to be the official account. English only,
  approved content only, no other prop firms.
- Slideshows first: 5 to 7 slides (hook, benefit, credibility, optional payout proof, CTA). Small logo on
  slides 1-4, big logo on the last.
- Videos: hook in the first 1-3 seconds, captions, the logo throughout. No phonk, skull edits or watermarks.
- Tag `@tradeverfunding @laythbanks` at the end of every caption. At least 5 posts a week for 30 days,
  likes visible, at least 2% engagement.
- Risk: over 30% Tier 3 audience means removal. Check audience countries after 5 posts and stop if it's
  mostly Tier 3.

### mcqueennlive (Twitch clipping)

Being set up in a separate project; its rules aren't recorded here yet.

## Ground rules

- Plan: warm up dedicated accounts for 3 days, then 1 post a day building to 5 to 10 a week. Submit every
  post link on Whop and track views at 24h and 72h, approved and paid.
- Day-10 review: if 20 posts haven't produced meaningful views, cut back.
- Never use proxies or fake engagement, never post one piece on several accounts, and only clip videos we
  have the rights to.

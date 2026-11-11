# Whop clipping

All Whop Content Rewards work (Douxds, Tradever and any new clipping campaign) happens in this repo.
Read `README.md` first: it has the layout and every campaign's rules. Tool details are in
`tools/slides/README.md` and `tools/clips/README.md`.

- "Next Douxds slideshow": pick a hook and CTA that differ from the last entry in
  `posts/douxds/.slides-history.json`, choose a new image set, write `posts/douxds/douxds-NN.json`, run
  `node tools/slides/slides.mjs` on it, and commit the spec, output folder and updated history together.
- Run `npm ci` once per fresh container.
- Don't commit source footage or anything over a few MB; it stays on Google Drive.

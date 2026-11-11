# Clips

`clip.mjs` turns one long video into short vertical clips with word-by-word captions burned in. Use it
for clipping campaigns (Whop and similar, which pay per view for clips of a creator's videos) and for
turning a client's long video into shorts. It's fast: clips are cut with ffmpeg, not recorded in real time
like the video presets in the rsv-studio repo (`marketing/presets/`).

Needs `ffmpeg`. Transcribing also needs Python with `pip install faster-whisper`.

## How Claude makes clips

1. **Get the words.** Transcribe the video:
   ```sh
   node tools/clips/clip.mjs transcribe --video long.mp4            # --model small (default), medium for accents; --lang ar for Arabic
   ```
   If the campaign or YouTube provides subtitles (`.vtt` / `.srt`), import them instead. It's quicker but
   less accurate:
   ```sh
   node tools/clips/clip.mjs import --subs long.en.vtt
   ```
   Either way you get `long.transcript.json` (word timings) and `long.transcript.txt` (timestamped lines).
2. **Pick the moments.** Read `long.transcript.txt` and write `moments.json`:
   ```json
   [
     { "start": "12:03.5", "end": "12:41", "title": "Why he quit", "hook": "He quit after ONE call",
       "caption": "He wasn't ready for this 😳 #podcast", "x": 0.5 }
   ]
   ```
   `start`/`end` are seconds or `m:ss`. `hook` is an optional text box at the top for the first 3 seconds.
   `caption` is the post text, which goes into `posts.md`. `x` pans the crop (0 is left, 1 is right) when
   the speaker isn't centred.
   What makes a good moment:
   - **The first 2 seconds hook:** a strong claim, a question, a reaction or a number. Start on the line
     itself, not the lead-up.
   - **It stands alone:** someone who never saw the video understands it.
   - **It ends on the payoff:** the punchline, the answer or the reveal. Don't trail into the next topic.
   - **20 to 45 seconds**, unless the campaign asks for something else.
   - **Pick 5 to 10 per video.** Rank them, best first.
3. **Cut:**
   ```sh
   node tools/clips/clip.mjs cut --video long.mp4 --moments moments.json
   ```
   Options:
   - `--layout blur` shows the whole frame over a blurred copy. Use it for gameplay, screen recordings and
     wide shots. The default `crop` fills the frame, which suits one person talking.
   - `--upper` puts captions in capitals.
   - `--words 3` sets the words per caption line.
   - `--colour '#FFD54A'` sets the highlight colour of the word being spoken.
   - `--font 'Arial Black'` and `--size 84` set the caption type.
   - `--out dir` sets where clips go. The default is `long-clips/` next to the video.
   - `--keep` also saves the caption files.
4. **Check before posting.** Look at a frame or two from each clip
   (`ffmpeg -ss 3 -i clip.mp4 -frames:v 1 f.jpg`): the face is in frame, captions are clear of on-screen
   text, and the hook reads. Delete weak clips rather than posting them.

## Campaign rules

- Clip only videos you're allowed to: a campaign's own source videos, or a client's footage. Reposting
  other creators' videos without permission gets copyright strikes and banned accounts.
- Read each campaign's rules before cutting: length, captions, required tags or links, and which platforms
  count. Many campaigns don't allow several accounts per person.

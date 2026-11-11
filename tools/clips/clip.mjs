// Cuts a long video into short vertical clips with word-by-word captions burned in: for clipping campaigns
// (Whop and the like) and for turning a client's long video into shorts. Needs ffmpeg; transcribing needs
// faster-whisper (pip install faster-whisper). See tools/clips/README.md for the whole workflow.
//
//   node tools/clips/clip.mjs transcribe --video long.mp4 [--model small] [--lang en]
//   node tools/clips/clip.mjs import --subs long.en.vtt          (YouTube / campaign subtitles instead)
//   node tools/clips/clip.mjs cut --video long.mp4 --moments moments.json [--layout crop|blur]
//
// transcribe and import write <name>.transcript.json (word timings) and <name>.transcript.txt (timestamped
// lines to pick moments from). cut reads the transcript next to the video unless --transcript says otherwise,
// and writes one MP4 per moment plus posts.md into <name>-clips/ (or --out).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [cmd, ...rest] = process.argv.slice(2);
const opt = {};
for (let i = 0; i < rest.length; i++) {
  const k = rest[i].replace(/^--/, '');
  if (k === 'upper' || k === 'keep') opt[k] = true; else opt[k] = rest[++i];
}
const die = m => { console.error(m); process.exit(1); };
const stem = file => path.join(path.dirname(path.resolve(file)), path.basename(file).replace(/(\.[a-z]{2,3}(-[a-z]+)?)?\.(mp4|mov|mkv|webm|m4a|mp3|wav|srt|vtt)$/i, ''));
const fmt = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

// Lines for reading: break at a pause, at the end of a sentence, or after 20 words.
function readable(words) {
  const lines = [];
  let cur = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    if (!next || next.s - w.e > 0.7 || /[.?!]$/.test(w.w) || cur.length >= 20) {
      lines.push(`[${fmt(cur[0].s)}] ${cur.map(x => x.w).join(' ')}`);
      cur = [];
    }
  });
  return lines.join('\n') + '\n';
}

function save(base, transcript) {
  fs.writeFileSync(`${base}.transcript.json`, JSON.stringify(transcript));
  fs.writeFileSync(`${base}.transcript.txt`, readable(transcript.words));
  const last = transcript.words.at(-1);
  console.log(`${transcript.words.length} words over ${last ? fmt(last.e) : '0:00.0'} → ${base}.transcript.txt`);
}

// Our own transcript, or Whisper's JSON (segments[].words[] with word/start/end).
function loadTranscript(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (Array.isArray(j.words)) return j;
  if (Array.isArray(j.segments)) {
    return { words: j.segments.flatMap(s => (s.words || []).map(w => ({ w: String(w.word).trim(), s: w.start, e: w.end }))).filter(w => w.w) };
  }
  die(`${file} isn't a transcript this script knows.`);
}

const secs = t => { const p = t.replace(',', '.').split(':').map(Number); return p.reduce((a, b) => a * 60 + b, 0); };

// SRT or VTT. Cues only give a line's start and end, so words are spread across it, unless the cue carries
// YouTube's inline word times (<00:00:01.234>). YouTube's rolling auto-captions repeat the previous line in
// each cue; repeated lines are skipped.
function parseSubs(text) {
  const words = [];
  let lastLine = '';
  for (const block of text.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = block.split('\n');
    const at = lines.findIndex(l => l.includes('-->'));
    if (at < 0) continue;
    const [a, b] = lines[at].split('-->').map(x => x.trim().split(/\s/)[0]);
    const start = secs(a), end = secs(b);
    for (const raw of lines.slice(at + 1)) {
      if (!raw.trim()) continue;
      if (/<\d\d:\d\d/.test(raw)) {
        const parts = raw.split(/<(\d\d:\d\d:\d\d\.\d+)>/);
        let t = start;
        for (let i = 0; i < parts.length; i += 2) {
          if (i > 0) t = secs(parts[i - 1]);
          for (const w of parts[i].replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean)) words.push({ w, s: t, e: t });
        }
        lastLine = raw.replace(/<[^>]+>/g, '').trim();
        continue;
      }
      const clean = raw.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<').trim();
      if (!clean || clean === lastLine) continue;
      lastLine = clean;
      const ws = clean.split(/\s+/);
      const step = (end - start) / ws.length;
      ws.forEach((w, i) => words.push({ w, s: start + i * step, e: start + (i + 1) * step }));
    }
  }
  words.sort((x, y) => x.s - y.s);
  // Words with only a start time end where the next one starts.
  words.forEach((w, i) => { if (w.e <= w.s) w.e = Math.min(w.s + 0.6, words[i + 1]?.s ?? w.s + 0.6); });
  return { words };
}

const duration = file => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());

// Caption lines: short groups of words, broken at pauses and sentence ends.
function captionLines(words, max) {
  const lines = [];
  let cur = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    if (!next || cur.length >= max || next.s - w.e > 0.35 || /[.?!,]$/.test(w.w)) { lines.push(cur); cur = []; }
  });
  return lines;
}

const assTime = t => {
  const cs = Math.max(0, Math.round(t * 100));
  return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};
const assText = s => s.replace(/\\/g, '\\\\').replace(/[{}]/g, '');
// #RRGGBB → ASS &HBBGGRR&
const assColour = hex => { const h = hex.replace('#', ''); return `&H${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`; };

// One subtitle event per spoken word, so the word being said lights up and pops.
function buildAss(moment, words, o) {
  const len = moment.end - moment.start;
  const hi = assColour(o.colour);
  const capY = o.layout === 'blur' ? 470 : 620;
  const events = [];
  const lines = captionLines(words, o.words);
  lines.forEach((line, n) => {
    // A line lingers a moment after its last word, but never under the next line.
    const lineEnd = Math.min(line.at(-1).e + 0.25, lines[n + 1]?.[0].s ?? len, len);
    line.forEach((w, i) => {
      // Each word's event runs until the next word starts, so the line never blinks between words.
      const from = w.s;
      const to = i === line.length - 1 ? lineEnd : line[i + 1].s;
      if (to <= from) return;
      const text = line.map((x, j) => {
        const t = assText(o.upper ? x.w.toUpperCase() : x.w);
        return j === i ? `{\\c${hi}\\fscx112\\fscy112}${t}{\\c&HFFFFFF&\\fscx100\\fscy100}` : t;
      }).join(' ');
      events.push(`Dialogue: 0,${assTime(from)},${assTime(to)},Cap,,0,0,0,,${text}`);
    });
  });
  if (moment.hook) events.push(`Dialogue: 1,${assTime(0)},${assTime(Math.min(3, len))},Hook,,0,0,0,,{\\fad(0,200)}${assText(moment.hook)}`);
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,${o.font},${o.size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,7,2,2,80,80,${capY},1
Style: Hook,${o.font},64,&H00000000,&H00000000,&H00FFFFFF,&H00FFFFFF,-1,0,0,0,100,100,0,0,3,18,0,8,90,90,230,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join('\n')}
`;
}

// crop fills the frame (pan with x: 0 = left, 0.5 = centre, 1 = right); blur shows the whole picture
// over a blurred copy of itself, which keeps gameplay HUDs and wide shots in view.
function videoFilter(layout, x) {
  if (layout === 'blur') {
    return '[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2,eq=brightness=-0.08[bg];' +
      '[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1';
  }
  return `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:(iw-1080)*${x}:(ih-1920)/2,setsar=1`;
}

const slug = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40);

if (cmd === 'transcribe') {
  if (!opt.video) die('transcribe needs --video.');
  const base = stem(opt.video);
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rsv-whisper-'));
  const pcm = path.join(TMP, 'audio.pcm'), json = path.join(TMP, 'words.json');
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.resolve(opt.video), '-vn', '-ac', '1', '-ar', '16000', '-f', 's16le', pcm]);
    console.log(`Transcribing ${path.basename(opt.video)} with faster-whisper (${opt.model || 'small'})…`);
    try {
      execFileSync('python3', ['-I', path.join(here, 'transcribe.py'), pcm, json, opt.model || '', opt.lang || ''], { stdio: 'inherit' });
    } catch {
      die('Transcribing failed. Install faster-whisper (pip install faster-whisper), or use the video\'s subtitles: clip.mjs import --subs file.vtt');
    }
    save(base, loadTranscript(json));
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
} else if (cmd === 'import') {
  if (!opt.subs) die('import needs --subs (an .srt or .vtt file).');
  const base = opt.video ? stem(opt.video) : stem(opt.subs);
  save(base, parseSubs(fs.readFileSync(opt.subs, 'utf8')));
} else if (cmd === 'cut') {
  if (!opt.video || !opt.moments) die('cut needs --video and --moments.');
  const video = path.resolve(opt.video);
  const base = stem(video);
  const tfile = opt.transcript || `${base}.transcript.json`;
  if (!fs.existsSync(tfile)) die(`No transcript at ${tfile}. Run transcribe or import first.`);
  const { words } = loadTranscript(tfile);
  let moments;
  try { moments = JSON.parse(fs.readFileSync(opt.moments, 'utf8')); } catch (e) { die(`Can't read ${opt.moments}: ${e.message}`); }
  if (!Array.isArray(moments) || !moments.length) die('--moments must be a JSON array of { start, end, title, hook?, caption?, x? }.');
  const total = duration(video);
  const o = {
    layout: opt.layout === 'blur' ? 'blur' : 'crop',
    words: Number(opt.words) || 3,
    upper: !!opt.upper,
    colour: opt.colour || '#FFD54A',
    font: opt.font || 'Arial Black',
    size: Number(opt.size) || 84,
  };
  const outDir = path.resolve(opt.out || `${base}-clips`);
  fs.mkdirSync(outDir, { recursive: true });
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rsv-clips-'));
  const posts = [`# Clips from ${path.basename(video)}\n`];
  try {
    moments.forEach((m, i) => {
      const start = typeof m.start === 'string' ? secs(m.start) : Number(m.start);
      const end = typeof m.end === 'string' ? secs(m.end) : Number(m.end);
      const n = String(i + 1).padStart(2, '0');
      if (!(end > start) || start >= total) return console.warn(`Skipping moment ${n}: start/end don't fit the video (${fmt(total)} long).`);
      const clip = { ...m, start, end: Math.min(end, total) };
      const len = clip.end - clip.start;
      if (len > 90) console.warn(`Moment ${n} is ${len.toFixed(0)} s; most campaigns want under 60.`);
      const inside = words.filter(w => w.s >= clip.start - 0.05 && w.e <= clip.end + 0.3)
        .map(w => ({ w: w.w, s: Math.max(0, w.s - clip.start), e: Math.min(len, w.e - clip.start) }));
      fs.writeFileSync(path.join(TMP, `${n}.ass`), buildAss(clip, inside, o));
      const file = `${n}-${slug(m.title) || 'clip'}.mp4`;
      const x = Math.min(1, Math.max(0, m.x ?? 0.5));
      console.log(`${n}  ${fmt(clip.start)}–${fmt(clip.end)}  ${m.title || ''}`);
      // The subtitle file goes in by bare name from the temp folder, so its path never needs filter escaping.
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(clip.start), '-i', video, '-t', String(len),
        '-filter_complex', `${videoFilter(o.layout, x)},ass=${n}.ass[v]`, '-map', '[v]', '-map', '0:a?',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30',
        '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', path.join(outDir, file)], { cwd: TMP, stdio: ['ignore', 'inherit', 'inherit'] });
      posts.push(`## ${n}. ${m.title || 'Clip'}\n\n- File: \`${file}\`\n- From ${fmt(clip.start)} to ${fmt(clip.end)} (${len.toFixed(0)} s)\n${m.caption ? `\n${m.caption}\n` : ''}`);
    });
    fs.writeFileSync(path.join(outDir, 'posts.md'), posts.join('\n'));
    if (opt.keep) fs.cpSync(TMP, path.join(outDir, 'captions'), { recursive: true });
    console.log(`${posts.length - 1} of ${moments.length} clips saved to ${outDir}`);
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
} else {
  die('Usage: clip.mjs transcribe --video f.mp4 | import --subs f.vtt | cut --video f.mp4 --moments m.json (see tools/clips/README.md)');
}

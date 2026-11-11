# Word-level transcript of a video for clip.mjs, with faster-whisper (pip install faster-whisper).
#   python3 tools/clips/transcribe.py audio.pcm long.transcript.json [model] [language]
# audio.pcm is 16 kHz mono 16-bit audio, which clip.mjs makes with ffmpeg; reading it here skips PyAV, whose
# newer releases break faster-whisper's own decoder. Writes {"language": "en", "words": [{"w": "Hello", "s": 0.32, "e": 0.61}, ...]}.
import json
import sys

import numpy as np
from faster_whisper import WhisperModel

pcm, out = sys.argv[1], sys.argv[2]
model = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else "small"
language = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else None

audio = np.fromfile(pcm, dtype=np.int16).astype(np.float32) / 32768.0
segments, info = WhisperModel(model, device="auto", compute_type="default").transcribe(
    audio, word_timestamps=True, language=language, vad_filter=True
)
words = []
for segment in segments:
    for w in segment.words or []:
        if w.word.strip():
            words.append({"w": w.word.strip(), "s": round(w.start, 2), "e": round(w.end, 2)})
    print(f"\r{segment.end / 60:.1f} min transcribed", end="", file=sys.stderr, flush=True)
print(file=sys.stderr)
with open(out, "w", encoding="utf-8") as f:
    json.dump({"language": info.language, "words": words}, f, ensure_ascii=False)

# 20-second promo video (motion graphics)

Source for `assets/promo-20s.mp4` (1920×1080, 30 fps, 20 s), the vertical Shorts/Reels version `assets/promo-shorts-20s.mp4` (1080×1920) and `assets/promo-preview.gif`. Both videos share one timeline and one soundtrack.

- `capture.js` — opens the app (`../index.html`) in English and saves real screenshots used in the video (`*.png`, `info.json`). The results scene uses the real values from this run (attempts, time, DFI and metric scores); update the numbers in `index.html` (`METS`, counter targets, "in 0.41 seconds") if they change.
- `index.html` — the motion-graphics page. Every movement is a CSS animation whose delay is an absolute time on the 20 s timeline.
- `music.py` — synthesizes the original soundtrack (`music.wav`) with numpy only — no samples or third-party audio, so there are no licensing issues. A steady background bed (120 BPM, A minor, Am–F–C–G, exactly 10 bars) runs the whole 20 s; short sound effects (pop, click, whoosh, chime) are added only at the moments the video highlights.
- `render.js` — seeks all animations frame by frame (`document.getAnimations()`), screenshots each of the 600 frames, pipes them to ffmpeg, then muxes `music.wav` (loudness-normalised to −14 LUFS, −1 dBTP) into `assets/promo-20s.mp4`.

```bash
node promo/capture.js
```

```bash
python3 promo/music.py
```

```bash
node promo/render.js full
```

```bash
node promo/render.js full vert
```

The vertical version opens the same `index.html` with `?vert`; only the CSS layout changes. Key content stays inside y 140–1540 and x 60–940 so it isn't covered by the Shorts/Reels interface.

```bash
ffmpeg -y -i assets/promo-20s.mp4 -vf "fps=10,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" assets/promo-preview.gif
```

Requires Playwright (Chromium) and ffmpeg. `qr.svg` points to https://onlymarch.github.io/dutywebapp/. The video has a stereo AAC soundtrack; the GIF preview is silent.

## 30-second guide videos (English, Korean)

`assets/guide-en-30s.mp4` and `assets/guide-ko-30s.mp4` — 1920×1080, 30 fps, 30 s, no audio. They walk through the five steps on real app screens with an animated cursor, highlight boxes, camera zoom and captions.

- `guide-capture.js` — puts the app into each step's state in English and Korean and saves 1920×1080 screenshots plus the on-screen position of every button the cursor points at (`guide/<lang>/manifest.json`).
- `guide.html` — one scene file for both languages (`?lang=en|ko`); captions, cursor path, highlights and camera are a single timeline, and every position is computed from the manifest, so re-capturing keeps everything aligned.
- `guide-render.js` — renders 900 frames per language.

```bash
node promo/guide-capture.js
```

```bash
node promo/guide-render.js full en
```

```bash
node promo/guide-render.js full ko
```

# 20-second promo video (motion graphics)

Source for `assets/promo-20s.mp4` (1920×1080, 30 fps, 20 s) and `assets/promo-preview.gif`.

- `capture.js` — opens the app (`../index.html`) in English and saves real screenshots used in the video (`*.png`, `info.json`). The results scene uses the real values from this run (attempts, time, DFI and metric scores); update the numbers in `index.html` (`METS`, counter targets, "in 0.41 seconds") if they change.
- `index.html` — the motion-graphics page. Every movement is a CSS animation whose delay is an absolute time on the 20 s timeline.
- `render.js` — seeks all animations frame by frame (`document.getAnimations()`), screenshots each of the 600 frames and pipes them to ffmpeg.

```bash
node promo/capture.js
```

```bash
node promo/render.js full
```

```bash
ffmpeg -y -i assets/promo-20s.mp4 -vf "fps=10,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" assets/promo-preview.gif
```

Requires Playwright (Chromium) and ffmpeg. `qr.svg` points to https://onlymarch.github.io/dutywebapp/. The video has no audio track.

#!/usr/bin/env python3
"""가이드 영상에 ElevenLabs 내레이션을 합칩니다.

사용: python3 promo/narrate.py en|ko
  입력: promo/narration/<lang>-<키>.mp3   (문장별 음성, ElevenLabs eleven_v4)
        assets/guide-<lang>-30s.mp4       (node promo/guide-render.js full <lang> 결과, 무음)
  출력: assets/guide-<lang>-30s.mp4 에 음성 트랙을 넣어 덮어씀 (원본 무음 영상은 promo/narration/silent-<lang>.mp4 로 보관)

배치 규칙
  - 각 문장은 앞뒤 무음을 잘라 낸 뒤, 자막 구간 시작 시각(SLOTS)에 맞춰 놓습니다.
  - 앞 문장이 길어 겹치면 앞 문장이 끝난 뒤 GAP초 뒤로 밉니다.
  - 다음 구간 시작 + SPILL초 안에 끝나지 않으면 atempo로 최대 MAX_TEMPO배까지 빠르게 합니다.
  - 마지막 문장이 30초를 넘으면 마지막 화면(끝 카드)을 그만큼 더 보여 줍니다(마지막 프레임 정지, tpad).
"""
import json, os, subprocess, sys, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'promo', 'narration')
LANG = sys.argv[1] if len(sys.argv) > 1 else 'en'
SR, GAP, SPILL, MAX_TEMPO, DUR = 48000, 0.12, 0.45, 1.25, 30.0

# 키, 자막 구간 시작(초) — promo/guide.html 의 CAPS 시간표와 같음 (00: 제목 화면, zz: 마지막 화면)
SLOTS = [('00', 0.4), ('1a', 2.7), ('1b', 5.0), ('2a', 7.6), ('2b', 9.0), ('2c', 11.8), ('3a', 14.6), ('3b', 16.4),
         ('4a', 18.6), ('4b', 20.0), ('4c', 22.0), ('4d', 23.6), ('5a', 25.2), ('5b', 26.6), ('zz', 28.6)]

def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True)

def trimmed(src, dst, tempo=1.0):
    """앞뒤 무음 제거(+선택적 속도 조절) → 48 kHz 모노 WAV. 길이(초) 반환"""
    af = ('silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,'
          'areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse')
    if tempo > 1.0001: af += f',atempo={tempo:.4f}'
    run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-af', af, '-ar', str(SR), '-ac', '1', dst])
    return float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dst]).stdout)

tmp = os.path.join(D, 'tmp'); os.makedirs(tmp, exist_ok=True)
plan, prev_end = [], 0.0
for i, (k, slot) in enumerate(SLOTS):
    src = os.path.join(D, f'{LANG}-{k}.mp3'); wav = os.path.join(tmp, f'{LANG}-{k}.wav')
    L = trimmed(src, wav)
    start = max(slot, prev_end + GAP)
    limit = SLOTS[i + 1][1] + SPILL if i + 1 < len(SLOTS) else start + 99   # 마지막 문장은 속도를 바꾸지 않음(끝 카드를 늘림)
    tempo = 1.0
    if start + L > limit:
        tempo = min(MAX_TEMPO, L / max(0.3, limit - start))
        L = trimmed(src, wav, tempo)
    plan.append({'key': k, 'slot': slot, 'start': round(start, 3), 'len': round(L, 3), 'tempo': round(tempo, 3)})
    prev_end = start + L

# 끝 카드 연장: 마지막 문장 뒤 0.6초 여유
OUT = max(DUR, round(prev_end + 0.6, 1)); EXT = round(OUT - DUR, 2)

# 한 트랙으로 합치기: 각 문장을 adelay로 제 위치에 놓고 amix(normalize=0)로 겹침 없이 더함
inputs, filt = [], []
for j, p in enumerate(plan):
    inputs += ['-i', os.path.join(tmp, f"{LANG}-{p['key']}.wav")]
    ms = int(p['start'] * 1000); filt.append(f'[{j}]adelay={ms}|{ms}[a{j}]')
filt.append(''.join(f'[a{j}]' for j in range(len(plan))) + f'amix=inputs={len(plan)}:normalize=0,apad,atrim=0:{OUT},'
            'loudnorm=I=-16:TP=-1.5:LRA=11[out]')
mix = os.path.join(D, f'mix-{LANG}.wav')
run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', ';'.join(filt), '-map', '[out]', '-ar', str(SR), '-ac', '2', mix])

# 영상에 합치기 (무음 원본은 따로 보관해 다시 실행해도 음성이 두 번 들어가지 않게 함)
vid = os.path.join(ROOT, 'assets', f'guide-{LANG}-30s.mp4'); silent = os.path.join(D, f'silent-{LANG}.mp4')
has_audio = run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', vid]).stdout.strip()
if not has_audio: shutil.copyfile(vid, silent)
vopt = ['-c:v', 'copy'] if EXT <= 0 else ['-vf', f'tpad=stop_mode=clone:stop_duration={EXT}', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p']
run(['ffmpeg', '-y', '-v', 'error', '-i', silent, '-i', mix, '-map', '0:v', '-map', '1:a', *vopt,
     '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', vid])
shutil.rmtree(tmp)
json.dump(plan, open(os.path.join(D, f'plan-{LANG}.json'), 'w'), indent=1)
for p in plan: print(f"{p['key']:>3}  slot {p['slot']:5.2f}  start {p['start']:6.2f}  len {p['len']:5.2f}  tempo {p['tempo']}")
print('done', vid, f'{OUT}s' + (f' (끝 카드 +{EXT}s)' if EXT > 0 else ''))

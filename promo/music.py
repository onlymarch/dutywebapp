"""
20초 소개 영상용 오리지널 배경음악 합성 (외부 음원·샘플 없음 → 저작권 문제 없음)
사용: python3 promo/music.py  →  promo/music.wav (44.1kHz, 16bit, 스테레오, 정확히 20.0초)

구성: 128BPM, A단조 Am–F–C–G. 영상(promo/index.html)의 장면 시각에 맞춰 효과음을 넣습니다.
  0–2.55  문제   낮은 드론 + 째깍 소리, 1.25 "BY HAND." 임팩트
  2.55–4.05 혼란 빨라지는 하이햇, 단어마다 불협 스탭, 상승음 → 4.05 섬광 타격
  4.2–6.0 등장   패드 + 벨 아르페지오 + 상승음
  6.0–9.0 입력   드롭: 킥·클랩·하이햇·베이스·아르페지오
  9.0–11.8 생성  스네어 롤 → 9.7 버튼 클릭 → 9.9–11.0 상승 스윕 → 11.0 임팩트
  11.8–15.0 결과 풀 비트 + 리드, 13.1~ 지표 블립, 13.6 배지 차임
  15.0–17.2 언어 언어 전환 6번(15.15 + 0.31×i)에 스탭
  17.2–20.0 마무리 임팩트 + "Free."(17.35) 히트 + 마지막 화음 여운, 페이드아웃
"""
import numpy as np, wave, os

SR = 44100
DUR = 20.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)           # 스테레오 버스
duck_src = []                              # 사이드체인(킥 시각)

BPM = 128; B = 60 / BPM; S16 = B / 4

def t_(sec): return np.arange(int(sec * SR)) / SR
def add(sig, at, gain=1.0, pan=0.0):
    """sig를 at초에 더함. pan -1(왼)~1(오)"""
    i = int(at * SR)
    if i >= N: return
    sig = sig[:N - i] * gain
    L[i:i + len(sig)] += sig * np.sqrt((1 - pan) / 2) * 1.414
    R[i:i + len(sig)] += sig * np.sqrt((1 + pan) / 2) * 1.414
def env(n, a=0.005, d=0.2, s=0.0, r=0.05, hold=0.0):
    a_n, d_n = max(1, int(a * SR)), max(1, int(d * SR))
    e = np.zeros(n)
    e[:a_n] = np.linspace(0, 1, a_n)[:n]
    if n > a_n:
        k = np.arange(n - a_n) / SR
        e[a_n:] = s + (1 - s) * np.exp(-k / max(d, 1e-4))
    return e
def onepole_lp(x, cutoff):
    """1차 저역 통과. cutoff는 스칼라 또는 배열(Hz, 시간에 따라 변함)"""
    c = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x); z = 0.0
    for i in range(len(x)):
        z += a[i] * (x[i] - z); y[i] = z
    return y
def hp(x): return np.diff(x, prepend=0.0)
def saw(f, t): return 2 * ((t * f) % 1.0) - 1
def note(n): return 440.0 * 2 ** ((n - 69) / 12)   # MIDI → Hz

# ---------------- 악기 ----------------
def kick(gain=1.0):
    t = t_(0.45); f = 45 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t / 0.16) + 0.4 * rng.standard_normal(len(t)) * np.exp(-t / 0.004)) * gain
def clap():
    t = t_(0.25); n = hp(rng.standard_normal(len(t)))
    e = np.exp(-t / 0.06); e[:int(.012 * SR)] *= 1.6
    return n * e * 0.55 + np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.25
def hat(open_=False):
    t = t_(0.18 if open_ else 0.05); n = hp(hp(rng.standard_normal(len(t))))
    return n * np.exp(-t / (0.06 if open_ else 0.012)) * 0.35
def tick():
    t = t_(0.06); return np.sin(2 * np.pi * 1900 * t) * np.exp(-t / 0.008) * 0.5 + hp(rng.standard_normal(len(t))) * np.exp(-t / 0.003) * 0.2
def impact(size=1.0):
    t = t_(2.2 * size)
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t / 0.08)) / SR) * np.exp(-t / (0.6 * size))
    nz = onepole_lp(rng.standard_normal(len(t)), 3000) * np.exp(-t / 0.25) * 0.8
    return (boom * 1.1 + nz) * 0.9
def rev_cymbal(dur):
    t = t_(dur); n = hp(rng.standard_normal(len(t)))
    return n * (t / dur) ** 3 * 0.6
def riser(dur, f0=200, f1=6000):
    t = t_(dur); cut = f0 * (f1 / f0) ** (t / dur)
    n = onepole_lp(rng.standard_normal(len(t)), cut)
    sw = np.sin(2 * np.pi * np.cumsum(110 * 8 ** (t / dur)) / SR) * 0.25
    return (n * 1.4 + sw) * (t / dur) ** 2
def pluck(freq, dur=0.22, bright=4000, sq=False):
    t = t_(dur)
    w = np.sign(np.sin(2 * np.pi * freq * t)) if sq else saw(freq, t) + saw(freq * 1.006, t)
    return onepole_lp(w * 0.5, bright * np.exp(-t / 0.08) + 300) * env(len(t), 0.002, 0.12)
def bell(freq, dur=1.2):
    t = t_(dur)
    s = np.sin(2 * np.pi * freq * t) + 0.5 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t / 0.2) + 0.3 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t / 0.08)
    return s * np.exp(-t / 0.45) * 0.35
def pad(freqs, dur, cutoff=1800, att=0.3):
    t = t_(dur); s = np.zeros(len(t))
    for f in freqs:
        for d in (-0.08, 0.0, 0.08):
            s += saw(f * 2 ** (d / 12), t + rng.random())
    s = onepole_lp(s / (len(freqs) * 3), cutoff)
    e = np.minimum(1, t / att) * np.minimum(1, (dur - t) / 0.15)
    return s * e
def bass(freq, dur):
    t = t_(dur); w = saw(freq, t) * 0.6 + np.sin(2 * np.pi * freq / 2 * t) * 0.6
    return onepole_lp(w, 900 * np.exp(-t / 0.1) + 180) * env(len(t), 0.003, 0.25, 0.6) * np.minimum(1, (dur - t) / 0.02)
def stab(freqs, dur=0.25, gain=1.0, dis=False):
    t = t_(dur); s = sum(saw(f, t) + saw(f * (1.03 if dis else 1.004), t) for f in freqs) / len(freqs)
    return onepole_lp(s, 5000 * np.exp(-t / 0.07) + 400) * env(len(t), 0.002, 0.11) * gain

# 화음 (MIDI): Am, F, C, G
CH = {'Am': [57, 60, 64], 'F': [53, 57, 60], 'C': [48, 52, 55, 60], 'G': [55, 59, 62]}
ROOT = {'Am': 45, 'F': 41, 'C': 48, 'G': 43}
PROG = ['Am', 'F', 'C', 'G']
def chord_at(t, start): return PROG[int((t - start) // (B * 4)) % 4]

# ================= 0–2.55 문제 =================
drone = pad([note(33), note(40), note(45)], 2.7, 400, 0.6) * 1.2
add(drone, 0.0, 0.9)
for k in range(10): add(tick(), 0.05 + k * 0.25, 0.55, -0.3 if k % 2 else 0.3)
add(riser(1.2, 100, 2500), 0.05, 0.45)
add(impact(1.0), 1.25, 1.0)
add(stab([note(45), note(46), note(52)], 0.6, 0.9, dis=True), 1.25, 0.6)
duck_src.append(1.25)

# ================= 2.55–4.05 혼란 =================
for k in range(int((4.05 - 2.55) / S16)):
    tt = 2.55 + k * S16; add(hat(), tt, 0.5 + 0.3 * (k % 2), 0.4 if k % 2 else -0.4)
for k, tt in enumerate([2.55, 2.55 + 2 * B / 2, 3.25, 3.6]):
    add(kick(0.9), tt, 0.8); duck_src.append(tt)
for tt, ch in [(2.8, [57, 58, 64]), (3.2, [53, 54, 61]), (3.6, [52, 53, 59])]:
    add(stab([note(n) for n in ch], 0.35, 1.0, dis=True), tt, 0.9, rng.uniform(-.5, .5))
    add(impact(0.35), tt, 0.35)
for k in range(12): add(tick(), 3.35 + k * 0.06, 0.35)
add(riser(1.1, 300, 9000), 2.95, 0.7)
add(rev_cymbal(0.9), 3.15, 0.6)
add(impact(1.1), 4.05, 1.0); duck_src.append(4.05)

# ================= 4.2–6.0 등장 =================
add(pad([note(n) for n in [57, 64, 69, 71, 76]], 2.0, 3500, 0.15), 4.1, 0.8)
for k, n in enumerate([69, 76, 81, 83, 88, 81, 76, 83]):
    add(bell(note(n)), 4.3 + k * S16 * 1.5, 0.55, (-1) ** k * 0.5)
add(bell(note(57) * 2, 1.6), 4.3, 0.5)
add(riser(0.85, 400, 12000), 5.15, 0.75)
add(rev_cymbal(0.5), 5.5, 0.6)

# ================= 6.0–9.0 / 11.0–17.2 비트 =================
def beat(start, end, lead=False, arp=True, full=True):
    tt = start; k = 0
    while tt < end - 1e-6:
        ch = chord_at(tt, 6.0)
        if k % 4 == 0: add(kick(), tt, 1.0); duck_src.append(tt)
        if full and k % 8 == 4: add(clap(), tt, 0.9, 0.1)
        if k % 4 == 2: add(hat(open_=(k % 16 == 14)), tt, 0.7, 0.35)
        elif full: add(hat(), tt, 0.35, -0.35)
        if k % 2 == 0: add(bass(note(ROOT[ch]), S16 * 2 * 0.95), tt, 0.85)
        if arp:
            seq = CH[ch] + [CH[ch][1] + 12]
            add(pluck(note(seq[k % len(seq)] + 12), 0.2, 5000), tt, 0.35, (-0.5, 0.5)[k % 2])
        tt += S16; k += 1
    # 패드 (화음마다)
    cs = start
    while cs < end - 1e-6:
        ch = chord_at(cs, 6.0); d = min(B * 4, end - cs)
        add(pad([note(n) for n in CH[ch]], d, 2200, 0.05), cs, 0.55)
        if lead:
            mel = {'Am': [76, 72, 69, 72], 'F': [77, 72, 69, 72], 'C': [79, 76, 72, 76], 'G': [79, 74, 71, 74]}[ch]
            for j, n in enumerate(mel):
                if cs + j * B < end: add(pluck(note(n), 0.4, 3000, sq=True), cs + j * B, 0.32, 0.15)
        cs += B * 4

add(impact(0.8), 6.0, 0.8)
beat(6.0, 9.0)

# ================= 9.0–11.8 생성 =================
add(pad([note(n) for n in CH['Am']], 2.0, 700, 0.1), 9.0, 0.6)
roll_t = 9.0; gap = 0.12
while roll_t < 9.7:
    add(clap(), roll_t, 0.35 + 0.8 * (roll_t - 9.0)); roll_t += gap; gap = max(0.03, gap * 0.85)
add(riser(0.7, 300, 8000), 9.0, 0.5)
add(tick(), 9.7, 1.0); add(kick(0.7), 9.7, 0.6)                          # 버튼 클릭
t = t_(1.1); sweep = np.sin(2 * np.pi * np.cumsum(220 * 8 ** (t / 1.1)) / SR) * (0.4 + 0.6 * t / 1.1) * 0.35
add(sweep, 9.9, 1.0)
for k in range(int(1.1 / S16)):                                          # 카운터: 상승 아르페지오
    add(pluck(note(57 + (k * 2) % 24 + 12), 0.12, 7000), 9.9 + k * S16, 0.45, (-0.6, 0.6)[k % 2])
add(impact(1.0), 11.0, 1.0); duck_src.append(11.0)
add(stab([note(n) for n in [57, 64, 69, 72]], 0.6, 1.0), 11.0, 0.8)
beat(11.0, 11.8, arp=False, full=False)

# ================= 11.8–15.0 결과 =================
add(rev_cymbal(0.4), 11.4, 0.5); add(impact(0.7), 11.8, 0.8)
beat(11.8, 15.0, lead=True)
for i in range(5): add(bell(note(76 + i * 2), 0.5), 13.1 + i * 0.12, 0.45, -0.4 + i * 0.2)   # 지표 막대
add(bell(note(88), 1.2), 13.6, 0.6); add(bell(note(81), 1.2), 13.6, 0.4)                    # 등급 배지

# ================= 15.0–17.2 6개 언어 =================
beat(15.0, 17.2, arp=False)
LANG_CH = [[57, 64, 69], [53, 60, 65], [48, 55, 64], [55, 62, 67], [57, 64, 72], [53, 60, 69]]
for i, ch in enumerate(LANG_CH):
    tt = 15.15 + 0.31 * i
    add(stab([note(n) for n in ch], 0.28, 1.0), tt, 0.85, (-0.5, 0.5)[i % 2])
    add(hp(rng.standard_normal(int(.08 * SR))) * np.exp(-t_(0.08) / 0.02) * 0.4, tt, 0.6)
add(riser(0.5, 500, 12000), 16.7, 0.6)

# ================= 17.2–20.0 마무리 =================
add(impact(1.4), 17.2, 1.0); duck_src.append(17.2)
add(stab([note(n) for n in [48, 55, 60, 64, 67]], 0.5, 1.0), 17.35, 1.0)                # "Free."
add(pad([note(n) for n in [48, 55, 60, 64, 67, 72]], 2.75, 2600, 0.05), 17.2, 0.85)
add(bass(note(36), 2.6), 17.2, 0.8)
for k, n in enumerate([72, 76, 79, 84, 79, 76, 72, 67]):
    add(bell(note(n)), 17.9 + k * S16 * 2, 0.4, (-1) ** k * 0.4)
for k in range(4): add(kick(0.8), 17.8 + k * B, 0.7); duck_src.append(17.8 + k * B)
add(bell(note(60) * 2, 2.0), 19.0, 0.5)

# ---------------- 사이드체인(킥마다 패드·전체를 살짝 눌러 펌핑감) ----------------
duck = np.ones(N)
for tt in duck_src:
    i = int(tt * SR); n = min(int(0.22 * SR), N - i)
    if n > 0: duck[i:i + n] = np.minimum(duck[i:i + n], 1 - 0.35 * np.exp(-np.arange(n) / SR / 0.07))
L *= duck; R *= duck

# ---------------- 잔향(합성 임펄스 응답, FFT 컨볼루션) ----------------
def reverb(x, sec=1.1, mix=0.18, seed=1):
    ir = np.random.default_rng(seed).standard_normal(int(sec * SR)) * np.exp(-np.arange(int(sec * SR)) / SR / (sec / 5))
    ir = onepole_lp(ir, 5000); ir /= np.sqrt(np.sum(ir ** 2))
    m = len(x) + len(ir); nfft = 1 << (m - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[:len(x)]
    return x + y * mix
L = reverb(L, seed=1); R = reverb(R, seed=2)

# ---------------- 마스터: 정규화 → 부드러운 클리핑 → 끝 페이드 ----------------
fade = np.ones(N); fs = int(19.0 * SR); fade[fs:] = np.linspace(1, 0, N - fs) ** 1.5
fin = np.ones(N); fin[:int(.02 * SR)] = np.linspace(0, 1, int(.02 * SR))
mx = max(np.max(np.abs(L)), np.max(np.abs(R)))
L = np.tanh(L / mx * 1.6) / np.tanh(1.6) * 0.92 * fade * fin
R = np.tanh(R / mx * 1.6) / np.tanh(1.6) * 0.92 * fade * fin

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'music.wav')
pcm = (np.stack([L, R], 1) * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', out, f'{N / SR:.2f}s', 'peak', float(np.max(np.abs(pcm))) / 32767)

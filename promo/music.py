"""
20초 소개 영상용 오리지널 배경음악 + 효과음 합성 (외부 음원·샘플 없음 → 저작권 문제 없음)
사용: python3 promo/music.py  →  promo/music.wav (44.1kHz, 16bit, 스테레오, 정확히 20.0초)

설계 원칙
  1) 배경음악(BED)은 처음부터 끝까지 끊기지 않는 하나의 흐름입니다.
     120BPM → 1마디 = 2초, 20초 = 정확히 10마디. Am–F–C–G 진행 반복.
     0–4초는 패드·베이스·가벼운 킥만, 4초(로고 등장)부터 하이햇·아르페지오가 더해져 조금 밝아집니다.
     드롭·정지·불협음·스네어 롤 없음. 마지막 1초는 으뜸화음 여운으로 페이드아웃.
  2) 효과음(SFX)은 화면에서 강조되는 순간에만 짧게 넣습니다: 톡(pop)·딸깍(click)·쉭(whoosh)·띵(chime).
     시각은 영상(promo/index.html, 가로·세로 공통 타임라인)과 같습니다.
"""
import numpy as np, wave, os

SR = 44100; DUR = 20.0; N = int(SR * DUR)
rng = np.random.default_rng(11)
BED_L = np.zeros(N); BED_R = np.zeros(N)       # 배경음악 버스
FX_L = np.zeros(N);  FX_R = np.zeros(N)        # 효과음 버스 (사이드체인·잔향 따로)

BPM = 120; B = 60 / BPM; BAR = 4 * B; E8 = B / 2

def t_(sec): return np.arange(int(sec * SR)) / SR
def put(bus, sig, at, gain=1.0, pan=0.0):
    Lb, Rb = bus; i = int(round(at * SR))
    if i >= N: return
    if i < 0: sig = sig[-i:]; i = 0          # 0초보다 앞에서 시작하는 소리는 앞부분을 잘라 넣음
    sig = sig[:N - i] * gain
    Lb[i:i + len(sig)] += sig * np.sqrt((1 - pan) / 2) * 1.414
    Rb[i:i + len(sig)] += sig * np.sqrt((1 + pan) / 2) * 1.414
BED = (BED_L, BED_R); FX = (FX_L, FX_R)
def onepole_lp(x, cutoff):
    c = np.broadcast_to(np.asarray(cutoff, float), x.shape); a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x); z = 0.0
    for i in range(len(x)): z += a[i] * (x[i] - z); y[i] = z
    return y
def hp(x): return np.diff(x, prepend=0.0)
def saw(f, t): return 2 * ((t * f) % 1.0) - 1
def note(n): return 440.0 * 2 ** ((n - 69) / 12)
def fadeio(n, a=0.004, r=0.02):
    e = np.ones(n); ai, ri = min(n, int(a * SR)), min(n, int(r * SR))
    e[:ai] = np.linspace(0, 1, ai); e[n - ri:] *= np.linspace(1, 0, ri); return e

# ---------------- 배경음악 악기 (부드럽게) ----------------
def kick(g=1.0):
    t = t_(0.35); ph = 2 * np.pi * np.cumsum(48 + 70 * np.exp(-t / 0.03)) / SR
    return np.sin(ph) * np.exp(-t / 0.13) * g
def hat(g=1.0):
    t = t_(0.05); return hp(hp(rng.standard_normal(len(t)))) * np.exp(-t / 0.012) * 0.22 * g
def shaker(g=1.0):
    t = t_(0.09); n = hp(rng.standard_normal(len(t))); e = np.sin(np.pi * np.minimum(1, t / 0.09)) ** 2
    return n * e * 0.12 * g
def pad(freqs, dur, cutoff):
    t = t_(dur); s = np.zeros(len(t))
    for f in freqs:
        for d in (-0.07, 0.0, 0.07): s += saw(f * 2 ** (d / 12), t + rng.random())
    s = onepole_lp(s / (len(freqs) * 3), cutoff)
    return s * fadeio(len(t), 0.25, 0.25)
def bass(f, dur):
    t = t_(dur); w = np.sin(2 * np.pi * f * t) * 0.8 + saw(f, t) * 0.25
    return onepole_lp(w, 600) * np.exp(-t / 0.6) * fadeio(len(t), 0.005, 0.03)
def pluck(f, dur=0.35):
    t = t_(dur); w = saw(f, t) + saw(f * 1.005, t)
    return onepole_lp(w * 0.4, 2600 * np.exp(-t / 0.09) + 250) * np.exp(-t / 0.18) * fadeio(len(t), 0.002, 0.03)

CH = {'Am': [57, 60, 64], 'F': [53, 57, 60], 'C': [55, 60, 64], 'G': [55, 59, 62]}
ROOT = {'Am': 33, 'F': 29, 'C': 36, 'G': 31}
PROG = ['Am', 'F', 'C', 'G']
ARP = [0, 1, 2, 1, 2, 3, 2, 1]          # 화음 음 순서 (8분음표)

for bar in range(10):
    t0 = bar * BAR; ch = PROG[bar % 4]
    last = bar == 9
    chord = CH['Am'] if last else CH[ch]
    root = ROOT['Am'] if last else ROOT[ch]
    # 패드: 처음 2마디는 어둡게, 이후 조금 밝게 (끊김 없이 이어짐)
    cut = 900 if bar < 2 else 1600
    put(BED, pad([note(n) for n in chord], BAR + 0.25, cut), t0 - 0.05, 0.55)
    # 베이스: 4분음표 (마지막 마디는 길게)
    if last: put(BED, bass(note(root), BAR), t0, 0.7)
    else:
        for k in range(4): put(BED, bass(note(root), B * 0.95), t0 + k * B, 0.6 if k % 2 else 0.7)
    # 킥: 매 박 (처음 2마디는 약하게), 마지막 마디는 첫 박만
    for k in range(1 if last else 4): put(BED, kick(0.55 if bar < 2 else 0.8), t0 + k * B, 1.0)
    if bar >= 2 and not last:
        for k in range(8):
            put(BED, hat(1.0 if k % 2 else 0.5), t0 + k * E8, 1.0, 0.3 if k % 2 else -0.3)
            put(BED, shaker(), t0 + k * E8 + E8 / 2, 1.0, -0.2)
        tones = chord + [chord[0] + 12]
        for k in range(8): put(BED, pluck(note(tones[ARP[k] % len(tones)] + 12)), t0 + k * E8, 0.3, (-0.4, 0.4)[k % 2])

# 사이드체인: 킥마다 배경을 살짝 눌러 리듬감 (효과음 버스에는 적용 안 함)
duck = np.ones(N)
for k in range(40):
    i = int(k * B * SR); n = min(int(0.2 * SR), N - i)
    duck[i:i + n] = np.minimum(duck[i:i + n], 1 - 0.22 * np.exp(-np.arange(n) / SR / 0.08))
BED_L *= duck; BED_R *= duck

# ---------------- 효과음 (짧고 또렷하게) ----------------
def pop(f=900, g=1.0):                         # 톡: 칩·카드·팝오버 등장
    t = t_(0.09); f_ = f * (1 + 0.6 * np.exp(-t / 0.012))
    return np.sin(2 * np.pi * np.cumsum(f_) / SR) * np.exp(-t / 0.03) * 0.55 * g
def click(g=1.0):                              # 딸깍: 버튼 누름
    t = t_(0.04); return (np.sin(2 * np.pi * 2200 * t) * 0.6 + hp(rng.standard_normal(len(t))) * 0.4) * np.exp(-t / 0.006) * g
def whoosh(dur=0.45, g=1.0, up=True):          # 쉭: 화면 전환·슬라이드
    t = t_(dur); x = t / dur
    cut = 400 + 5000 * (x if up else 1 - x) ** 1.5
    n = onepole_lp(rng.standard_normal(len(t)), cut) - onepole_lp(rng.standard_normal(len(t)), 150) * 0.3
    return n * np.sin(np.pi * x) ** 2 * 0.7 * g
def chime(freqs, dur=0.9, g=1.0):              # 띵: 성공·결과 강조
    t = t_(dur); s = sum(np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.15) for f in freqs)
    return s / len(freqs) * np.exp(-t / 0.35) * fadeio(len(t), 0.002, 0.05) * 0.45 * g
def thump(g=1.0):                              # 둥: "BY HAND." 강조 (낮고 짧게)
    t = t_(0.4); ph = 2 * np.pi * np.cumsum(55 + 90 * np.exp(-t / 0.025)) / SR
    return (np.sin(ph) * np.exp(-t / 0.12) + onepole_lp(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.02) * 0.5) * 0.9 * g
def tickup(i, g=1.0):                          # 카운터 틱: 점점 높아짐
    t = t_(0.03); return np.sin(2 * np.pi * (1200 + i * 90) * t) * np.exp(-t / 0.008) * 0.35 * g

C = lambda m: note(m)
# S1 문제
put(FX, whoosh(0.35, 0.5), 0.12)                       # "Every month," 등장
put(FX, thump(), 1.25)                                 # BY HAND.
# S2 혼란: 단어마다 톡
for k, tt in enumerate([2.8, 3.2, 3.6]): put(FX, pop(620 - k * 60, 1.0), tt, 1.0, (-0.4, 0.4, 0)[k])
put(FX, whoosh(0.5, 0.8), 3.75)                        # 섬광 직전
# S3 등장
put(FX, chime([C(81), C(88)], 1.2, 1.0), 4.3)           # 로고
# S4 입력
put(FX, whoosh(0.5, 0.8), 6.05)                        # 명단 화면 슬라이드
for k in range(5): put(FX, pop(760 + k * 70, 0.7), 6.6 + k * 0.3, 1.0, -0.5)   # 칩 5개
put(FX, pop(1050, 1.0), 7.55, 1.0, 0.4)                # 날짜 팝오버
# S5 생성
put(FX, pop(700, 0.8), 9.15)                           # 버튼 등장
put(FX, click(1.0), 9.7)                               # 누름
for k in range(12): put(FX, tickup(k, 0.8), 9.9 + k * 0.09, 1.0, (-0.3, 0.3)[k % 2])   # 카운터
put(FX, chime([C(76), C(81), C(85)], 1.0, 1.1), 11.0)  # in 0.41 seconds
# S6 결과
put(FX, whoosh(0.45, 0.7, up=False), 11.8)
for k in range(5): put(FX, pop(880 + k * 110, 0.55), 13.1 + k * 0.12, 1.0, -0.4 + k * 0.2)   # 지표 막대
put(FX, chime([C(84), C(88)], 0.9, 1.0), 13.6)          # 등급 배지
# S7 6개 언어: 전환마다 톡
for i in range(6): put(FX, pop(700 + i * 80, 0.9), 15.15 + 0.31 * i, 1.0, (-0.4, 0.4)[i % 2])
# S8 마무리
put(FX, whoosh(0.4, 0.7), 17.0)
put(FX, chime([C(72), C(76), C(79), C(84)], 1.6, 1.2), 17.35)   # Free.
for k in range(4): put(FX, pop(900, 0.45), 17.8 + k * 0.12)        # 칩 4개
put(FX, pop(1150, 0.8), 18.2)                                       # QR

# ---------------- 잔향: 배경은 넉넉히, 효과음은 살짝 ----------------
def reverb(x, sec, mix, seed):
    n = int(sec * SR); ir = np.random.default_rng(seed).standard_normal(n) * np.exp(-np.arange(n) / SR / (sec / 5))
    ir = onepole_lp(ir, 5000); ir /= np.sqrt(np.sum(ir ** 2))
    m = len(x) + n; nfft = 1 << (m - 1).bit_length()
    return x + np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[:len(x)] * mix
BED_L = reverb(BED_L, 1.4, 0.22, 1); BED_R = reverb(BED_R, 1.4, 0.22, 2)
FX_L = reverb(FX_L, 0.8, 0.12, 3);   FX_R = reverb(FX_R, 0.8, 0.12, 4)

# ---------------- 믹스: 배경 일정 음량, 효과음은 그 위로 ----------------
def norm(a, b): m = max(np.max(np.abs(a)), np.max(np.abs(b))); return a / m, b / m
BED_L, BED_R = norm(BED_L, BED_R); FX_L, FX_R = norm(FX_L, FX_R)
L = BED_L * 0.62 + FX_L * 0.55; R = BED_R * 0.62 + FX_R * 0.55
fade = np.ones(N); fs = int(19.0 * SR); fade[fs:] = np.linspace(1, 0, N - fs) ** 1.5
fin = np.ones(N); fin[:int(.03 * SR)] = np.linspace(0, 1, int(.03 * SR))
L = np.tanh(L * 1.3) / np.tanh(1.3) * 0.9 * fade * fin
R = np.tanh(R * 1.3) / np.tanh(1.3) * 0.9 * fade * fin

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'music.wav')
pcm = (np.stack([L, R], 1) * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', out, f'{N / SR:.2f}s', 'peak', round(float(np.max(np.abs(pcm))) / 32767, 3))

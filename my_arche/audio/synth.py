"""synth.py — a small, deterministic numpy synthesis toolkit for the film's original score.

Everything is generated from code: oscillators, Karplus-Strong plucks, FM bells, pads, drums,
risers/whooshes, foley (phone buzz, keys, clock ticks), and an algorithmic convolution reverb.
All randomness is seeded so renders are reproducible.
"""
import numpy as np
from scipy import signal

SR = 48000


def T(sec):
    return int(round(sec * SR))


def note_hz(n):
    """MIDI note number -> Hz."""
    return 440.0 * 2 ** ((n - 69) / 12)


NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def nm(name):
    """'F#4' -> midi"""
    i = 2 if len(name) > 2 and name[1] in '#b' else 1
    return NOTE[name[:i]] + 12 * (int(name[i:]) + 1)


class Mix:
    """Stereo bus with time-addressed placement."""

    def __init__(self, dur):
        self.n = T(dur) + SR
        self.buf = np.zeros((self.n, 2), dtype=np.float64)

    def add(self, t, mono_or_st, gain=1.0, pan=0.0):
        x = mono_or_st
        if x.ndim == 1:
            l, r = pan_gains(pan)
            x = np.stack([x * l, x * r], axis=1)
        i0 = T(t)
        if i0 < 0:
            x = x[-i0:]; i0 = 0
        i1 = min(self.n, i0 + len(x))
        if i1 > i0:
            self.buf[i0:i1] += x[:i1 - i0] * gain


def pan_gains(p):
    a = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.cos(a), np.sin(a)


def rng(seed):
    return np.random.default_rng(seed)


# ---------------------------------------------------------------- envelopes
def env_adsr(n, a=0.005, d=0.1, s=0.7, r=0.2, sus_time=None):
    a_n, d_n, r_n = T(a), T(d), T(r)
    s_n = max(0, n - a_n - d_n - r_n) if sus_time is None else T(sus_time)
    e = np.concatenate([np.linspace(0, 1, max(1, a_n), endpoint=False), np.linspace(1, s, max(1, d_n), endpoint=False),
                        np.full(s_n, s), np.linspace(s, 0, max(1, r_n))])
    if len(e) < n: e = np.pad(e, (0, n - len(e)))
    return e[:n]


def env_exp(n, decay, attack=0.002):
    t = np.arange(n) / SR
    e = np.exp(-t / decay)
    a = T(attack)
    if a > 0: e[:a] *= np.linspace(0, 1, a)
    return e


def fade(x, fi=0.005, fo=0.02):
    x = x.copy(); a, b = T(fi), T(fo)
    if a: x[:a] *= np.linspace(0, 1, a)[:, None] if x.ndim == 2 else np.linspace(0, 1, a)
    if b: x[-b:] *= np.linspace(1, 0, b)[:, None] if x.ndim == 2 else np.linspace(1, 0, b)
    return x


# ---------------------------------------------------------------- oscillators
def tvec(dur):
    return np.arange(T(dur)) / SR


def sine(f, dur, phase=0.0):
    t = tvec(dur)
    if np.isscalar(f):
        return np.sin(2 * np.pi * f * t + phase)
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)


_WT = {}


def _table(kind, nh, N=4096):
    key = (kind, nh)
    if key in _WT: return _WT[key]
    ph = np.arange(N) / N
    out = np.zeros(N)
    for k in range(1, nh + 1):
        if kind == 'saw': out += np.sin(2 * np.pi * k * ph) / k
        elif kind == 'tri' and k % 2: out += ((-1) ** ((k - 1) // 2)) * np.sin(2 * np.pi * k * ph) / (k * k)
    _WT[key] = out
    return out


def _wt_play(table, f, dur, phase=0.0):
    n = T(dur); N = len(table)
    ph = (phase + f * np.arange(n) / SR) % 1.0
    idx = ph * N
    i = idx.astype(np.int64); fr = idx - i
    return table[i] * (1 - fr) + table[(i + 1) % N] * fr


def saw(f, dur, harmonics=None, phase=0.0):
    """band-limited saw from a cached wavetable (f scalar)"""
    nh = harmonics or max(1, int(16000 / max(f, 1)))
    nh = int(min(nh, 60))
    return _wt_play(_table('saw', nh), f, dur, phase) * 0.6


def tri(f, dur):
    return _wt_play(_table('tri', 11), f, dur) * 0.8


def noise(dur, seed=0):
    return rng(seed).standard_normal(T(dur))


# ---------------------------------------------------------------- filters
def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR * 0.45) / (SR / 2), 'low')
    return signal.lfilter(b, a, x, axis=0)


def hp(x, fc, order=2):
    b, a = signal.butter(order, max(fc, 10) / (SR / 2), 'high')
    return signal.lfilter(b, a, x, axis=0)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [max(lo, 10) / (SR / 2), min(hi, SR * 0.45) / (SR / 2)], 'band')
    return signal.lfilter(b, a, x, axis=0)


def sweep_lp(x, f0, f1, curve='exp'):
    """time-varying one-pole lowpass from f0 to f1 over the length of x (works for mono)."""
    n = len(x)
    if curve == 'exp':
        fc = f0 * (f1 / f0) ** np.linspace(0, 1, n)
    else:
        fc = np.linspace(f0, f1, n)
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.zeros_like(x)
    prev = 0.0
    # vectorised in blocks for speed
    blk = 256
    for i in range(0, n, blk):
        aa = a[i:i + blk].mean()
        seg, zi = signal.lfilter([1 - aa], [1, -aa], x[i:i + blk], zi=[prev * aa])
        y[i:i + blk] = seg; prev = seg[-1] if len(seg) else prev
    return y


def sweep_bp(x, f0, f1, q=2.0):
    """time-varying bandpass (block-wise biquad) — for whooshes/risers."""
    n = len(x); y = np.zeros_like(x); blk = 512
    zi = np.zeros(2)
    for i in range(0, n, blk):
        u = i / max(1, n - 1)
        fc = f0 * (f1 / f0) ** u
        w0 = 2 * np.pi * min(fc, SR * 0.45) / SR
        al = np.sin(w0) / (2 * q)
        b = np.array([al, 0, -al]); a = np.array([1 + al, -2 * np.cos(w0), 1 - al])
        b /= a[0]; a /= a[0]
        y[i:i + blk], zi = signal.lfilter(b, a, x[i:i + blk], zi=zi)
    return y


# ---------------------------------------------------------------- instruments
def pluck(f, dur=1.5, bright=0.6, seed=0, decay=0.996):
    """Karplus-Strong with a little stretch; glassy when bright high."""
    n = T(dur)
    period = max(2, int(round(SR / f)))
    r = rng(seed)
    buf = r.uniform(-1, 1, period) * 1.0
    buf = lp(buf, 1500 + bright * 9000, 1)
    out = np.zeros(n)
    idx = 0
    b = buf.copy()
    # vectorised KS by period-blocks
    for start in range(0, n, period):
        end = min(n, start + period)
        out[start:end] = b[:end - start]
        nb = decay * 0.5 * (b + np.roll(b, -1))
        nb = bright * nb + (1 - bright) * 0.5 * (nb + np.roll(nb, 1))
        b = nb
    return out * env_exp(n, dur * 0.35, 0.001)


def fm_bell(f, dur=2.5, ratio=3.5, index=3.0, decay=0.9, seed=0):
    t = tvec(dur)
    ie = index * np.exp(-t / (decay * 0.5))
    mod = np.sin(2 * np.pi * f * ratio * t) * ie
    car = np.sin(2 * np.pi * f * t + mod)
    return car * env_exp(len(t), decay, 0.002)


def glass(f, dur=2.0, seed=0):
    """FM glass + sine partial; for the cold motif."""
    return 0.7 * fm_bell(f, dur, ratio=2.0, index=1.6, decay=dur * 0.3) + 0.4 * sine(f * 2, dur) * env_exp(T(dur), dur * 0.15)


def bowl(f, dur=6.0):
    """singing-bowl / small gong: inharmonic partials, slow beating."""
    t = tvec(dur)
    parts = [(1.0, 1.0, 1.0), (2.32, 0.5, 0.6), (4.25, 0.3, 0.4), (6.63, 0.18, 0.25), (9.38, 0.1, 0.15)]
    out = np.zeros_like(t)
    for ratio, amp, dk in parts:
        beat = 1 + 0.004 * np.sin(2 * np.pi * 0.7 * t)
        out += amp * np.sin(2 * np.pi * f * ratio * beat * t) * np.exp(-t / (dur * 0.35 * dk))
    return out * env_adsr(len(t), 0.01, 0.1, 1.0, 0.5)


def pad(freqs, dur, attack=1.0, release=1.5, cutoff=2200, detune=0.25, seed=0, vowel=False):
    """detuned saw pad, stereo."""
    n = T(dur)
    L = np.zeros(n); R = np.zeros(n)
    r = rng(seed)
    for f in freqs:
        for k, d in enumerate([-detune, 0.0, detune]):
            ff = f * 2 ** (d / 12)
            x = saw(ff, dur, harmonics=int(min(40, 9000 / ff)), phase=r.uniform(0, 1))
            if k == 0: L += x
            elif k == 2: R += x
            else: L += x * 0.7; R += x * 0.7
    st = np.stack([L, R], axis=1) / max(1, len(freqs) * 2)
    st = lp(st, cutoff, 2)
    if vowel:  # 'aah' formants
        st = 0.5 * bp(st, 600, 1000) * 2.5 + 0.35 * bp(st, 1050, 1350) * 2.5 + 0.15 * st
    e = env_adsr(n, attack, 0.2, 1.0, release)
    return st * e[:, None]


def sub(f, dur, sat=1.5):
    x = sine(f, dur)
    return np.tanh(x * sat) / np.tanh(sat)


def kick(dur=0.45, f0=130, f1=42, punch=1.0):
    t = tvec(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.045)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    click = noise(dur, 11) * np.exp(-t / 0.004) * 0.3 * punch
    return np.tanh((x * np.exp(-t / 0.18) + click) * 1.4)


def hat(dur=0.08, seed=3, open_=False):
    x = hp(noise(dur if not open_ else 0.35, seed), 7000, 2)
    return x * env_exp(len(x), 0.025 if not open_ else 0.12, 0.0005) * 0.6


def clap(dur=0.3, seed=5):
    x = bp(noise(dur, seed), 900, 4000)
    e = np.zeros(T(dur)); t = tvec(dur)
    for k, o in enumerate([0, 0.011, 0.023]):
        e += np.exp(-np.clip(t - o, 0, None) / (0.012 if k < 2 else 0.09)) * (t >= o)
    return x * e * 0.6


def riser(dur, f0=200, f1=6000, seed=7):
    x = noise(dur, seed)
    y = sweep_bp(x, f0, f1, q=3.0)
    e = np.linspace(0, 1, len(y)) ** 2.2
    tone = sine(np.geomspace(f0 * 0.5, f1 * 0.15, len(y)), dur) * 0.25
    return (y * 1.5 + tone) * e


def whoosh(dur=1.2, f0=300, f1=3000, seed=8):
    x = noise(dur, seed)
    y = sweep_bp(x, f0, f1, q=1.4)
    t = np.linspace(0, 1, len(y))
    e = np.sin(np.pi * t) ** 1.5
    return y * e * 1.4


def impact(dur=2.0, seed=9):
    t = tvec(dur)
    boom = np.sin(2 * np.pi * np.cumsum(40 + 60 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.6)
    crack = lp(noise(dur, seed), 3000) * np.exp(-t / 0.05) * 0.5
    return np.tanh((boom + crack) * 1.3)


def cymbal(dur=2.5, seed=12):
    x = hp(noise(dur, seed), 4000, 2)
    return x * env_exp(len(x), 0.7, 0.002) * 0.35


# ---------------------------------------------------------------- foley
def phone_buzz(dur=0.32, seed=0):
    t = tvec(dur)
    f = 165
    x = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + np.sin(2 * np.pi * f * 2 * t) * 0.3
    am = 0.6 + 0.4 * np.sin(2 * np.pi * 28 * t)
    x = lp(x * am, 1800)
    return x * env_adsr(len(t), 0.01, 0.05, 0.9, 0.05)


def chime(notes_hz, gap=0.16, dur=1.4):
    out = np.zeros(T(gap * len(notes_hz) + dur))
    for k, f in enumerate(notes_hz):
        x = fm_bell(f, dur, ratio=2.0, index=2.2, decay=0.45)
        i = T(gap * k); out[i:i + len(x)] += x
    return out


def blip(f0=900, f1=1400, dur=0.07):
    t = tvec(dur)
    f = np.geomspace(f0, f1, len(t))
    x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.3
    return lp(x, 4000) * env_adsr(len(t), 0.002, 0.02, 0.6, 0.03)


def click(seed=0, bright=6000, dur=0.02):
    x = noise(dur, seed)
    x = bp(x, bright * 0.4, min(bright * 1.6, 20000))
    return x * env_exp(len(x), 0.003, 0.0003)


def key_click(seed=0):
    r = rng(seed)
    x = click(seed, 2500 + r.uniform(0, 2500), 0.05) * 0.8
    thock = sine(180 + r.uniform(0, 80), 0.05) * env_exp(T(0.05), 0.01) * 0.4
    return x + thock


def tick(seed=0, f=3200):
    t = tvec(0.08)
    return (sine(f, 0.08) * np.exp(-t / 0.008) + click(seed, 7000, 0.08) * 0.6) * 0.7


def wood(f=420, dur=0.25):
    t = tvec(dur)
    return (sine(f, dur) * 0.7 + sine(f * 2.7, dur) * 0.3) * np.exp(-t / 0.03) + lp(noise(dur, 4), 1200) * np.exp(-t / 0.01) * 0.4


def thump(dur=0.5, f=70):
    t = tvec(dur)
    x = np.sin(2 * np.pi * np.cumsum(f + 40 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.12)
    return lp(x + lp(noise(dur, 21), 400) * np.exp(-t / 0.05) * 0.5, 600)


def music_box(f, dur=1.6):
    t = tvec(dur)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t / 0.08) + 0.15 * np.sin(2 * np.pi * f * 6.1 * t) * np.exp(-t / 0.05)
    return x * env_exp(len(t), 0.5, 0.001)


def room_tone(dur, seed=30, level=0.02):
    x = lp(noise(dur, seed), 500, 2)
    x = x / (np.abs(x).max() + 1e-9)
    return x * level


# ---------------------------------------------------------------- effects
_IR = {}


def reverb_ir(seconds=2.4, seed=40, damp=4500, predelay=0.012):
    key = (seconds, seed, damp, predelay)
    if key in _IR: return _IR[key]
    n = T(seconds)
    r = rng(seed)
    t = np.arange(n) / SR
    env = np.exp(-t * 6.9 / seconds)
    L = r.standard_normal(n) * env; R = r.standard_normal(n) * env
    L = lp(L, damp, 1); R = lp(R, damp, 1)
    pd = T(predelay)
    ir = np.zeros((n + pd, 2)); ir[pd:, 0] = L; ir[pd:, 1] = R
    ir /= np.sqrt((ir ** 2).sum() / 2)
    _IR[key] = ir
    return ir


def reverb(x, wet=0.3, seconds=2.4, damp=4500, seed=40):
    if x.ndim == 1: x = np.stack([x, x], axis=1)
    ir = reverb_ir(seconds, seed, damp)
    y = np.stack([signal.fftconvolve(x[:, 0], ir[:, 0])[:len(x)], signal.fftconvolve(x[:, 1], ir[:, 1])[:len(x)]], axis=1)
    return x * (1 - wet) + y * wet


def delay(x, time=0.3, fb=0.35, wet=0.3, pingpong=True):
    if x.ndim == 1: x = np.stack([x, x], axis=1)
    d = T(time); n = len(x)
    y = np.zeros((n + d * 8, 2)); y[:n] += x
    out = x.copy()
    tap = x.copy(); g = 1.0
    for k in range(1, 8):
        g *= fb
        sh = np.zeros_like(y); seg = tap * g
        if pingpong and k % 2 == 1: seg = seg[:, ::-1]
        y[k * d:k * d + n] += seg * wet
    return y[:n + d * 4]


def stereo_widen(x, ms=0.012):
    if x.ndim == 2: return x
    d = T(ms)
    return np.stack([x, np.concatenate([np.zeros(d), x[:-d]])], axis=1)


def soft_limit(x, ceiling=0.89):
    return np.tanh(x / ceiling) * ceiling


def loudness_report(x):
    rms = np.sqrt(np.mean(x ** 2))
    return {'peak_dbfs': float(20 * np.log10(np.abs(x).max() + 1e-12)), 'rms_dbfs': float(20 * np.log10(rms + 1e-12))}


def write_wav(path, x):
    from scipy.io import wavfile
    y = np.clip(x, -1, 1)
    wavfile.write(path, SR, (y * 32767).astype(np.int16))


# ---------------------------------------------------------------- cat voice (formant-filtered glides)
def _formant_voice(f0_curve, dur, formants, seed=0, breath=0.15):
    n = T(dur)
    ph = np.cumsum(f0_curve[:n]) / SR
    src = np.zeros(n)
    for k in range(1, 18):
        src += np.sin(2 * np.pi * k * ph) / k
    src += noise(dur, seed)[:n] * breath
    out = np.zeros(n)
    blk = 480
    for (fa, fb, bw, g) in formants:
        y = np.zeros(n); zi = np.zeros(2)
        for i in range(0, n, blk):
            u = i / max(1, n - 1)
            fc = fa + (fb - fa) * np.sin(np.pi * min(1, u * 1.2) / 2)
            w0 = 2 * np.pi * fc / SR; al = np.sin(w0) * np.sinh(np.log(2) / 2 * bw * w0 / np.sin(w0))
            b = np.array([al, 0, -al]); a = np.array([1 + al, -2 * np.cos(w0), 1 - al]); b /= a[0]; a /= a[0]
            y[i:i + blk], zi = signal.lfilter(b, a, src[i:i + blk], zi=zi)
        out += y * g
    return out


def meow(dur=0.7, f_start=480, f_peak=760, f_end=420, seed=0):
    n = T(dur); u = np.linspace(0, 1, n)
    f0 = np.where(u < 0.35, f_start + (f_peak - f_start) * np.sin(u / 0.35 * np.pi / 2), f_peak + (f_end - f_peak) * ((u - 0.35) / 0.65) ** 1.3)
    v = _formant_voice(f0, dur, [(900, 1300, 0.5, 1.0), (1900, 2500, 0.4, 0.6), (3200, 3400, 0.3, 0.25)], seed)
    e = env_adsr(n, 0.04, 0.1, 0.85, dur * 0.4)
    return v * e / (np.abs(v).max() + 1e-9)


def mrrp(dur=0.32, seed=1):
    n = T(dur); u = np.linspace(0, 1, n)
    f0 = 380 + 300 * u
    v = _formant_voice(f0, dur, [(700, 1000, 0.5, 1.0), (1700, 2100, 0.4, 0.5)], seed, breath=0.2)
    trill = 0.55 + 0.45 * np.sign(np.sin(2 * np.pi * 26 * np.arange(n) / SR))
    e = env_adsr(n, 0.02, 0.05, 0.9, 0.08)
    return v * trill * e / (np.abs(v).max() + 1e-9)


def purr(dur=3.0, seed=2, rate=26):
    n = T(dur); t = np.arange(n) / SR
    x = lp(noise(dur, seed), 380, 2)
    pulse = (0.5 + 0.5 * np.sin(2 * np.pi * rate * t)) ** 3
    breath = 0.65 + 0.35 * np.sin(2 * np.pi * 0.55 * t)
    tone = np.sin(2 * np.pi * rate * 2 * t) * 0.3
    y = (x / (np.abs(x).max() + 1e-9) + tone) * pulse * breath
    return y * env_adsr(n, 0.3, 0.1, 1.0, 0.6)


def laugh_texture(dur=1.6, voices=5, seed=3):
    r = rng(seed); out = np.zeros(T(dur))
    for v in range(voices):
        tt = r.uniform(0, 0.25); f = r.uniform(190, 330)
        while tt < dur - 0.15:
            d = 0.085 + r.uniform(-0.01, 0.02)
            syl = _formant_voice(np.full(T(d), f * r.uniform(0.95, 1.08)), d, [(750, 820, 0.6, 1.0), (1150, 1250, 0.5, 0.6)], int(tt * 1000) + v, breath=0.4)
            syl *= env_adsr(len(syl), 0.008, 0.02, 0.7, 0.04)
            i = T(tt); out[i:i + len(syl)] += syl[:len(out) - i] * r.uniform(0.6, 1)
            tt += d + r.uniform(0.04, 0.09); f *= 0.985
    return out / (np.abs(out).max() + 1e-9)


def mallet(f, dur=0.8, seed=0):
    """marimba-ish: sine + 4th harmonic, quick decay"""
    t = tvec(dur)
    x = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * f * 3.9 * t) * np.exp(-t / 0.04) + 0.1 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / 0.015)
    return x * env_exp(len(t), 0.22, 0.001)


def slide_whistle(f0, f1, dur):
    f = np.geomspace(f0, f1, T(dur))
    x = sine(f, dur) * (1 + 0.04 * np.sin(2 * np.pi * 6 * tvec(dur)))
    return x * env_adsr(T(dur), 0.03, 0.05, 0.9, 0.1)

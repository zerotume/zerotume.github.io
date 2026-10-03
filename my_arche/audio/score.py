#!/usr/bin/env python3
"""score.py — the original soundtrack, composed in code and synchronized to the scene cue sheet.

usage:  node scripts/export_cues.mjs > audio/cues.json && python3 audio/score.py [--scenes s1] [--out audio/out/score.wav]

Musical spine: the "3-1-4" motif — the digits of pi (3-1-4-1-5-9) read as scale degrees in D.
Scene 1: the motif is cold, glassy and *out of phase* (one wrong clock); when she fixes the clock,
every layer snaps onto a shared 100-BPM grid.
"""
import argparse, json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from synth import *

# pi motif as scale degrees (1-based) -> semitone offsets in major / minor
DEG_MAJ = {1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 8: 12, 9: 14}
DEG_MIN = {1: 0, 2: 2, 3: 3, 4: 5, 5: 7, 6: 8, 7: 10, 8: 12, 9: 14}
PI = [3, 1, 4, 1, 5, 9]


def motif(root_midi, minor=False):
    d = DEG_MIN if minor else DEG_MAJ
    return [root_midi + d[k] for k in PI]


class Stems:
    def __init__(self, dur):
        self.music = Mix(dur); self.sfx = Mix(dur); self.room = Mix(dur); self.dry = Mix(dur)
        self.dur = dur


def tape_stop(stem, t_start, dur):
    """slow the stem's playback to zero over dur, starting at t_start; silence after."""
    i0, n = T(t_start), T(dur)
    seg = stem.buf[i0:i0 + n * 2].copy()
    speed = np.linspace(1, 0, n)
    pos = np.cumsum(speed)
    pos = np.clip(pos, 0, len(seg) - 2)
    i = pos.astype(int); f = (pos - i)[:, None]
    out = seg[i] * (1 - f) + seg[i + 1] * f
    out *= np.linspace(1, 0.2, n)[:, None]
    stem.buf[i0:i0 + n] = out
    stem.buf[i0 + n:] *= 0


# ============================================================================ Scene 1
def score_s1(S, t0, c):
    beat = 60 / c['bpm']
    D2, D3, D4 = nm('D2'), nm('D3'), nm('D4')
    m, sx, rm, dry = S.music, S.sfx, S.room, S.dry
    end = t0 + c['end']

    # room tone + 03:14 tick
    rm.add(t0, room_tone(c['end'], level=0.03), 1.0)
    sx.add(t0 + 0.3, tick(1, 2600), 0.25, -0.6)

    # phone buzzes + alert chime
    for k, b in enumerate(c['buzz']):
        sx.add(t0 + b, phone_buzz(0.33, k), 0.55, -0.55)
    sx.add(t0 + c['banner'], chime([note_hz(nm('A5')), note_hz(nm('D5'))], gap=0.17, dur=1.6), 0.32, 0.0)
    # low tension drone from the page to the dive
    dr = pad([note_hz(D2), note_hz(nm('A2'))], 5.3, attack=1.5, release=1.0, cutoff=600, seed=2)
    m.add(t0 + 1.0, dr, 0.5)
    # sit up: cloth swish ; laptop slide
    sx.add(t0 + c['sitUp'], whoosh(0.6, 250, 1400, 3), 0.25, -0.2)
    sx.add(t0 + 2.8, lp(noise(0.6, 14), 900) * env_adsr(T(0.6), 0.1, 0.1, 0.6, 0.3), 0.08, 0.1)
    # lid open + screen hum
    sx.add(t0 + c['lidOpen'], click(2, 3000, 0.04), 0.4, 0.2)
    sx.add(t0 + c['lidOpen'] + 0.05, thump(0.4, 90), 0.35, 0.1)
    hum = sine(note_hz(nm('D6')), 2.4) * 0.5 + sine(note_hz(nm('A6')), 2.4) * 0.3
    sx.add(t0 + c['lidOpen'] + 0.2, hum * env_adsr(T(2.4), 0.6, 0.2, 0.6, 0.8), 0.035, 0.2)
    # dive: riser -> arrival
    ds, dn = c['diveStart'], c['inNet']
    sx.add(t0 + ds, riser(dn - ds, 150, 5000, 7), 0.32)
    sx.add(t0 + dn, impact(1.6, 9), 0.35)
    # arrival strum of the motif (minor, cold)
    for k, n in enumerate(motif(D4, minor=True)):
        m.add(t0 + dn + k * 0.035, glass(note_hz(n), 2.2), 0.13, -0.6 + k * 0.24)

    # ---------- out-of-phase groove (6.2 -> stop) ----------
    groove = Mix(S.dur)
    g0, g1 = dn, c['stopHand']
    r = rng(314)
    # hats: 8ths at nominal tempo with human-ish jitter
    tt = g0
    while tt < g1:
        groove.add(t0 + tt + r.normal(0, 0.012), hat(seed=int(tt * 100)), 0.22, 0.35)
        tt += beat / 2
    # bass pulse drifting slower (97 BPM vs 100) -> phase smears against hats
    tt = g0; bdur = 60 / 96.5
    while tt < g1:
        x = sub(note_hz(D2), 0.45) * env_exp(T(0.45), 0.16, 0.004)
        groove.add(t0 + tt, x, 0.42)
        tt += bdur
    # motif plucks, each voice with its own drift + jitter
    mot = motif(nm('D5'), minor=True)
    for voice, (bpmv, oct_, pan) in enumerate([(100, 0, -0.5), (103.5, -12, 0.5)]):
        tt = g0 + 0.15 * voice; k = 0
        while tt < g1:
            n = mot[k % 6] + oct_
            groove.add(t0 + tt + r.normal(0, 0.03), glass(note_hz(n), 1.6, seed=k), 0.12, pan)
            tt += 60 / bpmv / 2; k += 1
    # alarm pulse (two soft tones)
    tt = g0 + 0.5
    while tt < g1:
        x = sine(note_hz(nm('F5')), 0.2) * env_adsr(T(0.2), 0.01, 0.05, 0.5, 0.1)
        groove.add(t0 + tt, x, 0.07, 0.2)
        tt += 1 / 1.4
    # unsettled minor pad
    groove.add(t0 + g0, pad([note_hz(nm('D3')), note_hz(nm('F3')), note_hz(nm('A3')), note_hz(nm('E4'))], g1 - g0 + 0.6, attack=1.2, release=0.4, cutoff=1400, seed=3), 0.22)
    tape_stop(groove, t0 + g1, 0.55)
    m.buf += groove.buf

    # restart blips (rising pitch as they accelerate — comedic)
    for k, ck in enumerate(c['clicks']):
        f0 = 600 + k * 22
        sx.add(t0 + ck, blip(f0 * 1.3, f0 * 0.7, 0.06), 0.16 if k < 3 else 0.09, 0.15)
        sx.add(t0 + ck + 0.07, blip(f0 * 0.8, f0 * 1.5, 0.06), 0.12 if k < 3 else 0.07, 0.15)
        sx.add(t0 + ck, click(k, 5000, 0.02), 0.25, 0.3)

    # ---------- the question: bowl + soft pad ----------
    q = c['question']
    m.add(t0 + q, bowl(note_hz(nm('D3')), 6.0), 0.32)
    m.add(t0 + q + 0.1, bowl(note_hz(nm('A4')), 4.0), 0.08, 0.3)
    m.add(t0 + q - 0.2, pad([note_hz(nm(n)) for n in ['D3', 'A3', 'E4', 'F4']], c['turnStart'] - q + 0.8, attack=1.0, release=0.8, cutoff=1600, seed=4, vowel=True), 0.32)

    # ---------- the turn ----------
    sx.add(t0 + c['grab'], glass(note_hz(nm('A6')), 1.5), 0.18, -0.5)
    ts, te = c['turnStart'], c['turnEnd']
    w = whoosh(te - ts + 0.4, 120, 2600, 33)
    pan_curve = np.linspace(-0.8, 0.8, len(w))
    L, R = pan_gains(pan_curve)
    sx.add(t0 + ts, np.stack([w * L, w * R], axis=1), 0.42)
    sx.add(t0 + ts, riser(te - ts, 60, 900, 34) * 0.6, 0.35)
    # choir chords rising: Bbmaj7 -> C6 -> (D on trace)
    m.add(t0 + ts, pad([note_hz(nm(n)) for n in ['Bb2', 'F3', 'A3', 'D4']], 1.8, attack=0.7, release=0.6, cutoff=2400, seed=5, vowel=True), 0.75)
    m.add(t0 + ts + 1.5, pad([note_hz(nm(n)) for n in ['C3', 'G3', 'A3', 'E4']], 2.0, attack=0.6, release=0.6, cutoff=2800, seed=6, vowel=True), 0.8)
    m.add(t0 + ts, sub(note_hz(nm('Bb1')), 1.6) * env_adsr(T(1.6), 0.4, 0.2, 0.8, 0.5), 0.25)
    m.add(t0 + ts + 1.5, sub(note_hz(nm('C2')), 1.8) * env_adsr(T(1.8), 0.3, 0.2, 0.8, 0.5), 0.25)
    # tremolo strings-ish shimmer rising through the reveal and the trace
    sh_d = c['snap'] - ts
    shim = pad([note_hz(nm('A5')), note_hz(nm('D6'))], sh_d, attack=sh_d * 0.8, release=0.05, cutoff=7000, seed=8)
    shim *= (0.6 + 0.4 * np.sin(2 * np.pi * 11 * np.arange(len(shim)) / SR))[:, None]
    m.add(t0 + ts, shim, 0.22)

    # ---------- trace: ascending gold plucks ----------
    asc = [nm(n) for n in ['D4', 'F#4', 'A4', 'D5', 'E5', 'F#5', 'G5', 'A5', 'D6', 'E6', 'F#6']]
    tr0, tr1 = c['traceStart'], c['traceEnd']
    for k, n in enumerate(asc):
        tk = tr0 + (tr1 - tr0) * k / len(asc)
        m.add(t0 + tk, pluck(note_hz(n), 1.4, bright=0.8, seed=k), 0.18, -0.7 + 1.4 * k / len(asc))
    m.add(t0 + tr0, pad([note_hz(nm(n)) for n in ['D3', 'A3', 'D4', 'F#4']], tr1 - tr0 + 1.2, attack=0.5, release=0.8, cutoff=3000, seed=7, vowel=True), 0.3)

    # ---------- the wrong clock: irregular ticks, then spin ----------
    for k, tk in enumerate([20.55, 20.86, 20.99, 21.24]):
        sx.add(t0 + tk, tick(k, 3000 + 300 * (k % 2)), 0.35, 0.45)
    fl, sn = c['flick'], c['snap']
    sp = sine(np.geomspace(180, 1500, T(sn - fl)), sn - fl) * np.linspace(0.2, 1, T(sn - fl)) * (0.6 + 0.4 * np.sin(2 * np.pi * np.cumsum(np.geomspace(8, 40, T(sn - fl))) / SR))
    sx.add(t0 + fl, sp, 0.08, 0.4)
    tk = fl; gap = 0.12
    while tk < sn - 0.03:
        sx.add(t0 + tk, tick(int(tk * 1000), 3400), 0.2, 0.4); tk += gap; gap = max(0.035, gap * 0.8)

    # ---------- SNAP + locked groove ----------
    m.add(t0 + sn, kick(0.6, 160, 40, 1.4), 0.9)
    sx.add(t0 + sn, impact(2.2, 19), 0.35)
    m.add(t0 + sn, cymbal(2.5, 12), 0.6, 0.2)
    for k, n in enumerate([nm(x) for x in ['D3', 'A3', 'E4', 'F#4', 'C#5', 'A5']]):
        m.add(t0 + sn + k * 0.012, glass(note_hz(n), 2.4), 0.12, -0.5 + k * 0.2)

    lock = Mix(S.dur)
    gl0, gl1 = sn, c['lidClose']
    chords = [(['D2'], ['D3', 'F#3', 'A3', 'C#4', 'E4']), (['B1'], ['B2', 'D3', 'F#3', 'A3', 'C#4']), (['G1'], ['G2', 'B2', 'D3', 'F#3', 'A3']), (['A1'], ['A2', 'C#3', 'E3', 'G3', 'B3'])]
    bar = beat * 4
    nb = int(np.ceil((gl1 - gl0) / beat)) + 1
    for b in range(nb):
        tb = gl0 + b * beat
        if tb >= gl1: break
        if b > 0: lock.add(t0 + tb, kick(0.45, 120, 42), 0.62)
        if b % 2 == 1: lock.add(t0 + tb, clap(0.3, b), 0.3, 0.05)
        lock.add(t0 + tb + beat / 2, hat(seed=b), 0.2, 0.3)
        lock.add(t0 + tb + beat / 4, hat(seed=b + 50), 0.08, -0.3)
        lock.add(t0 + tb + 3 * beat / 4, hat(seed=b + 90), 0.08, -0.3)
        root = chords[(b // 4) % 4][0][0]
        for e8 in range(2):
            x = sub(note_hz(nm(root)) * (2 if e8 else 1), beat / 2 * 0.9) * env_exp(T(beat / 2 * 0.9), 0.12, 0.004)
            lock.add(t0 + tb + e8 * beat / 2, x, 0.32)
    for ci in range(int(np.ceil((gl1 - gl0) / bar))):
        tb = gl0 + ci * bar
        lock.add(t0 + tb, pad([note_hz(nm(n)) for n in chords[ci % 4][1]], bar + 0.3, attack=0.05, release=0.4, cutoff=3200, seed=10 + ci), 0.26)
    # motif in major, tight 8ths/16ths
    mot = motif(nm('D5'))
    k = 0; tk = gl0
    while tk < gl1:
        n = mot[k % 6]
        lock.add(t0 + tk, pluck(note_hz(n), 1.0, bright=0.75, seed=k), 0.2, -0.4 if k % 2 else 0.4)
        if k % 3 == 0: lock.add(t0 + tk, glass(note_hz(n + 12), 1.2), 0.05, 0.0)
        tk += beat / 2; k += 1
    # through-the-laptop filtering as we pull back out, then hard cut on lid close
    a, b = T(t0 + c['diveOut']), T(t0 + gl1)
    for ch in range(2):
        lock.buf[a:b, ch] = sweep_lp(lock.buf[a:b, ch], 14000, 900)
    lock.buf[b:b + T(0.012)] *= np.linspace(1, 0, T(0.012))[:, None]
    lock.buf[b + T(0.012):] = 0
    m.buf += lock.buf

    # stamp
    sx.add(t0 + c['stamp'], wood(300, 0.3), 0.55, 0.6)
    sx.add(t0 + c['stamp'], thump(0.4, 60), 0.4, 0.6)
    # typing + send
    for k, tk in enumerate(c['typing']):
        sx.add(t0 + tk, key_click(k), 0.3, 0.15)
    sx.add(t0 + c['send'], whoosh(0.35, 1500, 6000, 41), 0.25, 0.4)
    sx.add(t0 + c['send'] + 0.05, fm_bell(note_hz(nm('E6')), 0.5, 2.0, 1.0, 0.2), 0.12, 0.4)
    # lid close, flop, zzz music box (3-1-4 in major, a promise of warmth)
    sx.add(t0 + gl1, wood(220, 0.25), 0.6, 0.2)
    sx.add(t0 + gl1, click(77, 2500, 0.03), 0.4, 0.2)
    sx.add(t0 + c['flop'] + 0.45, thump(0.6, 55), 0.5, -0.2)
    sx.add(t0 + c['flop'] + 0.42, whoosh(0.4, 300, 1000, 43), 0.18, -0.2)
    for k, n in enumerate(['F#5', 'D5', 'G5']):
        dry.add(t0 + c['zzz'] + 0.1 + k * 0.42, music_box(note_hz(nm(n)), 1.8), 0.16, -0.3 + 0.3 * k)



# ============================================================================ Scene 2
def score_s2(S, t0, c):
    m, sx, rm, dry = S.music, S.sfx, S.room, S.dry
    G3, G4 = nm('G3'), nm('G4')
    rm.add(t0, room_tone(c['end'], seed=31, level=0.022), 1.0)
    # --- time-lapse: ticking clock sped up + ascending day arpeggio + dawn birds
    for k in range(40):
        tk = 0.4 + k * 0.065
        if tk > 3.1: break
        sx.add(t0 + tk, tick(k, 3000 + (k % 2) * 400), 0.08 + 0.1 * (k / 40), 0.4)
    asc = [nm(n) for n in ['G3', 'B3', 'D4', 'G4', 'A4', 'B4', 'D5', 'E5', 'G5', 'B5']]
    for k, n in enumerate(asc):
        m.add(t0 + 0.6 + k * 0.24, pluck(note_hz(n), 1.6, bright=0.55, seed=k), 0.14, -0.6 + k * 0.13)
    m.add(t0 + 0.5, pad([note_hz(nm(n)) for n in ['G2', 'D3', 'B3', 'F#4']], 3.4, attack=1.2, release=1.0, cutoff=2600, seed=21), 0.25)
    for k, tb in enumerate([1.6, 1.85, 2.3, 2.45]):
        f = 2600 + 600 * (k % 2)
        ch = sine(np.geomspace(f, f * 1.5, T(0.09)), 0.09) * env_adsr(T(0.09), 0.005, 0.02, 0.6, 0.04)
        sx.add(t0 + tb, ch, 0.06, 0.5)
    # --- whip in + chat groove (104 BPM, G major, playful)
    sx.add(t0 + c['whipIn'][0], whoosh(0.7, 400, 5000, 51), 0.3, 0.2)
    sx.add(t0 + c['whipIn'][1], click(5, 4000, 0.03), 0.3)
    bpm = 104; b = 60 / bpm
    g0, g1 = c['whipIn'][1], c['alert1']
    tt = g0; k = 0
    bass = [nm(n) for n in ['G2', 'G2', 'D3', 'G2', 'C3', 'C3', 'D3', 'B2']]
    mot = motif(nm('G4'))
    while tt < g1 - 0.02:
        # mallet bass on quarters, shaker on 8ths, motif on off-beats
        m.add(t0 + tt, mallet(note_hz(bass[k % 8]), 0.5), 0.34, -0.1)
        sx.add(t0 + tt + b / 2, hat(seed=200 + k), 0.09, 0.4)
        if k % 2 == 1: m.add(t0 + tt + b / 2, pluck(note_hz(mot[(k // 2) % 6]), 0.7, bright=0.45, seed=k), 0.16, 0.35)
        if k % 4 == 0: m.add(t0 + tt, pad([note_hz(nm(n)) for n in (['G3', 'B3', 'D4'] if (k // 4) % 2 == 0 else ['C4', 'E4', 'G4'])], b * 4, attack=0.05, release=0.3, cutoff=2000, seed=30 + k), 0.12)
        tt += b; k += 1
    # message blips
    for k, tm in enumerate(c['msgs']):
        sx.add(t0 + tm, fm_bell(note_hz(nm('E6')) * (1 + 0.06 * k), 0.4, 2.0, 1.0, 0.12), 0.12, 0.3)
    # her post: plop + bell
    sx.add(t0 + c['herPost'] + 0.1, thump(0.25, 160), 0.3, 0.0)
    sx.add(t0 + c['herPost'] + 0.12, fm_bell(note_hz(nm('G6')), 0.8, 2.0, 1.4, 0.3), 0.15, 0.0)
    # reactions: rising pops + laughter texture + sparkle
    for k in range(23):
        tk = c['react'] + 1.6 * (1 - (1 - k / 23) ** 1.5)
        sx.add(t0 + tk, blip(700 + k * 45, 1100 + k * 60, 0.05), 0.07, -0.5 + (k % 5) * 0.25)
    sx.add(t0 + c['react'] + 0.1, laugh_texture(2.0, 6, 3), 0.12, 0.0)
    sx.add(t0 + c['react'], hp(noise(1.6, 61), 6000) * env_adsr(T(1.6), 0.05, 0.3, 0.4, 1.0), 0.05, 0.2)
    for k, tr in enumerate(c['replies']):
        sx.add(t0 + tr, fm_bell(note_hz(nm('B5')) * (1 + 0.05 * k), 0.3, 2.0, 1.0, 0.1), 0.08, 0.3)
    # the cat in the image looks at us; pops out of the screen and lands on the desk
    sx.add(t0 + c['catLook'], mrrp(0.25, 4), 0.09, 0.1)
    sx.add(t0 + c['whipOut'][0], whoosh(0.7, 5000, 400, 52), 0.28, -0.1)
    sx.add(t0 + c['whipOut'][1] + 0.2, thump(0.3, 120), 0.35, 0.3)
    # happy wiggle lick
    for k, n in enumerate(['G5', 'B5', 'D6']):
        m.add(t0 + c['wiggle'] + k * 0.1, mallet(note_hz(nm(n)), 0.4), 0.16, 0.2)
    # --- alert 1: the music stops dead. one amber ping (minor 2nd)
    a1 = c['alert1']
    m.buf[T(t0 + a1):T(t0 + a1) + T(0.03)] *= np.linspace(1, 0, T(0.03))[:, None]
    m.buf[T(t0 + a1) + T(0.03):T(t0 + a1 + 2.5)] *= 0.0
    def ping(f, g=0.16, pan=0.3):
        x = fm_bell(f, 0.9, 1.0, 0.8, 0.35) + 0.6 * fm_bell(f * 2 ** (1 / 12), 0.9, 1.0, 0.6, 0.3)
        return x
    sx.add(t0 + a1, ping(note_hz(nm('E5'))), 0.16, 0.35)
    # cat rolls off the desk: slide whistle + flump
    sx.add(t0 + c['catFall'], slide_whistle(1200, 300, 0.5), 0.08, 0.4)
    sx.add(t0 + c['catLand'], thump(0.35, 90), 0.4, 0.4)
    for k, ta in enumerate(c['alerts']):
        sx.add(t0 + ta, ping(note_hz(nm('E5')) * 2 ** ((k + 1) * 2 / 12)), 0.15, -0.3 + 0.3 * k)
    # --- the storm: swarm of pings, dissonant cluster, accelerating low thumps
    r = rng(77)
    st0, st1 = c['storm'], c['grab']
    for k in range(120):
        tk = st0 + (st1 - st0) * (k / 120) ** 0.8 + r.uniform(0, 0.05)
        f = note_hz(nm('E5')) * 2 ** (r.integers(-5, 9) / 12)
        sx.add(t0 + tk, fm_bell(f, 0.35, 1.0, 0.6, 0.12), 0.05 + 0.04 * (k / 120), r.uniform(-0.9, 0.9))
    cl = pad([note_hz(nm(n)) for n in ['E3', 'F3', 'B3', 'C4', 'F#4', 'G4']], st1 - st0 + 2.6, attack=2.5, release=1.0, cutoff=1800, seed=40)
    m.add(t0 + st0, cl, 0.4)
    tk = st0; gap = 0.9
    while tk < c['orbit'][0]:
        m.add(t0 + tk, kick(0.4, 70, 38, 0.3), 0.35); m.add(t0 + tk + 0.16, kick(0.3, 65, 36, 0.2), 0.22)
        tk += gap; gap = max(0.55, gap * 0.92)
    # monster: growl + low drone; recoil hit
    gr = lp(noise(3.0, 66), 220) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * tvec(3.0)))
    m.add(t0 + 16.6, gr * env_adsr(T(3.0), 1.0, 0.3, 0.9, 0.8), 0.5)
    m.add(t0 + 16.6, sub(note_hz(nm('E1')), 3.3, 2.0) * env_adsr(T(3.3), 1.2, 0.2, 0.9, 0.8), 0.35)
    sx.add(t0 + c['recoil'], impact(1.8, 67), 0.4)
    # --- the turn: tink, whoosh orbit (pans R->L), cluster resolves to G major
    sx.add(t0 + c['grab'], glass(note_hz(nm('A6')), 1.5), 0.18, 0.6)
    o0, o1 = c['orbit']
    w = whoosh(o1 - o0 + 0.4, 150, 2400, 68); pc = np.linspace(0.8, -0.8, len(w)); L, R = pan_gains(pc)
    sx.add(t0 + o0, np.stack([w * L, w * R], axis=1), 0.4)
    m.add(t0 + o0 + 0.6, pad([note_hz(nm(n)) for n in ['G2', 'D3', 'G3', 'B3', 'D4']], 3.0, attack=1.4, release=1.2, cutoff=2600, seed=41, vowel=True), 0.45)
    # mrrp + comic pizz
    sx.add(t0 + c['mrrp'], mrrp(0.34, 5), 0.32, 0.5)
    m.add(t0 + c['mrrp'] + 0.42, pluck(note_hz(nm('D5')), 0.5, bright=0.3, seed=3), 0.22, 0.4)
    # she laughs: bright little marimba ha-ha
    for k, dt in enumerate([0, 0.22, 0.42, 0.8]):
        m.add(t0 + c['laugh'] + dt, mallet(note_hz(nm(['B5', 'G5', 'B5', 'D6'][k])), 0.45), 0.15, 0.1)
    # panel chime, flick, knob glissando + sparkles dissolving
    sx.add(t0 + c['panel'], fm_bell(note_hz(nm('D6')), 0.6, 2.0, 1.2, 0.2), 0.12, 0.2)
    sx.add(t0 + c['flick'], whoosh(0.3, 800, 4000, 69), 0.25, 0.4)
    k0, k1 = c['knob']
    scale_up = [nm(n) for n in ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5', 'A5', 'B5', 'D6', 'G6']]
    for k, n in enumerate(scale_up):
        m.add(t0 + k0 + (k1 - k0) * 0.8 * k / len(scale_up), pluck(note_hz(n), 1.2, bright=0.7, seed=50 + k), 0.13, -0.7 + 1.4 * k / len(scale_up))
    for k in range(60):
        tk = k0 + (k1 - k0) * (k / 60) ** 1.4
        sx.add(t0 + tk, hp(noise(0.06, 900 + k), 5000) * env_exp(T(0.06), 0.01), 0.06, r.uniform(-0.8, 0.8))
    sx.add(t0 + 27.4, chime([note_hz(nm('G5')), note_hz(nm('B5'))], gap=0.12, dur=1.2), 0.14, 0.3)
    # her principle: warm pad + slow motif on a soft piano-ish pluck
    pr = c['principle']
    m.add(t0 + pr - 0.3, pad([note_hz(nm(n)) for n in ['C3', 'G3', 'E4', 'B4']], 3.4, attack=0.8, release=1.2, cutoff=2400, seed=42), 0.3)
    m.add(t0 + pr + 1.7, pad([note_hz(nm(n)) for n in ['G2', 'D3', 'B3', 'F#4']], 3.0, attack=0.8, release=1.2, cutoff=2400, seed=43), 0.28)
    for k, n in enumerate(motif(G4)):
        m.add(t0 + pr + k * 0.5, pluck(note_hz(n), 2.0, bright=0.3, seed=60 + k), 0.2, -0.2 + 0.08 * k)
    # cat pitter-patter back to her
    for k in range(18):
        sx.add(t0 + c['catBack'][0] + k * 0.13, click(300 + k, 1800, 0.02), 0.08, 0.5 - k * 0.05)
    # wiggle tremolo -> boing -> deflate
    for k in range(14):
        sx.add(t0 + c['wiggleJump'] + k * 0.064, tick(400 + k, 1500 + (k % 2) * 200), 0.07, -0.2)
    sx.add(t0 + c['hop'], slide_whistle(400, 700, 0.18), 0.1, -0.2)
    sx.add(t0 + c['cantJump'], slide_whistle(500, 220, 0.6), 0.1, -0.2)
    m.add(t0 + c['cantJump'] + 0.1, pluck(note_hz(nm('G3')), 0.6, bright=0.2), 0.2)
    # scoop, lap, purr
    sx.add(t0 + c['scoop'], whoosh(0.4, 300, 1200, 70), 0.15, -0.3)
    sx.add(t0 + c['lap'], thump(0.3, 100), 0.25, -0.2)
    sx.add(t0 + c['purr'], purr(c['end'] - c['purr'] + 1.2, 7), 0.18, -0.2)
    # sunset swell into the kitchen (Bb major)
    ss = c['sunset'][0]
    m.add(t0 + ss, pad([note_hz(nm(n)) for n in ['Eb3', 'Bb3', 'D4', 'G4', 'C5']], c['end'] - ss + 1.0, attack=1.6, release=0.6, cutoff=3000, seed=44, vowel=True), 0.36)
    m.add(t0 + c['end'] - 1.2, riser(1.2, 300, 6000, 71), 0.12)

# ============================================================================ Scene 3
def ep(f, dur=1.6, bright=1.0):
    """electric-piano-ish: FM ratio 1 with low index + tine partial"""
    t_ = tvec(dur)
    idx = 1.2 * bright * np.exp(-t_ / 0.25)
    x = np.sin(2 * np.pi * f * t_ + idx * np.sin(2 * np.pi * f * t_)) + 0.2 * np.sin(2 * np.pi * f * 14 * t_) * np.exp(-t_ / 0.02)
    return x * env_exp(len(t_), dur * 0.45, 0.003)


def score_s3(S, t0, c):
    m, sx, rm, dry = S.music, S.sfx, S.room, S.dry
    beat = 60 / c['bpm']
    rm.add(t0, room_tone(c['end'], seed=32, level=0.02), 1.0)
    # kitchen groove (Bb major) from open to the flame dive
    k0, k1 = 0.3, c['flameDive'][0]
    prog = [['Bb2', ['D3', 'F3', 'A3', 'C4']], ['G2', ['Bb2', 'D3', 'F3', 'A3']], ['Eb2', ['G2', 'Bb2', 'D3', 'F3']], ['F2', ['A2', 'C3', 'Eb3', 'G3']]]
    nb = int((k1 - k0) / beat)
    mot = motif(nm('Bb4'))
    for b in range(nb):
        tb = k0 + b * beat
        ch = prog[(b // 4) % 4]
        if b % 4 == 0:
            for k, n in enumerate(ch[1]): m.add(t0 + tb + k * 0.012, ep(note_hz(nm(n)), beat * 4.2, 0.8), 0.07, -0.3 + 0.2 * k)
        if b % 2 == 0: m.add(t0 + tb, pluck(note_hz(nm(ch[0])), 1.0, bright=0.25, seed=b), 0.34, 0.0)
        else: m.add(t0 + tb + beat / 2, pluck(note_hz(nm(ch[0])) * 1.5, 0.6, bright=0.25, seed=b + 100), 0.2, 0.0)
        # brushes
        br = bp(noise(beat * 0.5, 300 + b), 2000, 8000) * env_adsr(T(beat * 0.5), 0.02, 0.05, 0.4, 0.2)
        sx.add(t0 + tb + beat / 2, br, 0.05, 0.3)
        if b >= 8 and b % 2 == 1 and tb < c['over'][0]:
            m.add(t0 + tb, ep(note_hz(mot[(b // 2) % 6]), 1.0, 1.0), 0.09, 0.3)
    # footsteps walking in
    for k in range(6): sx.add(t0 + 0.4 + k * 0.36, thump(0.15, 140), 0.12, -0.6 + k * 0.15)
    # cat on the pet stairs: tiny step thumps
    for k in range(4): sx.add(t0 + 2.4 + k * 0.22, thump(0.12, 200), 0.08, 0.7)
    # rice cooker beeps
    for k in range(2): sx.add(t0 + c['rice'] + k * 0.14, sine(note_hz(nm('E6')), 0.09) * env_adsr(T(0.09), 0.004, 0.02, 0.8, 0.03), 0.1, 0.6)
    # chops = hi-hats (diegetic), crisp woody knife
    for k, tc in enumerate(c['chops']):
        sx.add(t0 + tc, wood(1200 + (k % 3) * 120, 0.08), 0.21, 0.35); sx.add(t0 + tc, click(k + 500, 6000, 0.03), 0.35, 0.35)
    # sweep + sizzle
    sx.add(t0 + c['sweep'], whoosh(0.4, 600, 3000, 81), 0.2, 0.0)
    siz = hp(noise(6.0, 82), 3000) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 3.3 * tvec(6.0)))) * env_adsr(T(6.0), 0.05, 0.4, 0.6, 2.0)
    sx.add(t0 + c['sizzle'], siz, 0.07, -0.2)
    # overhead: vibraphone motif swirl + stirring scrape
    o0, o1 = c['over']
    for k in range(10):
        n = mot[k % 6] + 12
        m.add(t0 + o0 + 0.2 + k * 0.38, fm_bell(note_hz(n), 1.6, 4.0, 1.0, 0.7), 0.08, np.sin(k) * 0.6)
    for k in range(int((o1 - o0) * 2.4)):
        sc_ = bp(noise(0.25, 400 + k), 800, 3000) * env_adsr(T(0.25), 0.05, 0.05, 0.5, 0.1)
        sx.add(t0 + o0 + k / 2.4, sc_, 0.04, 0.0)
    for k, tt in enumerate(c['taste']): sx.add(t0 + tt, wood(1800, 0.06), 0.15, 0.1)
    # the steal
    sx.add(t0 + c['steal'] - 0.3, slide_whistle(300, 900, 0.3), 0.06, 0.8)
    sx.add(t0 + c['minusShrimp'], pluck(note_hz(nm('F5')), 0.4, bright=0.3), 0.18, 0.7)
    sx.add(t0 + c['minusShrimp'] + 0.15, pluck(note_hz(nm('D5')), 0.4, bright=0.3), 0.18, 0.7)
    sx.add(t0 + c['minusShrimp'] + 0.35, mrrp(0.28, 9), 0.18, 0.7)
    for k, n in enumerate(['C5', 'A4']): m.add(t0 + c['notice'] + 0.3 + k * 0.25, mallet(note_hz(nm(n)), 0.5), 0.12)
    # ---- flame dive: gas hiss rising into the cosmos
    f0, f1 = c['flameDive']
    hiss = hp(noise(f1 - f0 + 0.3, 83), 1500) * np.linspace(0.2, 1, T(f1 - f0 + 0.3)) ** 2
    sx.add(t0 + f0, hiss, 0.12)
    sx.add(t0 + f0 + 0.6, riser(f1 - f0 - 0.6, 200, 9000, 84), 0.3)
    sx.add(t0 + f1, impact(2.0, 85), 0.3)
    # ---- plasma: deep hum, shimmer, choir (Bb lydian), pulsing arpeggio
    p0, p1 = c['plasma']
    m.add(t0 + p0, sub(note_hz(nm('Bb1')), p1 - p0 + 1, 1.2) * env_adsr(T(p1 - p0 + 1), 0.8, 0.2, 0.9, 0.8), 0.3)
    m.add(t0 + p0, pad([note_hz(nm(n)) for n in ['Bb2', 'F3', 'C4', 'E4', 'A4']], p1 - p0 + 1.2, attack=1.2, release=1.0, cutoff=3500, seed=90, vowel=True), 0.42)
    arp = [nm(n) for n in ['Bb4', 'D5', 'F5', 'A5', 'C6', 'E6']]
    tt = p0 + 0.4; k = 0
    while tt < c['city'][0] + 0.8:
        m.add(t0 + tt, fm_bell(note_hz(arp[k % 6]), 0.5, 3.0, 1.6, 0.18), 0.06, np.sin(k * 0.7) * 0.8)
        tt += 0.125; k += 1
    # ---- the city: grand progression + motif lead + booms, lights sweep
    c0, c1 = c['city'][0], c['cityUp'][0]
    cprog = [['Bb1', ['Bb2', 'F3', 'D4', 'A4']], ['A1', ['F3', 'C4', 'A4']], ['G1', ['G2', 'D3', 'Bb3', 'F4']], ['Eb2', ['Eb3', 'Bb3', 'G4', 'D5']]]
    bar = 1.4
    for i in range(int((c['routeCost'] - c0) / bar) + 1):
        tb = c0 + i * bar
        if tb >= c['routeCost']: break
        ch = cprog[i % 4]
        m.add(t0 + tb, pad([note_hz(nm(n)) for n in ch[1]], bar + 0.4, attack=0.15, release=0.5, cutoff=4200, seed=91 + i), 0.36)
        m.add(t0 + tb, sub(note_hz(nm(ch[0])) * 2, bar, 1.4) * env_exp(T(bar), 0.6, 0.01), 0.3)
        m.add(t0 + tb, kick(0.8, 90, 35, 0.4), 0.35)
    lead = motif(nm('Bb4'))
    for k, n in enumerate(lead):
        x = saw(note_hz(n), 0.6) * env_adsr(T(0.6), 0.03, 0.1, 0.7, 0.3)
        m.add(t0 + c['cityLights'] + 0.2 + k * 0.35, lp(x, 3500), 0.12, 0.1)
    sw = [nm(n) for n in ['Bb3', 'D4', 'F4', 'Bb4', 'D5', 'F5', 'Bb5', 'D6']]
    for k, n in enumerate(sw): m.add(t0 + c['cityLights'] + k * 0.18, pluck(note_hz(n), 1.2, bright=0.8, seed=200 + k), 0.1, -0.7 + 0.2 * k)
    # route: cold digital stepping
    for k in range(10):
        sx.add(t0 + c['route'] + k * 0.14, blip(1400, 1400, 0.05), 0.06, -0.6 + 0.12 * k)
    # cost: tritone stab; music drops to a tense chord
    rc = c['routeCost']
    for n in ['E3', 'Bb3', 'E4']: m.add(t0 + rc, glass(note_hz(nm(n)), 1.8), 0.14)
    m.add(t0 + rc, pad([note_hz(nm(n)) for n in ['G2', 'Bb2', 'D3', 'F#3']], c['reroute'] - rc + 0.3, attack=0.1, release=0.3, cutoff=1800, seed=99), 0.32)
    m.add(t0 + rc, impact(1.4, 86), 0.2)
    # reroute: gold warm resolution + bowl + choir (echo of scene 1's question)
    rr = c['reroute']
    sx.add(t0 + rr, glass(note_hz(nm('F6')), 1.5), 0.16, 0.2)
    m.add(t0 + rr + 0.2, pad([note_hz(nm(n)) for n in ['Eb2', 'Bb2', 'G3', 'D4', 'F4']], 2.6, attack=0.6, release=1.0, cutoff=3000, seed=101, vowel=True), 0.45)
    m.add(t0 + rr + 2.6, pad([note_hz(nm(n)) for n in ['Bb1', 'F2', 'D3', 'A3', 'C4']], c['cityUp'][1] - rr - 2.0, attack=0.6, release=1.4, cutoff=3000, seed=102, vowel=True), 0.42)
    m.add(t0 + c['principle'], bowl(note_hz(nm('Bb2')), 6.0), 0.3)
    # city up -> pot match: reverse swell then a soft plop
    cu0, cu1 = c['cityUp']
    rev = cymbal(cu1 - cu0 + 0.3, 87)[::-1]
    sx.add(t0 + cu0, rev, 0.6)
    sx.add(t0 + c['potMatch'], thump(0.3, 180), 0.25)
    # plating: spoon clinks; tender motif on EP
    for k in range(4): sx.add(t0 + c['plate'][0] + 0.5 + k * 0.55, fm_bell(note_hz(nm('A6')), 0.25, 3.7, 1.0, 0.08), 0.08, 0.2)
    m.add(t0 + c['plate'][0] - 0.2, pad([note_hz(nm(n)) for n in ['Bb2', 'F3', 'D4']], c['moonLid'] - c['plate'][0] + 2, attack=1.0, release=1.5, cutoff=2400, seed=103), 0.2)
    for k, n in enumerate(motif(nm('Bb4'))):
        m.add(t0 + c['forThis'] + k * 0.42, ep(note_hz(n), 1.8, 0.7), 0.14, -0.1 + 0.05 * k)
    # boxes: tock + motif note each
    b0 = c['boxes'][0]
    notes = [nm(n) for n in ['D5', 'Bb4', 'Eb5', 'Bb4', 'F5', 'C6']]
    for k in range(6):
        tk = b0 + k * 0.92
        sx.add(t0 + tk, wood(500 + k * 30, 0.15), 0.3, 0.2 + 0.08 * k)
        m.add(t0 + tk + 0.45, ep(note_hz(notes[k]), 1.2, 0.8), 0.12, 0.2)
        sx.add(t0 + tk + 0.6, click(700 + k, 3000, 0.03), 0.2, 0.2)
    # moon lid: marker squeak + gold chime
    ml = c['moonLid']
    sq = bp(noise(0.8, 88), 2500, 5000) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * tvec(0.8))) * env_adsr(T(0.8), 0.05, 0.1, 0.6, 0.2)
    sx.add(t0 + ml, sq, 0.06, 0.4)
    sx.add(t0 + ml + 0.9, chime([note_hz(nm('F5')), note_hz(nm('Bb5')), note_hz(nm('D6'))], gap=0.14, dur=1.8), 0.14, 0.4)
    # lights off: click; purple drone foreshadows the raid
    lo = c['lightsOff']
    sx.add(t0 + lo, click(901, 2500, 0.03), 0.4, -0.3)
    m.add(t0 + lo, pad([note_hz(nm(n)) for n in ['D2', 'A2', 'E3']], c['end'] - lo + 1.0, attack=0.6, release=0.5, cutoff=1200, seed=104), 0.35)
    sx.add(t0 + c['end'] - 0.8, riser(0.8, 300, 4000, 89), 0.18)

# ============================================================================ Scene 4
def brass(f, dur, cutoff=3000):
    x = saw(f, dur) + 0.5 * saw(f * 1.005, dur)
    x = sweep_lp(x, 600, cutoff) if dur > 0.05 else x
    return x * env_adsr(T(dur), 0.04, 0.1, 0.8, min(0.3, dur * 0.4))


def score_s4(S, t0, c):
    m, sx, rm, dry = S.music, S.sfx, S.room, S.dry
    beat = 60 / c['bpm']
    rm.add(t0, room_tone(3.4, seed=33, level=0.02), 1.0)
    # room: headset, keyboard, ready-check ding
    sx.add(t0 + c['headset'][1] - 0.2, thump(0.2, 220), 0.15, -0.3)
    for k in range(5): sx.add(t0 + 1.9 + k * 0.08, key_click(40 + k), 0.18, 0.3)
    sx.add(t0 + c['ready'], chime([note_hz(nm('D6')), note_hz(nm('A6'))], gap=0.1, dur=1.0), 0.14, 0.3)
    m.add(t0 + 0.0, lp(pad([note_hz(nm(n)) for n in ['D2', 'A2', 'E3']], 3.4, attack=0.5, release=0.3, cutoff=1200, seed=110), 900), 0.3)
    sx.add(t0 + c['dive'][0], whoosh(0.9, 300, 6000, 111), 0.32)
    # the raid track (D minor), from the dive to the final charge
    g0, g1 = c['dive'][1], c['final'][0] + 0.3
    prog = [['D2', ['D3', 'F3', 'A3', 'C4']], ['Bb1', ['Bb2', 'D3', 'F3', 'A3']], ['C2', ['C3', 'E3', 'G3', 'Bb3']], ['A1', ['A2', 'C#3', 'E3', 'G3']]]
    nb = int((g1 - g0) / beat)
    mot = motif(nm('D5'), minor=True)
    for b in range(nb):
        tb = g0 + b * beat
        bar = b // 4
        ch = prog[bar % 4]
        m.add(t0 + tb, kick(0.35, 140, 45, 1.0), 0.55)
        if b % 2 == 1: m.add(t0 + tb, clap(0.25, 900 + b), 0.32, 0.0)
        m.add(t0 + tb + beat / 2, hat(seed=1000 + b), 0.14, 0.35)
        for e in range(4):
            m.add(t0 + tb + e * beat / 4, sub(note_hz(nm(ch[0])) * (2 if e % 2 else 1), beat / 4 * 0.9) * env_exp(T(beat / 4 * 0.9), 0.06, 0.003), 0.24)
        # 16th arp
        for e in range(4):
            n = nm(ch[1][(b * 4 + e) % 4]) + 12
            m.add(t0 + tb + e * beat / 4, pluck(note_hz(n), 0.4, bright=0.85, seed=b * 4 + e), 0.06, -0.5 if e % 2 else 0.5)
        if b % 4 == 0: m.add(t0 + tb, pad([note_hz(nm(n)) for n in ch[1]], beat * 4 + 0.2, attack=0.05, release=0.3, cutoff=2600, seed=120 + bar), 0.22)
        # brass motif every other bar
        if bar % 2 == 1 and b % 4 == 0:
            for k, n in enumerate(mot):
                m.add(t0 + tb + k * beat / 2, brass(note_hz(n), beat / 2 * 0.95), 0.07, 0.0)
    # boss roar: low growl + noise
    ro = c['roar']
    roar_ = lp(noise(1.6, 112), 700) * (0.6 + 0.4 * np.sin(2 * np.pi * 30 * tvec(1.6))) * env_adsr(T(1.6), 0.1, 0.3, 0.7, 0.6)
    sx.add(t0 + ro, roar_, 0.5)
    sx.add(t0 + ro, sub(55, 1.4, 2.5) * env_adsr(T(1.4), 0.05, 0.3, 0.7, 0.6), 0.4)
    # telegraphs: fill tone rising, then snap impact
    for key in ['cone', 'spread', 'donut', 'lines']:
        a, b_ = c[key]
        n = T(b_ - a)
        tone = sine(np.geomspace(300, 900, n), b_ - a) * np.linspace(0.2, 1, n) * 0.5
        sx.add(t0 + a, tone, 0.07, 0.0)
        sx.add(t0 + b_, impact(1.0, 113 + int(a)), 0.28)
        sx.add(t0 + b_ - 0.25, whoosh(0.35, 800, 3500, 114 + int(a)), 0.18, -0.3)     # her late dodge
        if key != 'donut': sx.add(t0 + b_ + 0.02, fm_bell(note_hz(nm('A6')), 0.5, 2.0, 1.2, 0.15), 0.12, -0.2)  # PERFECT ding
    # death poof + sorry
    sx.add(t0 + c['death'], slide_whistle(900, 1800, 0.25), 0.08, 0.5)
    sx.add(t0 + c['death'] + 0.05, hp(noise(0.3, 115), 1200) * env_exp(T(0.3), 0.08), 0.25, 0.5)
    sx.add(t0 + c['sorry'], fm_bell(note_hz(nm('E6')), 0.3, 2.0, 1.0, 0.1), 0.1, -0.6)
    r0, r1 = c['raise']
    for k in range(8): sx.add(t0 + r0 + k * 0.1, fm_bell(note_hz(nm('A5')) * 2 ** (k * 2 / 12), 0.6, 2.0, 0.8, 0.2), 0.05, 0.5)
    # enrage: siren + stack marker, meteor, shield chime
    e0, e1 = c['enrage']
    sir = sine(note_hz(nm('A4')) * (1 + 0.06 * np.sin(2 * np.pi * 3 * tvec(e1 - e0))) * np.geomspace(1, 1.5, T(e1 - e0)), e1 - e0) * np.linspace(0.3, 1, T(e1 - e0))
    sx.add(t0 + e0, sir, 0.06, 0.0)
    sx.add(t0 + c['stack'], chime([note_hz(nm('D6')), note_hz(nm('D6'))], gap=0.15, dur=0.8), 0.12, -0.3)
    sx.add(t0 + c['meteor'] - 0.6, riser(0.6, 500, 6000, 116), 0.3)
    sx.add(t0 + c['meteor'], impact(2.4, 117), 0.6)
    sx.add(t0 + c['meteor'], cymbal(2.0, 118), 0.4)
    sx.add(t0 + c['meteor'] + 0.1, chime([note_hz(nm(n)) for n in ['D6', 'F#6', 'A6']], gap=0.06, dur=1.6), 0.16)
    # final: drop to a held chord + charge riser; release twang; HIT
    f0 = c['final'][0]
    m.add(t0 + f0, pad([note_hz(nm(n)) for n in ['D3', 'A3', 'D4', 'F4', 'A4']], c['hit'] - f0 + 0.2, attack=0.3, release=0.1, cutoff=3500, seed=130, vowel=True), 0.4)
    ch0, ch1 = c['charge']
    sx.add(t0 + ch0, riser(ch1 - ch0, 300, 8000, 119), 0.35)
    cr = bp(noise(ch1 - ch0, 120), 1500, 4000) * (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(np.geomspace(6, 30, T(ch1 - ch0))) / SR)) * np.linspace(0.1, 1, T(ch1 - ch0))
    sx.add(t0 + ch0, cr, 0.06, 0.2)
    rl = c['release']
    tw = pluck(110, 0.6, bright=0.4)
    sx.add(t0 + rl, tw, 0.5, 0.2)
    sx.add(t0 + rl, whoosh(0.4, 1500, 7000, 121), 0.35, 0.0)
    sx.add(t0 + c['hit'], impact(2.8, 122), 0.7)
    sx.add(t0 + c['hit'], cymbal(3.0, 123), 0.5)
    m.add(t0 + c['hit'], pad([note_hz(nm(n)) for n in ['D2', 'A2', 'D3', 'F#3', 'A3', 'E4']], 3.0, attack=0.02, release=1.8, cutoff=5000, seed=131, vowel=True), 0.5)
    # soften: melt into D major, giant purr, boop
    so0, so1 = c['soften']
    m.add(t0 + so0 + 0.4, pad([note_hz(nm(n)) for n in ['G2', 'D3', 'B3', 'F#4']], so1 - so0 + 1.0, attack=0.8, release=0.8, cutoff=3000, seed=132), 0.32)
    for k, n in enumerate(['B5', 'A5', 'F#5', 'D5']): m.add(t0 + so0 + 0.4 + k * 0.35, fm_bell(note_hz(nm(n)), 1.4, 3.5, 1.0, 0.6), 0.1)
    sx.add(t0 + c['purr'], purr(3.2, 124, rate=18), 0.55)
    sx.add(t0 + c['purr'], sub(36, 3.0, 1.0) * (0.5 + 0.5 * np.sin(2 * np.pi * 18 * tvec(3.0))) * env_adsr(T(3.0), 0.3, 0.2, 0.9, 1.0), 0.3)
    sx.add(t0 + c['boop'], sine(np.geomspace(500, 1200, T(0.12)), 0.12) * env_adsr(T(0.12), 0.003, 0.03, 0.6, 0.05), 0.25, 0.3)
    # victory fanfare (D major) + loot + chat pops
    v = c['victory']
    for k, ch in enumerate([['D3', 'A3', 'D4', 'F#4'], ['G3', 'B3', 'D4', 'G4'], ['A3', 'C#4', 'E4', 'A4'], ['D3', 'A3', 'D4', 'F#4', 'A4']]):
        dur = 0.38 if k < 3 else 1.8
        for n in ch: m.add(t0 + v + k * 0.4, brass(note_hz(nm(n)), dur, 4000), 0.06)
    m.add(t0 + v, kick(0.5, 120, 40), 0.5); m.add(t0 + v + 1.2, cymbal(2.4, 125), 0.4)
    for k, n in enumerate(motif(nm('D5'))): m.add(t0 + v + 1.4 + k * 0.18, pluck(note_hz(n), 0.8, bright=0.8, seed=300 + k), 0.12, -0.4 + 0.16 * k)
    sx.add(t0 + c['loot'], chime([note_hz(nm(n)) for n in ['A5', 'D6', 'F#6', 'A6']], gap=0.07, dur=1.2), 0.14)
    for k, tc in enumerate(c['chat2']): sx.add(t0 + tc, fm_bell(note_hz(nm('E6')) * (1 + 0.05 * k), 0.3, 2.0, 1.0, 0.1), 0.08, -0.6)
    # emote: music thins to a shimmering held chord; bowstring creak; near-silence
    em0 = c['emote'][0]
    m.add(t0 + em0, pad([note_hz(nm(n)) for n in ['D3', 'A3', 'E4', 'F#4', 'B4']], c['end'] - em0 + 0.5, attack=0.8, release=0.6, cutoff=3200, seed=133, vowel=True), 0.3)
    sh = pad([note_hz(nm('A5')), note_hz(nm('E6'))], c['end'] - em0, attack=1.5, release=0.3, cutoff=8000, seed=134)
    m.add(t0 + em0, sh * 0.5, 0.25)
    creak = bp(noise(1.6, 126), 700, 2200) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * np.cumsum(np.geomspace(12, 40, T(1.6))) / SR))) * env_adsr(T(1.6), 0.2, 0.2, 0.6, 0.4)
    sx.add(t0 + em0 + 0.9, creak, 0.08, 0.1)
    sx.add(t0 + c['end'] - 1.2, hp(noise(1.2, 127), 300) * np.linspace(0, 1, T(1.2)) ** 2 * 0.3, 0.12)   # an in-breath into the match cut

# ============================================================================ Scene 5
def crickets(dur, seed=0, density=1.0):
    r = rng(seed); out = np.zeros(T(dur))
    tt = 0.0
    while tt < dur:
        f = r.uniform(4200, 5200)
        for k in range(3):
            ch = sine(f, 0.018) * env_adsr(T(0.018), 0.002, 0.004, 0.6, 0.008)
            i = T(tt + k * 0.045)
            if i + len(ch) < len(out): out[i:i + len(ch)] += ch
        tt += r.uniform(0.25, 0.6) / density
    return out


def score_s5(S, t0, c):
    m, sx, rm, dry = S.music, S.sfx, S.room, S.dry
    D = c['end']
    # outdoor air: wind + distant birds; bow creak under tension
    wind = lp(noise(D, 140), 600) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.2 * tvec(D)))
    rm.add(t0, wind / (np.abs(wind).max() + 1e-9) * 0.05, 1.0)
    for k, tb in enumerate([0.4, 0.62, 1.7, 2.4]):
        f = 3000 + 500 * (k % 2)
        sx.add(t0 + tb, sine(np.geomspace(f, f * 1.3, T(0.1)), 0.1) * env_adsr(T(0.1), 0.005, 0.02, 0.6, 0.05), 0.04, 0.6)
    creak = bp(noise(2.6, 141), 600, 1800) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * np.cumsum(np.geomspace(10, 16, T(2.6))) / SR))) * env_adsr(T(2.6), 0.1, 0.2, 0.5, 0.6)
    sx.add(t0 + 0.2, creak, 0.05, 0.1)
    m.add(t0, pad([note_hz(nm(n)) for n in ['D3', 'A3', 'F#4']], 3.4, attack=0.1, release=1.6, cutoff=2200, seed=142), 0.22)
    # stillness: breath in / out, slow pulse, faint bowl; model shimmer then letting go; true silence before release
    s0, rl = c['still'][0], c['release']
    br = lp(noise(1.6, 143), 900) * env_adsr(T(1.6), 0.8, 0.2, 0.6, 0.6)
    sx.add(t0 + s0, br, 0.07, 0.0)
    sx.add(t0 + s0 + 1.8, lp(noise(1.8, 144), 600) * env_adsr(T(1.8), 0.4, 0.3, 0.5, 1.0), 0.04, 0.0)
    for k in range(4): m.add(t0 + s0 + 0.2 + k * 0.95, kick(0.5, 55, 34, 0.0), 0.18)
    m.add(t0 + s0, bowl(note_hz(nm('D4')), 3.6) * np.linspace(1, 0.2, T(3.6)), 0.06)
    m0, m1 = c['model'][0], c['letGo'][1]
    shim = sum(fm_bell(note_hz(nm(n)), m1 - m0, 3.0, 0.6, 0.6) for n in ['A6', 'D7'])
    sx.add(t0 + m0, shim * np.linspace(1, 0, T(m1 - m0)), 0.04, 0.4)
    # release: twang + slap; doppler whoosh; THUNK + buzz
    sx.add(t0 + rl, pluck(98, 0.8, bright=0.5, seed=7), 0.7, 0.0)
    sx.add(t0 + rl, wood(260, 0.12), 0.3, 0.0)
    fl = whoosh(c['hit'] - rl + 0.1, 3000, 600, 145)
    pc = np.linspace(-0.4, 0.8, len(fl)); L, R = pan_gains(pc)
    sx.add(t0 + rl, np.stack([fl * L, fl * R], axis=1), 0.45)
    hit = c['hit']
    sx.add(t0 + hit, thump(0.4, 110), 0.7, 0.7); sx.add(t0 + hit, wood(500, 0.2), 0.5, 0.7)
    bz = lp(np.sign(np.sin(2 * np.pi * 70 * tvec(0.8))) * np.exp(-tvec(0.8) / 0.18) * (1 + np.sin(2 * np.pi * 9 * tvec(0.8))), 900)
    sx.add(t0 + hit + 0.02, bz, 0.08, 0.7)
    sx.add(t0 + c['score'], chime([note_hz(nm('D6')), note_hz(nm('A6'))], gap=0.12, dur=1.6), 0.15, 0.0)
    sx.add(t0 + c['lowerBow'][0] + 0.3, lp(noise(1.0, 146), 700) * env_adsr(T(1.0), 0.1, 0.3, 0.4, 0.6), 0.05)   # satisfied exhale
    # push into the gold, night falls: wide pad + slow motif on harp-like plucks; crickets fade in
    p0 = c['push'][0]
    m.add(t0 + p0 - 0.4, pad([note_hz(nm(n)) for n in ['D2', 'A2', 'F#3', 'C#4', 'E4']], D - p0 + 1.6, attack=1.6, release=1.4, cutoff=3000, seed=147, vowel=True), 0.36)
    for k, n in enumerate(motif(nm('D5'))):
        m.add(t0 + p0 + 0.4 + k * 0.62, pluck(note_hz(n), 2.4, bright=0.45, seed=500 + k), 0.16, -0.5 + 0.2 * k)
        m.add(t0 + p0 + 0.4 + k * 0.62, pluck(note_hz(n) / 2, 2.4, bright=0.3, seed=520 + k), 0.08, -0.5 + 0.2 * k)
    cr = crickets(D - p0, 148, 1.2) * np.linspace(0, 1, T(D - p0)) ** 1.5
    rm.add(t0 + p0, cr, 0.05, 0.3)
    # moon phase: descending bells as the shadow slides in
    mo = c['moon'][0]
    for k, n in enumerate(['A6', 'F#6', 'D6', 'A5']): m.add(t0 + mo + 1.0 + k * 0.5, fm_bell(note_hz(nm(n)), 2.0, 3.5, 0.9, 0.9), 0.09, 0.3 - 0.2 * k)

# ============================================================================ Scene 6
def score_s6(S, t0, c):
    m, sx, rm, dry = S.music, S.sfx, S.room, S.dry
    D = c['end']
    rm.add(t0, room_tone(D, seed=34, level=0.018), 1.0)
    rm.add(t0, crickets(D, 160, 0.8), 0.03, 0.4)
    # nocturne bed (D major, soft)
    for k, ch in enumerate([['D3', 'A3', 'F#4', 'C#5'], ['B2', 'F#3', 'D4', 'A4'], ['G2', 'D3', 'B3', 'F#4'], ['A2', 'E3', 'C#4', 'G4'], ['D3', 'A3', 'F#4', 'E5']]):
        tb = k * 4.4
        if tb >= D: break
        m.add(t0 + tb, pad([note_hz(nm(n)) for n in ch], 4.8, attack=1.2, release=1.4, cutoff=2400, seed=170 + k), 0.24)
    # cyan: what it is — staccato celesta + counting ticks + the 1.3 s light pulse
    p0, p1 = c['phys']
    cel = [nm(n) for n in ['A5', 'D6', 'F#6', 'A6', 'E6', 'D6', 'C#6', 'A5']]
    tt = p0; k = 0
    while tt < c['merge'][1]:
        m.add(t0 + tt, music_box(note_hz(cel[k % 8]), 0.6), 0.08, -0.55)
        tt += 0.27; k += 1
    for k in range(16): sx.add(t0 + p0 + 0.8 + k * 0.1, tick(600 + k, 4200), 0.05, -0.5)
    l0, l1 = c['lightPulse']
    sx.add(t0 + l0, sine(np.geomspace(2400, 900, T(l1 - l0)), l1 - l0) * env_adsr(T(l1 - l0), 0.02, 0.1, 0.7, 0.2), 0.07, -0.3)
    sx.add(t0 + l1, fm_bell(note_hz(nm('A6')), 1.0, 2.0, 1.0, 0.3), 0.08, -0.5)
    # gold: what it means — legato harp, one note per star edge, card flip
    s0 = c['sym'][0]
    harp = [nm(n) for n in ['D5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6', 'A6', 'B6']]
    for k, n in enumerate(harp):
        tk = c['leo'][0] + (c['leo'][1] - c['leo'][0]) * k / len(harp)
        m.add(t0 + tk, pluck(note_hz(n), 2.2, bright=0.4, seed=700 + k), 0.13, 0.55)
    lg = c['lion'][0]
    sx.add(t0 + lg, purr(1.2, 171, rate=16), 0.08, 0.6)
    cf = c['card'][0]
    sx.add(t0 + cf + 0.5, whoosh(0.3, 1500, 5000, 172), 0.12, 0.6)
    sx.add(t0 + cf + 0.6, bowl(note_hz(nm('A3')), 3.0), 0.12, 0.5)
    # counterpoint while the maps overlap: the harp keeps singing legato under the celesta
    for k, n in enumerate([nm(x) for x in ['F#5', 'E5', 'D5', 'A4', 'B4', 'D5']]):
        m.add(t0 + c['merge'][0] + k * 0.33, pluck(note_hz(n), 1.8, bright=0.35, seed=720 + k), 0.12, 0.5)
    # fly down to the notebook
    sx.add(t0 + c['fly'][0], whoosh(1.2, 3000, 500, 173), 0.15)
    # notebook: page rustle, pencil writing, closing
    sx.add(t0 + c['book'][0], bp(noise(0.5, 174), 1500, 6000) * env_adsr(T(0.5), 0.05, 0.1, 0.5, 0.3), 0.1)
    n0, n1 = c['note']
    pen = bp(noise(n1 - n0, 175), 2500, 7000) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 7 * tvec(n1 - n0)))) * env_adsr(T(n1 - n0), 0.05, 0.1, 0.7, 0.2)
    sx.add(t0 + n0, pen, 0.08, 0.1)
    for k, n in enumerate(motif(nm('D5'))): m.add(t0 + n0 + k * 0.3, music_box(note_hz(n), 1.4), 0.07, 0.0)
    sx.add(t0 + c['close'][1] - 0.05, thump(0.3, 160), 0.25)
    sx.add(t0 + c['close'][0], whoosh(0.5, 800, 2500, 176), 0.1)
    # the phone: a tiny glow-tone
    sx.add(t0 + c['phone'][0] + 0.3, fm_bell(note_hz(nm('F#6')), 0.8, 1.5, 0.5, 0.3), 0.05, 0.3)

# ============================================================================ Scene 7
def score_s7(S, t0, c):
    m, sx, rm, dry = S.music, S.sfx, S.room, S.dry
    D = c['end']
    rm.add(t0, room_tone(D, seed=35, level=0.016), 1.0)
    rm.add(t0, crickets(D, 180, 0.6), 0.025, 0.4)
    m.add(t0, pad([note_hz(nm(n)) for n in ['D3', 'A3', 'F#4']], 9.5, attack=0.8, release=1.5, cutoff=1800, seed=190), 0.2)
    sx.add(t0 + 0.6, lp(noise(0.5, 191), 1500) * env_adsr(T(0.5), 0.05, 0.1, 0.5, 0.3), 0.06)
    sx.add(t0 + 1.6, fm_bell(note_hz(nm('A6')), 0.4, 2.0, 0.6, 0.15), 0.06, 0.2)
    sx.add(t0 + c['phoneIn'][0], whoosh(0.8, 500, 3000, 192), 0.12)
    # typing: soft key clicks
    ty0, ty1 = c['type']; n = c['nChars']
    r = rng(193)
    for k in range(n):
        tk = ty0 + (ty1 - ty0) * k / n + r.normal(0, 0.012)
        sx.add(t0 + tk, key_click(2000 + k) * 0.6, 0.22, 0.05)
    # hesitant phrases: the motif begins and breaks off, again and again
    mot = motif(nm('D5'))
    for start, L in [(2.8, 2), (4.3, 3), (5.9, 2), (7.2, 4), (8.6, 1)]:
        for k in range(L): m.add(t0 + start + k * 0.34, pluck(note_hz(mot[k]), 1.6, bright=0.3, seed=800 + int(start * 10) + k), 0.13, -0.1)
    # alerts: quieter, intimate pings
    for k, ta in enumerate(c['alerts']):
        f = note_hz(nm('E5')) * 2 ** ((k % 4) * 2 / 12)
        sx.add(t0 + ta, fm_bell(f, 0.7, 1.0, 0.6, 0.25) + 0.5 * fm_bell(f * 2 ** (1 / 12), 0.7, 1.0, 0.5, 0.2), 0.08, (-1) ** k * 0.5)
    # the turn starts: whoosh + rising shimmer + echoing clicks (drafts)
    tu0, tu1 = c['turn']
    sx.add(t0 + tu0, whoosh(tu1 - tu0 + 0.3, 150, 1800, 194), 0.25, 0.4)
    shim = pad([note_hz(nm(x)) for x in ['E5', 'F5', 'B5', 'C6']], tu1 - tu0 + 0.2, attack=1.2, release=0.05, cutoff=6000, seed=195)
    m.add(t0 + tu0, shim, 0.22)
    for k in range(24): sx.add(t0 + tu0 + k * 0.07, key_click(3000 + k) * 0.4, 0.12 * (1 - k / 24), r.uniform(-0.9, 0.9))
    # she stops it: thumb press, snap back to quiet
    st = c['stop'][0]
    m.buf[T(t0 + st):T(t0 + st) + T(0.06)] *= np.linspace(1, 0.2, T(0.06))[:, None]
    m.buf[T(t0 + st) + T(0.06):T(t0 + c['breathe'][1])] *= 0.2
    sx.buf[T(t0 + st) + T(0.05):T(t0 + c['breathe'][0])] *= 0.15
    sx.add(t0 + st, thump(0.3, 140), 0.2, 0.6)
    sx.add(t0 + st + 0.02, glass(note_hz(nm('D6')), 1.6), 0.1, 0.6)
    sx.add(t0 + c['breathe'][0], lp(noise(1.1, 196), 800) * env_adsr(T(1.1), 0.3, 0.2, 0.5, 0.5), 0.06)
    # delete: backspace repeat, accelerating, with a descending trickle of tiny notes
    d0, d1 = c['del']
    tk = d0; gap = 0.09; k = 0
    while tk < d1:
        sx.add(t0 + tk, key_click(4000 + k) * 0.5, 0.15, 0.2)
        if k % 3 == 0: m.add(t0 + tk, music_box(note_hz(nm('A6')) * 2 ** (-k / 3 / 12 * 2), 0.4), 0.03, 0.2)
        tk += gap; gap = max(0.025, gap * 0.94); k += 1
    # "Meow!" — five keys play 3-1-4-1-5; the send plays the 9.
    meow_notes = [nm(x) for x in ['F#5', 'D5', 'G5', 'D5', 'A5']]
    for k, tk in enumerate(c['meowKeys']):
        sx.add(t0 + tk, key_click(5000 + k) * 0.5, 0.18, 0.0)
        m.add(t0 + tk, music_box(note_hz(meow_notes[k]), 2.2), 0.16, -0.2 + 0.1 * k)
        m.add(t0 + tk, pluck(note_hz(meow_notes[k]) / 2, 2.0, bright=0.3, seed=900 + k), 0.08)
    sd = c['send']
    sx.add(t0 + sd, whoosh(0.45, 1200, 6000, 197), 0.25, 0.3)
    m.add(t0 + sd, fm_bell(note_hz(nm('E6')), 3.0, 3.0, 1.0, 1.2), 0.18, 0.2)
    m.add(t0 + sd, pad([note_hz(nm(x)) for x in ['D3', 'A3', 'E4', 'F#4']], 2.4, attack=0.05, release=2.0, cutoff=2600, seed=198), 0.18)
    sx.add(t0 + c['delivered'], tick(77, 2600), 0.08, 0.3)
    # the dots: three soft notes, looping, gently (the reply stays open)
    dt0 = c['dots']; tk = dt0; k = 0
    while tk < D - 0.3:
        for j, nn in enumerate(['A4', 'B4', 'D5']): m.add(t0 + tk + j * 0.16, music_box(note_hz(nm(nn)), 0.6), 0.03 + 0.015 * (tk > c['pull'][0]), -0.4)
        tk += 1.25; k += 1
    # pull back: the warmest arrangement of the theme
    p0 = c['pull'][0]
    for k, ch in enumerate([['D3', 'A3', 'F#4', 'A4'], ['B2', 'F#3', 'D4', 'A4'], ['G2', 'D3', 'B3', 'F#4'], ['A2', 'E3', 'C#4', 'E4']]):
        m.add(t0 + p0 + k * 1.8, pad([note_hz(nm(x)) for x in ch], 2.4, attack=0.6, release=1.0, cutoff=2800, seed=200 + k, vowel=True), 0.3)
    for k, nn in enumerate(motif(nm('D4'))): m.add(t0 + p0 + 0.4 + k * 0.6, pluck(note_hz(nn), 2.4, bright=0.35, seed=950 + k), 0.12)
    sx.add(t0 + 24.0, purr(D - 24.0 + 0.5, 199, rate=24), 0.12, -0.3)
    sx.add(t0 + D - 1.2, riser(1.2, 200, 3000, 201), 0.1)


# ============================================================================ Scene 8
def score_s8(S, t0, c):
    m, sx, rm, dry = S.music, S.sfx, S.room, S.dry
    D = c['end']
    # exterior air: wide, high-altitude wind growing
    w = lp(noise(D, 210), 400) * np.linspace(0.4, 1, T(D))
    rm.add(t0, w / (np.abs(w).max() + 1e-9) * 0.05, 1.0)
    # the shared rhythm: two voices pulsing together a third apart (her window and the other one)
    per = 2 * np.pi / 5
    tk = 0.2; k = 0
    while tk < D - 0.5:
        m.add(t0 + tk, music_box(note_hz(nm('F#5')), 0.8), 0.05, -0.3)
        if tk > c['other']: m.add(t0 + tk, music_box(note_hz(nm('A5')), 0.8), 0.05, 0.4)
        tk += per; k += 1
    # the theme, full: pads, choir, strings-ish saws, bass
    prog = [['D2', ['D3', 'A3', 'F#4', 'A4']], ['B1', ['B2', 'F#3', 'D4', 'F#4']], ['G1', ['G2', 'D3', 'B3', 'D4']], ['A1', ['A2', 'E3', 'C#4', 'E4']],
            ['D2', ['D3', 'A3', 'F#4', 'A4']], ['B1', ['B2', 'F#3', 'D4', 'A4']], ['G1', ['G2', 'D3', 'B3', 'G4']], ['A1', ['A2', 'E3', 'C#4', 'G4']], ['D2', ['D3', 'A3', 'F#4', 'D5']]]
    bar = D / len(prog)
    for i, (bs, ch) in enumerate(prog):
        tb = i * bar
        gain = 0.22 + 0.2 * min(1, i / 4)
        m.add(t0 + tb, pad([note_hz(nm(x)) for x in ch], bar + 0.8, attack=0.6, release=1.2, cutoff=2400 + i * 250, seed=220 + i, vowel=i >= 3), gain)
        m.add(t0 + tb, sub(note_hz(nm(bs)), bar + 0.2, 1.2) * env_adsr(T(bar + 0.2), 0.3, 0.2, 0.8, 0.8), 0.18 + 0.03 * i)
    m.add(t0 + c['line1'][0], bowl(note_hz(nm('D2')), 6.0), 0.35)
    m.add(t0 + c['line1'][0], kick(1.0, 70, 32, 0.0), 0.4)
    # line 2: choir lifts; the motif in augmentation (slow, broad)
    l2 = c['line2'][0]
    m.add(t0 + l2, pad([note_hz(nm(x)) for x in ['D4', 'F#4', 'A4', 'D5']], D - l2 + 1.0, attack=1.5, release=1.6, cutoff=3800, seed=230, vowel=True), 0.28)
    for k, nn in enumerate(motif(nm('D5'))):
        m.add(t0 + l2 + 0.4 + k * 1.0, brass(note_hz(nn), 1.6, 2600), 0.084, -0.2 + 0.08 * k)
        m.add(t0 + l2 + 0.4 + k * 1.0, pluck(note_hz(nn), 2.0, bright=0.5, seed=960 + k), 0.072, -0.2 + 0.08 * k)
    m.add(t0 + l2, cymbal(3.0, 231), 0.18)


# ============================================================================ Scene 9
def score_s9(S, t0, c):
    m, sx, rm, dry = S.music, S.sfx, S.room, S.dry
    D = c['end']
    # rush back down
    r0, r1 = c['rush']
    sx.add(t0 + r0, riser(r1 - r0, 300, 9000, 240), 0.35)
    sx.add(t0 + r0, whoosh(r1 - r0 + 0.2, 6000, 300, 241), 0.35)
    sx.add(t0 + r1, thump(0.5, 90), 0.4)
    m.add(t0 + r1 - 0.1, cymbal(2.0, 242)[::-1][:T(0.2)], 0.2)
    rm.add(t0 + r1, room_tone(D - r1, seed=36, level=0.016), 1.0)
    rm.add(t0 + r1, crickets(D - r1, 243, 0.7), 0.025, 0.4)
    m.add(t0 + r1, pad([note_hz(nm(x)) for x in ['D3', 'A3', 'F#4']], c['wiggle'][0] - r1 + 0.6, attack=0.5, release=0.6, cutoff=1800, seed=244), 0.2)
    # stare: ear twitch ticks
    for tk in [2.6, 3.4, 4.1]: sx.add(t0 + tk, click(250 + int(tk * 10), 3500, 0.02), 0.05, 0.1)
    # wiggle: comedic suspense — pizz tremolo + rolling low drum, crescendo
    w0, w1 = c['wiggle']
    tk = w0; k = 0
    while tk < c['nope'] - 0.02:
        u = (tk - w0) / (w1 - w0)
        m.add(t0 + tk, pluck(note_hz(nm('A3')) * (1 + 0.0 * u), 0.2, bright=0.3, seed=1000 + k), 0.08 + 0.12 * u, 0.0)
        m.add(t0 + tk, kick(0.2, 90, 60, 0.1), 0.06 + 0.18 * u)
        tk += max(0.06, 0.16 - 0.1 * u); k += 1
    sx.add(t0 + w0, riser(w1 - w0, 200, 2500, 245), 0.12)
    # nope: deflate
    sx.add(t0 + c['nope'], slide_whistle(700, 200, 0.7), 0.12)
    m.add(t0 + c['nope'] + 0.3, pluck(note_hz(nm('D3')), 0.8, bright=0.2), 0.25)
    sx.add(t0 + c['nope'] + 0.05, thump(0.3, 120), 0.2)
    # yawn (a low, long cat voice)
    sx.add(t0 + c['yawn'][0], meow(0.9, 300, 420, 220, 246), 0.12, 0.1)
    # curl: harp glissando down, purr
    cu0, cu1 = c['curl']
    gl = [nm(x) for x in ['A6', 'F#6', 'D6', 'A5', 'F#5', 'D5', 'A4', 'F#4', 'D4']]
    for k, nn in enumerate(gl): m.add(t0 + cu0 + k * (cu1 - cu0) / len(gl), pluck(note_hz(nn), 2.0, bright=0.5, seed=1100 + k), 0.1, 0.4 - 0.1 * k)
    sx.add(t0 + cu0 + 0.6, purr(D - cu0, 247, rate=25), 0.16, 0.1)
    # phone: a soft buzz, a gentle major chime (no alarm)
    sx.add(t0 + c['buzz'], phone_buzz(0.25, 9) * 0.5, 0.25, -0.5)
    sx.add(t0 + c['banner'], chime([note_hz(nm('D6')), note_hz(nm('F#6')), note_hz(nm('A6'))], gap=0.14, dur=1.8), 0.18, 0.0)
    # title: the motif on the music box, then the final chord resolving home
    ti = c['title'][0]
    m.add(t0 + ti - 0.5, pad([note_hz(nm(x)) for x in ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4']], D - ti + 1.0, attack=1.4, release=1.2, cutoff=2600, seed=248, vowel=True), 0.32)
    for k, nn in enumerate(motif(nm('D5'))): dry.add(t0 + ti + 0.3 + k * 0.42, music_box(note_hz(nn), 2.0), 0.14, -0.3 + 0.12 * k)
    dry.add(t0 + ti + 0.3 + 6 * 0.42 + 0.3, music_box(note_hz(nm('D5')), 3.0), 0.16, 0.0)
    # gentle fade to silence
    i0 = T(t0 + D - 1.2)
    for st in (m, sx, rm, dry):
        st.buf[i0:i0 + T(1.2)] *= np.linspace(1, 0, T(1.2))[:, None]
        st.buf[i0 + T(1.2):] *= 0


SCORES = {'s1': score_s1, 's2': score_s2, 's3': score_s3, 's4': score_s4, 's5': score_s5, 's6': score_s6, 's7': score_s7, 's8': score_s8, 's9': score_s9}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cues', default=os.path.join(HERE, 'cues.json'))
    ap.add_argument('--scenes', nargs='*')
    ap.add_argument('--out', default=os.path.join(HERE, 'out', 'score.wav'))
    a = ap.parse_args()
    cues = json.load(open(a.cues))
    scenes = [s for s in cues['scenes'] if not a.scenes or s['id'] in a.scenes]
    t_base = scenes[0]['start']
    total = sum(s['duration'] for s in scenes)
    S = Stems(total + 1)
    for s in scenes:
        print('scoring', s['id'], 'at', s['start'] - t_base)
        SCORES[s['id']](S, s['start'] - t_base, s['cues'] | {'end': s['duration']})
    # gain staging per scene (keeps the intimate scenes audible on small speakers), 0.4 s ramps at boundaries
    SCENE_GAIN = {'s3': 1.25, 's5': 1.45, 's6': 1.45, 's7': 1.55, 's9': 1.25}
    g = np.ones(S.music.n)
    for sc in scenes:
        gg = SCENE_GAIN.get(sc['id'], 1.0)
        if gg == 1.0: continue
        a0, a1 = T(sc['start'] - t_base), T(sc['start'] - t_base + sc['duration'])
        g[a0:a1] = gg
    k = T(0.4); cs = np.concatenate([[0.0], np.cumsum(g)]); idx = np.arange(len(g)); lo = np.clip(idx - k // 2, 0, len(g)); hi = np.clip(idx + k // 2, 0, len(g)); g = (cs[hi] - cs[lo]) / np.maximum(1, hi - lo)
    for st in (S.music, S.sfx, S.room, S.dry): st.buf *= g[:, None]
    music = reverb(S.music.buf, wet=0.28, seconds=2.6, damp=5000)
    sfx = reverb(S.sfx.buf, wet=0.16, seconds=1.4, damp=6000, seed=41)
    dry = reverb(S.dry.buf, wet=0.45, seconds=3.2, damp=4000, seed=42)
    mixd = music * 0.9 + sfx * 1.0 + S.room.buf + dry
    mixd = mixd[:T(total)]
    # gentle master: normalise loudness then soft-limit
    rms = np.sqrt(np.mean(mixd ** 2))
    mixd *= (10 ** (-17 / 20)) / max(rms, 1e-9)
    mixd = soft_limit(mixd, 0.8)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    write_wav(a.out, mixd)
    # stems for later remixing
    for name, st in [('music', music), ('sfx', sfx), ('room', S.room.buf), ('dry', dry)]:
        write_wav(a.out.replace('.wav', f'_{name}.wav'), np.clip(st[:T(total)] * 0.5, -1, 1))
    print(a.out, loudness_report(mixd), f'{total:.2f}s')


if __name__ == '__main__':
    main()

"""Builds sounds/<instrument>.js from the FluidR3 GM SoundFont as rendered by gleitz/midi-js-soundfonts (CC BY 3.0).

For each note in the instrument's range: decode, measure the pitch actually recorded (mean over 93 ms frames of the
fundamental, strong frames only, so vibrato averages out), trim from the onset, fade the tail, peak-normalize, measure
loudness (RMS after a 200 Hz high-pass, loudest 100 ms), and re-encode as mono 64 kbps MP3.
Each note is stored as [measured Hz, loudness, base64 MP3]; the app retunes playback to the exact target.

Needs numpy, scipy and ffmpeg (with libmp3lame). Run from the repo root: python3 tools/make_sounds.py
"""
import base64, os, re, subprocess, urllib.request
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
SRC = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/{}-mp3.js'
# app id: (soundfont name, lowest MIDI, highest MIDI, clip seconds). Ranges are the real instrument's within C3–C8,
# cut where these recordings go bad: the violin warbles above A6 and the organ is silent above C7.
INST = {'piano': ('acoustic_grand_piano', 48, 108, 2.6), 'guitar': ('acoustic_guitar_nylon', 48, 83, 2.6),
        'violin': ('violin', 55, 93, 2.0), 'flute': ('flute', 60, 98, 2.0), 'marimba': ('marimba', 48, 96, 2.6),
        'bells': ('glockenspiel', 79, 108, 2.6), 'organ': ('church_organ', 48, 96, 2.0)}
PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
HP = butter(2, 200, 'hp', fs=SR, output='sos')

def notes(sf):
    txt = urllib.request.urlopen(SRC.format(sf)).read().decode()
    out = {}
    for name, b64 in re.findall(r'"([A-G]b?-?\d)":\s*"data:audio/mp3;base64,([^"]+)"', txt):
        m = re.fullmatch(r'([A-G])(b?)(-?\d)', name)
        out[12 * (int(m.group(3)) + 1) + PC[m.group(1)] - (1 if m.group(2) else 0)] = base64.b64decode(b64)
    return out

def decode(mp3):
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', '-', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         input=mp3, capture_output=True).stdout
    return np.frombuffer(pcm, dtype=np.float32).astype(np.float64)

def pitch(x, f, on):
    """Mean recorded pitch near f, in Hz."""
    L, hop, N = 4096, 1024, 1 << 16
    w = np.hanning(L); fr = np.fft.rfftfreq(N, 1 / SR)
    r = 2 ** (70 / 1200); i0, i1 = np.searchsorted(fr, f / r), np.searchsorted(fr, f * r)
    out = []
    for s in range(on + int(0.1 * SR), min(len(x) - L, on + int(2.0 * SR)), hop):
        X = np.abs(np.fft.rfft(x[s:s + L] * w, N))
        k = i0 + int(np.argmax(X[i0:i1]))
        a, b, c = np.log(X[k - 1:k + 2] + 1e-12)
        out.append((1200 * np.log2((k + 0.5 * (a - c) / (a - 2 * b + c)) * SR / N / f), X[k]))
    out = np.array(out)
    cents = out[out[:, 1] >= 0.1 * out[:, 1].max(), 0]                  # only frames well above the noise
    return f * 2 ** (np.mean(cents[np.isfinite(cents)]) / 1200)

def main():
    os.makedirs('sounds', exist_ok=True)
    for app, (sf, lo, hi, dur) in INST.items():
        raw, rows = notes(sf), []
        for m in range(lo, hi + 1):
            x = decode(raw[m]); pk = np.max(np.abs(x))
            assert pk > 0.01, f'{app} {m} is silent'
            f = 440 * 2 ** ((m - 69) / 12)
            on = int(np.argmax(np.abs(x) > 0.02 * pk))
            hz = pitch(x, f, on)
            s = max(0, on - int(0.002 * SR)); y = x[s:s + int(dur * SR)].copy()
            n, fi, fo = len(y), int(0.002 * SR), int(0.3 * SR)
            y[:fi] *= np.linspace(0, 1, fi); y[n - fo:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, fo))
            y *= 0.95 / np.max(np.abs(y))
            z = sosfilt(HP, y); W = int(0.1 * SR)
            loud = max(np.sqrt(np.mean(z[i:i + W] ** 2)) for i in range(0, n - W, W // 2))
            mp3 = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                                  '-c:a', 'libmp3lame', '-b:a', '64k', '-f', 'mp3', '-'],
                                 input=y.astype(np.float32).tobytes(), capture_output=True).stdout
            rows.append(f'{m}:[{hz:.3f},{loud:.4f},"{base64.b64encode(mp3).decode()}"]')
        js = ('/* FluidR3 GM SoundFont by Frank Wen, CC BY 3.0, as rendered by gleitz/midi-js-soundfonts.\n'
              '   Changed for My Ear Hertz: mono clips, trimmed and faded, peak-normalized; each note is [measured Hz, loudness, MP3]. */\n'
              f'(window.MEH_SOUNDS = window.MEH_SOUNDS || {{}}).{app} = {{\n' + ',\n'.join(rows) + '\n};\n')
        open(f'sounds/{app}.js', 'w').write(js)
        print(f'{app:8s} {hi - lo + 1:3d} notes  {len(js) / 1e6:.2f} MB')

if __name__ == '__main__':
    main()

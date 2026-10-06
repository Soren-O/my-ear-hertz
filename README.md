# My Ear Hertz

Perfect pitch training from C3 to C9 (131 Hz to 8,372 Hz), not just the standard scale, but arbitrary frequencies.

Play it at **https://soren-o.github.io/my-ear-hertz/** (earbuds recommended; on an iPhone, turn off silent mode).

Still in beta. 

The app is the single file `index.html`. `sounds/` holds the instrument recordings, one file per instrument,
loaded only when that instrument is used; `tools/make_sounds.py` rebuilds them.

Instrument sounds: [FluidR3 GM SoundFont](https://github.com/gleitz/midi-js-soundfonts) by Frank Wen,
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), as rendered by gleitz/midi-js-soundfonts.
Changed here: cut to short mono clips, faded, level-matched, and retuned on playback to each note's measured pitch.

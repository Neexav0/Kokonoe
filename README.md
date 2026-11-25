# Kokonoe 九重

**Nine anime heroines, frame by frame.** A scroll-driven fan site that tells how an anime frame is made — from the first blue-pencil line to the finished colour — and then lets you play with nine heroines: open their character sheets, wipe between sketch and paint, slow their clips down to see the drawings, rank them, guess them by their eyes and print a poster of your favourites.

Built with plain HTML, CSS and JavaScript. No framework, no build step.

> Makima · Mikasa Ackerman · Yor Forger · Shinobu Kocho · Mitsuri Kanroji · Marin Kitagawa · Nico Robin · Hinata Hyuga · Kaoruko Waguri

---

## What's on the page

| Section | What happens |
| --- | --- |
| **Preloader** | A rolling counter tied to real image loading, a 九 drawn in one stroke, and a split curtain that opens on the first frame. |
| **The first frame** | Makima's portrait as live blue-pencil line art. Move the mouse over it and the frame tilts in 3D while your cursor paints the colour through the sketch. Scrolling inks her in, explodes the frame into five compositing passes with callouts, flips through all nine heroines and zooms into a full-bleed finale under anime focus lines. |
| **The nine** | A sideways film strip pushed by your scroll. It leans with scroll speed and splits into red and cyan copies on fast flicks. Click a frame to open her character sheet. |
| **Character sheets** | The frame flies into a full-page profile: her art, a colour palette sampled from it (click to copy hex codes), her clip with six stills, and what she's known for. Swipe or use the arrow keys for the next heroine. |
| **Pencil to paint** | Drag a divider between her art and a pencil drawing of it. The sketch is real edge detection, redrawn 12 times a second so the lines shimmer like hand-drawn animation. |
| **On ones, twos and threes** | The same clip held for 1, 2 or 3 film frames per drawing, beside a scrolling animator's timesheet. Step frame by frame or go slow-motion. |
| **Keep or pass** | A card deck you drag or flick. Keeps go into your lineup. |
| **Whose eyes?** | Six rounds of eye close-ups from the clips. A right answer flips a card to reveal her, stamps 正解, adds her to your lineup and rains petals that pile up — sweep the mouse through the heap to scatter them. |
| **Rank the nine** | Drag heroines into S, A and B tiers. Saved on your device and exportable as a PNG. |
| **Your lineup** | Saved between visits, shareable as a link, and printable as a poster card. |
| **Credits** | Names pop in letter by letter, 終 cracks in two and a fan of all nine portraits opens behind it. |

**Everywhere:** a WebGL "ink in water" background that your pointer paints in the current heroine's colour and that pulses with the music; a custom gradient-arrow cursor with labels; magnetic buttons; pictures that drift, glare and ripple under the mouse; marquee bands that follow your scroll; and a looping soundtrack.

---

## Run it locally

You need Python 3 (for the dev server) and the media files described below.

```bash
python serve.py        # run from the repository root
# open http://localhost:5181/
```

`serve.py` is a tiny static server with **HTTP range support**. Python's built-in `http.server` ignores range requests, which stops browsers seeking inside videos, so use this one rather than `python -m http.server`.

Click or press a key once to start the music (browsers block sound until you interact). Press **M** or use the equalizer in the header to pause it.

### Media (not in the repo)

The clips, art and music are git-ignored (`media/`) because they are large and belong to their creators. To run the site, put them here:

```
media/
├── makima.mp4, mikasa.mp4, yor.mp4, shinobu.mp4, mitsuri.mp4,
│   marin.mp4, robin.mp4, hinata.mp4, waguri.mp4      ← short 16:9 clips
├── art/
│   └── makima.jpg … waguri.jpg                        ← portrait art, one per heroine
└── audio/
    └── suzume.mp3                                     ← background music
```

- **Clips:** `python tools/prepare_media.py` copies them from an `Anime-Iconic-Faces/Videos/` folder sitting next to this repository (edit `SRC` in the script to point elsewhere) and moves each MP4's index to the front of the file so it can stream (the originals are not changed).
- **Art:** portrait images named by heroine id. Each heroine's face position (`fy`) and best frames are set in `js/data.js`.
- **Music:** any MP3 at `media/audio/suzume.mp3`.

---

## How it's built

| File | Role |
| --- | --- |
| `index.html` | All sections and markup |
| `style.css` | The story, film strip and core layout |
| `features.css` | Every feature section, the cursor, loader, marquees and effects |
| `main.js` | The scroll timeline: story, film strip, deck and credits |
| `js/data.js` | The nine heroines, shared helpers and a spring integrator |
| `js/store.js` | Saved state (lineup, tiers, quiz best) and sound/modal flags |
| `js/bg.js` | WebGL ink-in-water background (ping-pong trail + composite shader) |
| `js/audio.js` | Soundtrack, ducking and the beat analyser |
| `js/pencilize.js` | Sobel edge detection that turns any image into blue-pencil line art |
| `js/sheet.js` · `pencil.js` · `timing.js` · `tier.js` · `quiz.js` · `lineup.js` | The interactive sections |
| `js/cursor.js` · `tilt.js` · `ripple.js` · `petals.js` · `marquee.js` · `loader.js` · `scramble.js` · `drawer.js` · `reveal.js` · `toast.js` · `stills.js` | Effects and shared pieces |

Notes:

- Scroll-driven motion reads one smoothed scroll value and writes only `transform`, `opacity` and `clip-path`.
- Gestures track the pointer 1:1 and finish with velocity-seeded springs, so a flick lands where it was thrown.
- Saved data lives in `localStorage` on the visitor's device only.

---

## Accessibility

- `prefers-reduced-motion` is respected: 3D tilts, scatters, ripples, petals and the cursor are switched off, and the rest fades instead of moving.
- Every interaction works with a keyboard: arrow keys move tier cards and the sketch divider, Escape closes dialogs, and focus is trapped inside open sheets and the poster.
- Live regions announce quiz results, tier moves and lineup changes.
- On touch screens, tier cards need a short press-and-hold before they lift, so swiping still scrolls the page. A bottom-sheet chapters menu replaces the header links.

---

## Credits

- **Characters** belong to their creators and studios: *Chainsaw Man*, *Attack on Titan*, *Spy x Family*, *Demon Slayer*, *My Dress-Up Darling*, *One Piece*, *Naruto*, *The Fragrant Flower Blooms with Dignity*.
- **Art:** Pinterest pins, credited to their original artists.
- **Music:** "Suzume" by RADWIMPS feat. Toaka.
- **Fonts:** [Dela Gothic One](https://fonts.google.com/specimen/Dela+Gothic+One) and [Zen Kaku Gothic New](https://fonts.google.com/specimen/Zen+Kaku+Gothic+New).

Kokonoe is a non-commercial fan tribute. No character art, clips or music are included in this repository.

# Course Player Prototype

Explores **continuous video playback across course lessons**: every lesson is its
own route with its own video, and playback carries from one lesson into the next
without the player being torn down.

**Live demo:** https://rodrigoscna.github.io/course-player-prototype/

```bash
yarn        # first run only
yarn dev    # http://localhost:5173
yarn test   # domain unit tests
```

## How the continuity works

One `video.js` instance is created lazily in `src/player/playerSingleton.ts` and
never disposed. Its element lives in an offscreen holder attached to the document
and is *moved* into whichever lesson page is mounted:

- `PlayerSlot` renders an empty div and moves the player element into it in a
  **layout** effect. React never owns that element, so it is never re-created.
- On unmount the element is parked back in the holder — never disposed.
- When a clip ends, the controller sets the next source on the *same* player and
  then pushes the next lesson's route, so the media never waits on React.
- Within a course, only the lesson slug changes, so React reconciles the lesson
  page in place and the element does not move at all.

Three guards keep that honest, each protecting against a failure that looks like
the architecture itself not working:

| Guard | Without it |
|---|---|
| `PlayerSlot` uses `useLayoutEffect` | Passive cleanup runs after React removes the DOM node, so the video pauses on every navigation |
| `setLesson` is idempotent on lesson id | Advancing works but every transition snaps back to 0:00 |
| `advancing` flag + `loadstart` release | A doubled `ended` advances two lessons at once |

## Navigating without hijacking playback

Two things that look like one are kept separate: the **playing lesson** (what the
player has loaded) and the **route lesson** (the page you are reading). A lesson
page claims the player only when it is idle — nothing loaded, or loaded and never
started — so arriving somewhere while another lesson plays leaves it alone. Taking
over is always explicit, via **Play this lesson** on the poster.

Where the player goes is a pure decision in `src/player/dockPolicy.ts`:

| Route vs playing lesson | Player |
|---|---|
| same | docked inline in the page, leaving any floating window it was in |
| differs, has played | the floating player — which one depends on the mode below |
| differs, nothing played yet | parked in the holder — nothing worth floating |

## Two floating players

The header's **Floating player** selector switches between the two approaches, so
they can be compared rather than argued about. They are not equivalent.

| | Native picture-in-picture | Custom container |
|---|---|---|
| Who draws it | the browser | this app |
| Custom controls | impossible | previous, next, seek, back to lesson |
| Needs a user gesture | yes, and can refuse | no |
| While paused | the window closes | stays open, and can resume |
| Leaving the tab | keeps playing | gone |
| Across lesson boundaries | dropped (see limitations) | survives |
| Second tab | replaces the first, free | both play |

The custom container runs `video.js` **headless**: `controls(false)` turns its UI
off and the app drives playback through the API. It is a per-dock decision, so the
inline player keeps video.js's own controls and only the floating one gives them
up. `snapshot.headless` and the debug panel report which is in force.

It has the design's two states, decided in `decideFloatingSize`:

| State | When |
|---|---|
| `large` | a video belonging to a lesson you are not looking at |
| `small` | audio-only content, or a video you collapsed by hand |

The design also lists the current lesson's own header media as a small-state case.
That cannot arise here — while you are on the playing lesson the dock is `inline`,
so reaching it would need scroll tracking. The collapse button covers it on demand.

Both floating players hold the *same single element*. There is no second instance
and so nothing to keep in sync, which is the part worth carrying back: the cost of
synchronising two players is not in this design.

The header's **When a clip ends elsewhere** toggle decides what an ending clip
does while you are reading a *different* lesson. When you are watching the lesson
that ends, all three modes navigate — that is following along, not a hijack.

| Mode | At the boundary, while you are away |
|---|---|
| `keep-route` | playback advances, your page stays put |
| `follow` | the route chases the media |
| `stop` | playback pauses at the boundary; Up next waits for an explicit go |

`document.pictureInPictureElement` is the only source of truth for float state —
never a local boolean. A refused request is not fatal: playback carries on parked
and `NowPlayingBar` keeps it findable, with **Pop out** to float it deliberately.

## Data model

Mirrors the production Table of Contents. There is no course or section entity:
sections, lessons and quizzes are all the same record type in a self-referential
tree, discriminated by `prompt_type` and ordered by a **sibling-scoped**
`position`. Fixtures are a **flat array plus `parent_id`**, exactly what the real
endpoint returns; the tree, the nested structure and the linear playback order
are all derived client-side in `src/domain/`.

Progress and video positions are separate payloads, as they are on the server —
that split is what lets this map back onto the real app.

Course A ("Foundations of Film") has sections, a quiz and a hidden lesson, so the
playback chain has to step over all three. Course B is flat with nothing locked.

## Verifying continuity

`window.__probe` is installed in the browser. The debug panel in the header shows
the same numbers live.

```js
__probe.createCount()   // must stay 1 for the whole session
__probe.playerCount()   // exactly one .video-js in the DOM
__probe.detaches        // 0 — any detach is a continuity bug
__probe.boundaries      // ms from one clip's `ended` to the next clip's `playing`
__probe.lastBoundaryTape().map(e => e.type)
// expected: ended → emptied → loadstart → loadedmetadata → … → playing
// a `pause` in that tape is the signature of a broken reparent
```

Use **Jump to last 3s** in the debug panel rather than watching clips end.

## Known limitations

**Only exercised in Chrome.** Whether Safari and Firefox keep a *playing* video
playing when its element is reparented is the load-bearing assumption of this
whole design, and it is unverified. If either pauses on reparent, the single
instance — and with it the absence of any synchronisation problem — does not hold.
Untested on mobile web.

**Going headless gives up what the control bar provided:** captions above all,
plus playback rate, volume, fullscreen and keyboard shortcuts. Anything the
floating player needs from that list has to be rebuilt.

**Native picture-in-picture does not survive a lesson boundary.** Chrome's rule is
"a gesture is required unless something is already in picture-in-picture", so a
click-driven navigation floats the player fine — the click's activation is still
live when the dock effect runs. But swapping `src` drops the element's readyState
to nothing, which ends the picture-in-picture session; by the time the next clip
can be floated there is no gesture left, and the automatic re-request is refused.
Playback continues parked, and **Pop out** re-floats it in one click. Keeping the
window across a boundary would need MSE, so one source feeds every clip. The
custom container is not subject to any of this — it is our own element, so a
source swap does not close it.

**Sample clips must carry an audio track.** Browsers pause video-only media once
the tab stops being visible, which is exactly the case a floating player exists to
serve — a silent clip cannot demonstrate continuity because the browser stops it.
`src/data/videosFixture.ts` records how to check a candidate; reaching
`loadedmetadata` is not enough to prove one plays.

A single `<video>` swapping `src` cannot be *truly* gapless: the next source
still needs metadata and a first frame, so expect roughly 100–400 ms of black at
each boundary over the network. This removes the player-teardown and route-change
gap, not the source-load gap. Vendoring the clips into `public/videos/` cuts it
to well under 100 ms; genuinely gapless playback would need MSE or a pair of
alternating players.

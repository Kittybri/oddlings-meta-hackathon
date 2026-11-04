# Oddlings

Play: https://oddlings-meta.ai.studio/
Source: https://github.com/Kittybri/oddlings-meta-hackathon
License: Apache-2.0 (see LICENSE).

Photograph an everyday object, incubate its egg, and welcome a pixel creature into a world you can build. Talk to your creatures, watch them chat with each other, send them on photo quests, and fuse them into hybrids with traceable inherited traits.

## Meta integration

Oddlings uses the Muse Spark Open and Muse Image model families through three provider integrations. Every call goes through the app's own server; no API key belongs in client code or a `VITE_` variable.

| Feature | Meta model | Served by | Server route |
|---|---|---|---|
| Object recognition and creature design | Muse Spark Open (`meta-models/muse-spark-open-1026`) | Baseten | `/api/baseten/analyze` |
| Live fusion of two creatures | Muse Spark Open | Baseten | `/api/baseten/fuse` |
| Creature diary entries and speech lines | Muse Spark Open | Baseten | `/api/baseten/voice` |
| Sprite color review of the traced photo sprite | Muse Spark Open | Baseten | `/api/baseten/sprite` |
| Hatch-name suggestions | Muse Spark Open | Fireworks | `/api/fireworks/name` |
| Photo-item design and estimated height | Muse Spark Open | Baseten | `/api/baseten/item` |
| Hybrid artwork from both parents | Muse Image | Meta Model API | `/api/meta/fusion-art` |
| AI photo-biome scenery | Muse Image | Meta Model API | `/api/meta/biome-art` |
| Creature artwork drawn from the photo | Muse Image (`muse-image-1.0`) | Meta Model API (`api.meta.ai/v1/images/edits`) | `/api/meta/creature-art` |
| Talk to your creature | Muse Spark Open (`accounts/fireworks/models/muse-spark-open`) | Fireworks | `/api/fireworks/chat` |
| Creatures talking to each other | Muse Spark Open | Fireworks | `/api/fireworks/banter` |
| Photo quests (vision check of the player's photo) | Muse Spark Open | Fireworks | `/api/fireworks/quest` |

Slow model calls run as background jobs: the POST route returns a `jobId` and the browser checks `GET <route>/:id` every few seconds. This keeps requests short for hosts that cut off long requests.

### What each feature does

- **Recognition and design.** Meta generates names, traits, material, palette, anatomy data and ability descriptions from an unselected photo. Bounded game rules map the generated ability to energy restoration, seed watering or trust gain; those rules, not model code, change game state.
- **Creature artwork.** Muse Image redraws the photographed object as a cute 8-bit creature in one house style (keeps the object's shape, colors and markings, adds small feet, white background, no hands, no face). The game cuts away the white background (including holes such as a mug handle), adds its own blinking pixel eyes and mood mouth, a thin dark outline, and a squash-and-stretch idle animation. Successful drawings are cached in the browser to reduce repeated calls; retries, cleared storage, and another browser can still incur another provider request. If no `META_API_KEY` is set, or a drawing fails, the creature falls back to a sprite traced from the photo (see below).
- **Talk.** The TALK button opens a chat window. The creature answers in its own voice and knows its object, material, personality, ability, feelings about rain, friendship hearts, energy, mood, the world's time of day and weather, and its five newest memories.
- **Creature banter.** About every 75 seconds, two residents of the same world have a 4-line speech-bubble exchange. Their materials decide whether they act as friends (for example Ceramic with Thermal), playful rivals (for example Glass with Thermal) or new neighbors. Both creatures remember the chat.
- **Photo quests.** The QUEST button shows a request such as "something round" or "a plant or a flower". The player takes or uploads a photo; Muse Spark checks it and replies in character. A match gives one friendship heart, 15 energy and a memory.

### Honest boundaries

- **SAM is not integrated.** Object cut-out for the traced sprite uses Google's MediaPipe Interactive Segmenter in the browser (a non-Meta tool), with local color rules as a fallback.
- **Muse Image has been checked on five real photos** (see [Evidence](#evidence-real-photos-to-oddlings)), not on a large set. Results vary from run to run; the five shown are the first and only run, not picked from several.
- The traced photo sprite is local canvas processing (segmentation, hand removal, palette quantization). Muse Spark only suggests colors and the face position; it does not draw it.
- Custom biome backgrounds have two distinct modes: local canvas conversion stays on-device; AI scenery sends a compressed photo through the server to Muse Image. Local conversion is never labeled Meta generation.
- Starter/manual creatures and local fallback sprites remain distinct from live Meta results. The current Fusion Lab uses live Muse Spark trait synthesis followed by Muse Image artwork; local fallback must not be presented as a successful live fusion.
- Model replies are sometimes unusable. The app validates every reply, retries banter once, and shows a clear message instead of inventing results.

### Spending limits and interrupted jobs

- Current runtime default: **2,000 cents ($20) per UTC day in estimated reservations**, configurable with `AI_DAILY_BUDGET_CENTS`; this is not measured provider billing. Each image request reserves 10 cents and each text/vision request 5 cents, including failed attempts conservatively. Daily counts also cap image requests at 100 and text/vision requests at 500. The older lifetime image counter remains in `meta-usage.json`.
- `AI_MAX_CONCURRENT` defaults to **4**. Background work retains its slot until it settles, rather than releasing it as soon as a job ID is returned. Over-limit requests receive a friendly retryable HTTP 429.
- Existing per-player limits remain: Fireworks 40 requests/10 minutes, creature and fusion artwork 10/hour each, biome artwork 6/hour. Baseten also retains its existing shared limiter. Cloud Run's one trusted proxy hop supplies `req.ip`; the app no longer selects a caller-controlled leftmost forwarding value.
- Daily reservations use `ai-daily-usage.json` and in-memory concurrency. This is shared within one server instance, not a hard cross-instance or fresh-container spending guarantee. A production multi-instance deployment needs shared durable accounting and provider-side billing controls.
- Missing/expired background jobs return a terminal retry message. Pollers stop; fusion refunds its 20 Sparkles on failure, unsuccessful egg analysis refunds its seed, and failed quest checks refund their reservation. Photo items spend a gem when saving an item, so a lost drawing alone has no gem charge to undo. Successful local fallback items still cost their normal gem if saved.
- Banter is throttled, waits before reusing a pair, and pauses when relevant windows or tab visibility prevent it.

## Evidence: real photos to Oddlings

Five real photos from Wikimedia Commons (not drawings), run through the same two live Meta steps the incubator uses on November 3, 2026. The artwork shown is the first generated artwork for each photo; no art was edited or re-rolled. One recognition request needed the retry described below.

![Five real photos beside the Oddlings Meta made from them](photo-to-oddling.png)

| Photo | Muse Spark recognized | Creature | Muse Spark time | Muse Image time |
|---|---|---|---:|---:|
| White enamel mug with a skull print | Enamel Camp Mug, white enameled steel with black rim | Grimbrew | 8 s | 20 s |
| Black wireless mouse | Wireless Computer Mouse, matte ABS plastic | Clickwhisker | 13 s | 22 s |
| Two knives and two forks on green cloth | Dinner Fork, polished stainless steel | Tinefang | 14 s | 16 s |
| Black and white checkered Vans sneaker | Checkerboard Canvas Sneaker | Checkerstomp | 15 s | 20 s |
| Calathea orbifolia in a pot | Potted Calathea Houseplant | Rippleleaf | 12 s | 23 s |

What it shows: every object was named correctly, the palette Muse Spark read from each photo matches the object, and each drawing keeps the object's silhouette and markings (the mug's skull print, the fork's four tines, the striped calathea leaves). In the fork photo it picked one fork out of four pieces of cutlery.

What went wrong: on the first try, one of five recognition requests (the mouse) came back as a server error page while all five ran at once; the same photo worked on a second try. The client now retries such a hiccup once by itself (see below).

### Changes since the photo evidence

- **Two-model fusion:** Muse Spark combines parent traits; Muse Image sees both parents' pictures and draws the hybrid. Parents remain. Fusion costs 20 Sparkles, refunded if synthesis or drawing fails. The Field Guide retains lineage and model provenance.
- **Photo items:** Muse Spark supplies an item description/category and an estimated real-world height; Muse Image supplies pixel artwork. Players can edit height in centimeters. Height maps to bounded, compressed game scale, not an accurate physical measurement. Items and their artwork are included in portable saves; a full library does not silently evict placed items.
- **Hatching:** incubation is now 30 seconds, stored as absolute timestamps. Artwork begins while the egg incubates. At hatch, players can keep the generated name, enter one, or ask Muse Spark for another suggestion.
- **World areas:** residents have saved area assignments, explore reachable terrain and are encouraged toward built-up places. Builders can carry placed items across area boundaries. Cross-area movement is implemented; repeated quota-failure and prolonged multi-area behavior have not been exhaustively tested.
- **Garden Adventure:** an optional free starter path connects a seed, watering and encouragement by distinct residents to a bloom, one-time reward and factual diary keepsake. Ordinary sandbox play remains available.
- **Audit repairs:** persistence-first egg claim with retry; camera stream attachment after video mount and late-stream cleanup; shared pre-upload compression; portable item-library transfer; replacement of old World-region keys on restore; recoverable biome-save errors; analysis close guards; failed quest-check refunds including local-day rollover. Earlier fixes also refreshed imported diaries, retained item definitions at capacity, corrected provider status/model/privacy text, and repaired stale test fixtures.
- **Performance audit:** terrain is now one cached image surface per region instead of thousands of live SVG pieces. In the four-resident development preview, live DOM size fell from about 31,400 to 5,060 (84% fewer). Hover updates skip play mode and unchanged cells; grass geometry is cached. A later six-second sample was still about 30 FPS, median 33.3 ms and p95 53.4 ms; measured editor responses were 144–232 ms. The title screen reached roughly 100 FPS in that environment. These small development-mode samples are not a controlled production benchmark or a 60 FPS claim. A movement-translation experiment was reverted because it did not improve timing.

### Failure handling (tested November 3, 2026)

Faults were forced in the live incubator by replacing the browser's network call; the player's save was backed up first and restored afterwards.

| Fault | What the player sees | Life Seed | Photo |
|---|---|---|---|
| Server returns an error page (twice) | Retried once automatically, then "The game server is busy for a moment… Nothing was used up: please try again." | Refunded (10 → 9 → 10) | Kept, Create button ready |
| No connection | "Could not reach the game server. Check your connection and try again; nothing was used up." | Refunded | Kept |
| Page refreshed mid-analysis | On reopening the incubator: "Your last photo was interrupted before its egg was made. Your Life Seed is back." | Refunded | Restored |
| Create clicked three times quickly | One request, one egg at most | Charged once | Kept |
| No answer at all | Request gives up after 90 seconds with a retry message | Refunded | Kept |

The 90-second timeout case was checked in code, not waited out live. Eggs use absolute timestamps, so a refresh never restarts incubation.

## Run

Use a Node version supported by the pinned Vite dependency. Install dependencies with `npm install` (or `pnpm install`). Copy `.env.example` to `.env` and set the keys you have:

| Secret | Used for |
|---|---|
| `BASETEN_API_KEY` | Recognition, fusion, diary/speech, sprite review |
| `FIREWORKS_API_KEY` | Talk, creature banter, photo quests |
| `META_API_KEY` (or `MODEL_API_KEY`) | Muse Image creature artwork |

Never commit `.env`. In Google AI Studio these are set under Settings → Secrets.

```sh
npm run dev
```

Open the localhost address printed by the server (default port 3000). Without keys, local gameplay and manual/demo modes work, and each live feature returns a clear configuration error. Model calls use provider credits and may incur provider charges.

```sh
npm run lint
npm test
npm run build
```

Integration tests use `ODDLINGS_TEST_URL` when set, otherwise port 3000. Use unset keys for automated tests so no paid inference is requested. In production, build first, set `NODE_ENV=production`, provide the keys as server environment secrets, and run `npm start`. Host the Express server, not only the static `dist` folder; the browser needs its server API routes.

## Play

1. Open the incubator, choose a photo, and create an egg. Live recognition requires Baseten configuration.
2. Let the saved 30-second timer expire (Muse Image draws the creature meanwhile, 16–23 s measured); refresh does not restart incubation. Crack and claim the creature.
3. Select a resident in the habitat. Use its ability, or press TALK to chat with it, or QUEST to go on a photo quest.
4. Leave two residents in the same world and watch them talk to each other.
5. Fuse two creatures with the explicitly labeled Meta button, then inspect their lineage in the Field Guide.
6. Paint terrain, plant seeds, place grounded decorations, and create named custom biomes with locally pixelated photo backgrounds. Assign residents to areas and carry placed items across World boundaries. Photo items can use Muse Image artwork and editable height estimates.

Saves live in browser storage. The editor's embedded preview and the standalone preview can have separate saves. Use Save & Restore for transfers. Photos are sent to Baseten, Fireworks or the Meta Model API only when a live feature is used; local background conversion and sprite tracing stay on-device. Review provider policies before using personal photos.

## Verification

- **Final local verification, November 3, 2026 (Pacific): 134/134 tests passed, zero skipped; TypeScript passed; production build passed with the actual image and audio files retrieved from the live preview.** API integration checks used an isolated server and blank provider keys. No paid inference was used by the automated checks. A refund test was corrected to use the wallet's local date rather than UTC; the 2,000-cent runtime budget was preserved. Explicit smaller budgets in synthetic limit tests are deliberate fixtures.
- Build completed in about 3.1 seconds in this run. Vite warns about the main JavaScript chunk: approximately 1.17 MB minified / 439 kB gzip. Passing a build does not establish fast loading or 60 FPS.
- Historical live evidence: the five-photo table and forced incubator failures above; earlier hosted checks covered recognition, hatch/claim, reload, fusion attribution, chat, banter and photo quests. Those are dated observations, not a fresh end-to-end certification of every later change.
- Latest performance browser checks covered resident movement, World exploration/return, painting, undo/redo/cancel, and Field Guide/Incubator/Fusion navigation with four saved residents. Relevant terrain/build/grass/storage tests also passed.
- **Not verified in this final pass:** physical camera hardware, a new paid photo-to-hatch/name/chat/fusion/item sequence, sustained large-world or 20/50-resident performance, physical-phone GPU behavior, 30-minute memory stability, crash-safe reward transactions across two tabs, production multi-instance budgets/jobs, anonymous deployment access, and final submission/video availability. Cross-area item transfers under interrupted writes need further testing.

See [demo-script.md](demo-script.md) for the three-minute recording plan and [SUBMISSION.md](SUBMISSION.md) for the current draft and remaining deliverables.

## Assets and contributions

Source files carry their existing Apache-2.0 notices. The project bundles scenery images and original synthesized music, alongside procedural pixel graphics and model-generated photo artwork. Preserve asset attribution and review the provenance of bundled scenery before publication; this audit does not certify rights to every image. Web fonts are requested from Google Fonts. The MediaPipe segmenter model is loaded from jsDelivr at runtime. Test apple photo: [Red apple on white background](https://commons.wikimedia.org/wiki/File:Red_apple_on_white_background.jpg), Sprinno, CC0. That photo is an optional test fixture, not required to run the game.

Photos in `photo-to-oddling.png` (all from Wikimedia Commons): [Coffee Mug (Unsplash)](https://commons.wikimedia.org/w/index.php?curid=61714733), Ryan Holloway, CC0; [A wireless computer mouse](https://commons.wikimedia.org/w/index.php?curid=83718265), Pixloom, CC BY-SA 4.0; [knife and fork set on green cloth](https://commons.wikimedia.org/wiki/File:2022-10-27_knife_and_fork_set_on_green_cloth_(focus_stack_-_HiRes).jpg), Franz van Duns, CC BY-SA 4.0; [A Vans Sneaker On The Side](https://commons.wikimedia.org/w/index.php?curid=79804888), Joeltorresmejia78, CC BY-SA 4.0; [Houseplant Calathea orbifolia](https://commons.wikimedia.org/w/index.php?curid=104046541), Supsoph, CC BY-SA 4.0. The sheet is a derivative of these photos and is shared under the same licenses.

Work was developed during the hackathon through Google AI Studio, Codex and Claude Code. Preserve repository history and identify event-built contributions in the submission; review any inherited code/asset rights before the final submission. This source export omits non-runtime verification PNGs from AI Studio's public folder.

# Inside Oddlings

[Play Oddlings](https://oddlings-meta.ai.studio/) · [Project overview](../README.md) · [Build and run](../README.md#run)

Oddlings uses photos in three ways. An object can become a resident with traits and abilities, a decoration you can place, or part of the scenery. A resident can then become a parent in Fusion Lab, ask for another real-world photo in a quest, or change the habitat with an ability. That is how the game fits the **Build for Your World** theme. Your surroundings supply the characters, props, and places you play with. [Meta Global AI Developer Hackathon](https://dev.meta.ai/events/global-hackathon)

- [What to try](#what-to-try)
- [From a photo to a playable creature](#from-a-photo-to-a-playable-creature)
- [Care, conversation, and quests](#care-conversation-and-quests)
- [Fusion and lineage](#fusion-and-lineage)
- [Building a world that remembers](#building-a-world-that-remembers)
- [How generation handles failures](#how-generation-handles-failures)
- [What was verified](#what-was-verified)
- [Model routes](#model-routes) · [Asset credits](#assets-and-contributions)

## What to try

| What you want to see | In the game | What to look for |
| --- | --- | --- |
| **A real Meta image result right away** | Enter the habitat → **Create Biome → Sample landscape** | The original city photo and the saved output from the game's Muse Image route appear side by side. |
| **A creature with an ability** | **Incubator** → upload an object photo → hatch and claim → select the resident | The object becomes the creature's identity. The ability card explains the actual game effect. |
| **A persistent world and care loop** | **Build / Edit Biome** → paint terrain and save. Then try a resident interaction or the **Garden Adventure**. | The world keeps your edits. The garden records who helped the seed bloom. |
| **Two parents and one hybrid** | **Fusion Lab** → choose two parents → inspect the hybrid in **Collection** | The result carries both parents' lineage. The parents stay in the collection. |

The 30-second incubation begins after recognition. Muse Image artwork runs during incubation and can finish after the timer. The sample landscape displays a saved result and needs no generation wait.

## From a photo to a playable creature

1. **Capture and prepare.** The Incubator accepts a camera photo or an uploaded file. The browser decodes and compresses the image for the request. [Photo preparation](../src/game/photoCompression.ts) · [Incubator](../src/components/IncubatorLab.tsx)
2. **Recognize and design.** Muse Spark Open on Baseten reads the object, material, colors, and visual cues. It proposes a species name, personality, appearance, and ability. The server validates and bounds those fields before gameplay uses them. [Recognition route](../server.ts) · [Response validation](../server/creatureResponse.ts)
3. **Draw and animate.** Muse Image draws an object-shaped creature from the photo. The game removes the background and adds its own face and animation. A creature can also use a separately labeled photo-traced sprite. That path uses browser segmentation and canvas processing, with local color rules available when segmentation fails. [Sprite pipeline](../src/game/photoSprite.tsx)
4. **Hatch and play.** The egg stores an absolute time so reloading preserves incubation. The player can keep the proposed name, type one, or request a new suggestion. The game maps the generated ability to supported effects such as seed watering, energy restoration, or trust gain. [Creature rules](../src/game/creatureRules.ts) · [Claim and persistence](../src/App.tsx)

## Care, conversation, and quests

**Care changes the resident.** Petting, treats, play, and rest feed into game rules for friendship, mood, and energy. The Collection gives players a place to revisit creature details, memories, diary, home, and lineage. [Care rules](../src/game/creatureRules.ts) · [Collection](../src/components/BestiaryJournal.tsx)

**Conversation uses game state.** Talk sends the resident's material, personality, mood, friendship, current weather, and recent memories as context. When nearby residents banter, material relationships shape whether they talk like friends, rivals, or new neighbors. The game limits how often the same pair can chat. [Creature chat](../src/components/CreatureChat.tsx) · [Habitat simulation](../src/components/HabitatCanvas.tsx) · [Chat service](../server/chatService.tsx)

**Quests send the player back into the real world.** A resident can ask for something round or for a plant. Muse Spark Open on Fireworks checks the submitted photo against the request. A match in a regular quest adds a memory, friendship, and energy. [Photo quests](../src/components/PhotoQuest.tsx)

## Fusion and lineage

Muse Spark receives both parents' traits and proposes a hybrid identity and inherited traits. Muse Image receives both parent images and draws the hybrid. The player keeps the parents and can inspect the hybrid's lineage and model provenance later. Fusion reserves 20 Sparkles and returns them when trait synthesis or drawing fails. [Fusion Lab](../src/components/FusionLab.tsx) · [Wallet reservations](../src/game/lifeSeeds.ts)

## Building a world that remembers

| System | What players see | How it works |
| --- | --- | --- |
| **World simulation** | Residents wander across reachable terrain, react to weather, and comment on nearby features. | World regions generate deterministically from coordinates. Edits and resident assignments are saved by area. [World regions](../src/game/worldRegions.ts) · [Habitat simulation](../src/components/HabitatCanvas.tsx) |
| **Terrain and decorating** | Paint or erase with different brush sizes, move props, and undo or redo changes. | The editor tracks changes as actions and supports moving placed items across World areas. Terrain renders as a cached image per region. [Build toolbar](../src/components/BiomeEditorToolbar.tsx) · [Terrain renderer](../src/components/BiomeWorldRenderer.tsx) |
| **Photo items and custom biomes** | Make a prop from an object photo or a backdrop from a place. | Muse Spark can estimate a prop's height, which the player can edit before the game scales it. Muse Image draws props and AI scenery. Biomes also offer an on-device pixel conversion. [Photo items](../src/components/PhotoItemModal.tsx) · [Create Biome](../src/components/CreateBiomeModal.tsx) |
| **Garden Adventure** | Plant a seed, have one resident water it and another encourage it, then claim a bloom reward and a diary keepsake. | The game records which residents contributed and checks the completion and reward state before awarding it. [Adventure logic](../src/game/gardenAdventure.ts) · [Adventure tests](../src/game/gardenAdventure.test.ts) |
| **Portable saves** | Move your creatures, world edits, and custom creations between browsers with Save & Restore. | The app validates a versioned JSON bundle. Custom biome image assets use IndexedDB, and the save bundle includes custom item definitions and artwork. [Save and restore](../src/game/storage.ts) · [Biome assets](../src/game/customBiomeStorage.ts) |
| **Sound and presentation** | The title, habitat, Incubator, and Fusion Lab have distinct music. Interaction sounds and weather help the world feel responsive. | The game switches music by scene, synthesizes interaction sounds with Web Audio, and renders separate rain, wind, and sky effects. [Scene music](../src/game/gameMusic.ts) · [Sound synthesis](../src/game/soundSynth.ts) · [World sky](../src/components/WorldSky.tsx) |

## How generation handles failures

- **Check the response before using it.** Invalid creature responses can trigger one automatic retry with the same photo. Photo items have a separate silhouette check after background removal that catches empty, nearly solid, or fragmented results and can trigger one redraw. [Recognition client](../src/services/basetenClient.ts) · [Item quality tests](../src/game/itemArtQuality.test.ts)
- **Keep slow work off the initial request.** Artwork and several other AI actions return a job ID that the browser polls. Production Redis shares job results, request reservations, and concurrency leases across server instances. The slot stays occupied while the job runs. Missing or expired jobs end polling with a message. [Job handling](../server/spriteService.tsx) · [Shared store](../server/sharedAiStore.ts)
- **Show what the player kept.** Failed egg analysis returns its reserved Life Seed, failed fusion returns its Sparkles, and failed quest checks return the applicable daily check. Creating an item preview spends no Craft Gem. Saving the item spends one. [Wallet and recovery tests](../src/game/auditRecovery.test.ts)

## What was verified

| Check | Result | Scope |
| --- | --- | --- |
| **Public game** | A tower fan photo produced Halobreeze. One seed was charged, and both the resident and the balance persisted after reload. The later release passed its public health check and loaded the habitat with Halobreeze. | One browser hatch. The run exposed a mistaken “fork” label. The subsequent release contains its regression fix. [Photo gallery](../README.md#first-photo-check) · [Regression test](../src/game/creatureRules.test.ts) |
| **First artwork results** | Four creator photos produced creature results. One recognition request retried successfully. The same batch returned a photo item drawing and a city backdrop. | Three creatures were checked through the deployed routes. Item placement and biome saving were separate from the server artwork check. The plush drawing dropped much of the face. [Photo gallery](../README.md#first-photo-check) |
| **Earlier live gameplay** | Earlier checks observed live fusion and saved attribution, in-character chat, a banter exchange, and photo quest results. | Dated checks of individual features. [Submission verification](../SUBMISSION.md#new-work-and-verification) |
| **Automated release checks** | 151 tests, TypeScript, and the production build passed. | Tests include response validation, mocked shared storage, refunds, artwork retry, terrain edits, and save restore. The shared storage test uses an HTTP double. [Tested source](https://github.com/Kittybri/oddlings-meta-hackathon/tree/c26238aef3de071688aef5914fe9d4aaddbd120d) |
| **Rendering audit** | A four-resident development scene dropped from about 31,400 DOM nodes to 5,060 after terrain caching. A later six-second sample measured around 30 FPS. | Small development samples. Physical phone performance and large habitats remain unmeasured here. [Rendering implementation](../src/components/BiomeWorldRenderer.tsx) |

## Model routes

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
| Placeable photo item artwork | Muse Image | Meta Model API | `/api/meta/creature-art` with `kind: "item"` |
| Talk to your creature | Muse Spark Open (`accounts/fireworks/models/muse-spark-open`) | Fireworks | `/api/fireworks/chat` |
| Creatures talking to each other | Muse Spark Open | Fireworks | `/api/fireworks/banter` |
| Photo quests (vision check of the player's photo) | Muse Spark Open | Fireworks | `/api/fireworks/quest` |

Slow model calls run as background jobs: the POST route returns a `jobId` and the browser checks `GET <route>/:id` every few seconds. This keeps requests short for hosts that cut off long requests.

### Additional model behavior

- **Recognition and design.** Meta generates names, traits, material, palette, anatomy data and ability descriptions from an unselected photo. Bounded game rules map the generated ability to energy restoration, seed watering or trust gain; those rules, not model code, change game state.
- **Creature artwork.** Muse Image redraws the photographed object as a cute 8-bit creature in one house style (keeps the object's shape, colors and markings, adds small feet, white background, no hands, no face). The game cuts away the white background (including holes such as a mug handle), adds its own blinking pixel eyes and mood mouth, a thin dark outline, and a squash-and-stretch idle animation. Successful drawings are cached in the browser to reduce repeated calls; retries, cleared storage, and another browser can still incur another provider request. If no `META_API_KEY` is set, or a drawing fails, the creature falls back to a sprite traced from the photo (see below).
- **Talk.** The TALK button opens a chat window. The creature answers in its own voice and knows its object, material, personality, ability, feelings about rain, friendship hearts, energy, mood, the world's time of day and weather, and its five newest memories.
- **Creature banter.** About every 75 seconds, two residents of the same world have a 4-line speech-bubble exchange. Their materials decide whether they act as friends (for example Ceramic with Thermal), playful rivals (for example Glass with Thermal) or new neighbors. Both creatures remember the chat.
- **Photo quests.** The QUEST button shows a request such as "something round" or "a plant or a flower". The player takes or uploads a photo; Muse Spark checks it and replies in character. A match gives one friendship heart, 15 energy and a memory.

### Art pipeline details

- The traced sprite uses Google's MediaPipe Interactive Segmenter and local canvas processing for cut-out, hand removal, and palette reduction. Muse Spark can suggest colors and face position. The segmentation path uses MediaPipe in place of SAM.
- Live fusion requires both Muse Spark trait synthesis and Muse Image artwork. Starter creatures and locally traced sprites have separate provenance.
- The app validates model replies and retries eligible failures. The two small evidence batches show individual outcomes. Image quality varies across photos and runs.

### Spending limits and interrupted jobs

- Current runtime default: **2,000 cents ($20) per UTC day in estimated reservations**, configurable with `AI_DAILY_BUDGET_CENTS`; this is not measured provider billing. Each image request reserves 10 cents and each text/vision request 5 cents, including failed attempts conservatively. Daily counts also cap image requests at 100 and text/vision requests at 500. The older lifetime image counter remains in `meta-usage.json`.
- `AI_MAX_CONCURRENT` defaults to **4**. Background work retains its slot until it settles, rather than releasing it as soon as a job ID is returned. Over-limit requests receive a friendly retryable HTTP 429.
- Existing per-player limits remain: Fireworks 40 requests/10 minutes, creature and fusion artwork 10/hour each, biome artwork 6/hour. Baseten also retains its existing shared limiter. Cloud Run's one trusted proxy hop supplies `req.ip`; the app no longer selects a caller-controlled leftmost forwarding value.
- Production uses shared Redis REST storage for atomic daily reservations, concurrency leases, and background job results. Configure AI_REDIS_REST_URL and AI_REDIS_REST_TOKEN before deploying. Missing or unavailable shared storage blocks paid work. Local development retains the file-backed test backend.
- Missing/expired background jobs return a terminal retry message. Pollers stop; fusion refunds its 20 Sparkles on failure, unsuccessful egg analysis refunds its seed, and failed quest checks refund their reservation. Photo items spend a gem when saving an item, so a lost drawing alone has no gem charge to undo. Successful local fallback items still cost their normal gem if saved.
- Banter is throttled, waits before reusing a pair, and pauses when relevant windows or tab visibility prevent it.

The automated suite simulates four occupied slots, a fifth request receiving the busy result, and a missing job returning a terminal error. Wallet tests verify one-time refunds and quest check rollover independently of live providers.

## Evidence: real photos to Oddlings

Five real photos from Wikimedia Commons (not drawings), run through the same two live Meta steps the incubator uses on November 3, 2026. The artwork shown is the first generated artwork for each photo; no art was edited or re-rolled. One recognition request needed the retry described below.

The table records the five source photos and their generated Oddlings. See [asset credits](#assets-and-contributions).

| Photo | Muse Spark recognized | Creature | Muse Spark time | Muse Image time |
|---|---|---|---:|---:|
| White enamel mug with a skull print | Enamel Camp Mug, white enameled steel with black rim | Grimbrew | 8 s | 20 s |
| Black wireless mouse | Wireless Computer Mouse, matte ABS plastic | Clickwhisker | 13 s | 22 s |
| Two knives and two forks on green cloth | Dinner Fork, polished stainless steel | Tinefang | 14 s | 16 s |
| Black and white checkered Vans sneaker | Checkerboard Canvas Sneaker | Checkerstomp | 15 s | 20 s |
| Calathea orbifolia in a pot | Potted Calathea Houseplant | Rippleleaf | 12 s | 23 s |

What it shows: every object was named correctly, the palette Muse Spark read from each photo matches the object, and each drawing keeps the object's silhouette and markings (the mug's skull print, the fork's four tines, the striped calathea leaves). In the fork photo it picked one fork out of four pieces of cutlery.

What went wrong: on the first try, one of five recognition requests (the mouse) came back as a server error page while all five ran at once; the same photo worked on a second try. The client now retries such a hiccup once by itself (see below).

### Later release and performance notes

- **Two-model fusion:** Muse Spark combines parent traits; Muse Image sees both parents' pictures and draws the hybrid. Parents remain. Fusion costs 20 Sparkles, refunded if synthesis or drawing fails. The Collection retains lineage and model provenance.
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

That historical 90-second timeout case was checked in code, not waited out live. The current analysis deadline is 140 seconds. Eggs use absolute timestamps, so a refresh never restarts incubation.

<details>
<summary><strong>Controls, release notes, and deployment setup</strong></summary>

## Gameplay details

- Fresh playthroughs start with **500 Sparkles**, 10 Life Seeds and 5 Craft Gems. Existing valid wallet balances are preserved.
- Finish the four first-run goals (discover two photographed objects, care, fuse, and save a built home) to unlock **Claim 50 Sparkles**. The wallet records a receipt to prevent repeat claims.
- **Collection** shows discovered Oddlings, memories, diary, lineage and home assignment. **Release Oddling** asks for named confirmation, then removes that resident and its memories from the collection and habitat. The removal is saved before updating the screen; an empty collection remains empty after reload. The same option is available on phones.
- Build opens its compact toolbox automatically. Hide folds it away; selecting a tool also folds it for placement. Decoration search and category filters help browse the library. Brush outlines match 1×1, 2×2 and 3×3 painted/erased footprints, and undo/redo skips unchanged snapshots. Floating terrain above an existing prop no longer pulls that prop off its supporting ground.
- Desktop creature care folds into a compact bar. Phone care retains its earlier layout. Trees stand still in calm weather and sway when the weather is windy, including Claude's latest live changes.
- **Sample landscape** displays a fixed original city photograph and its actual Muse Image result, generated through the game's biome-art endpoint. Opening the example makes no new paid generation request. Uploaded photos still offer local conversion or live AI scenery.
- Photo-item artwork receives a local silhouette check after background removal. Empty, nearly solid-background or heavily fragmented cutouts and failed image requests get **one automatic retry** with the same photo and “Refining your item…” feedback. Capacity, billing and credential errors are not retried. This is a structural check, not an AI assessment of beauty or object resemblance. A saved item costs one Craft Gem; an unsuccessful drawing alone spends none.
- Creature recognition validates structured output and retries malformed results once. The browser analysis deadline is now **140 seconds**. Player resource reservations and applicable failure refunds remain in place.

## Play

1. Open the incubator, choose a photo, and create an egg. Live recognition requires Baseten configuration.
2. Let the saved 30-second timer expire (Muse Image draws the creature meanwhile, 16–23 s measured); refresh does not restart incubation. Crack and claim the creature.
3. Select a resident in the habitat. Use its ability, or press TALK to chat with it, or QUEST to go on a photo quest.
4. Leave two residents in the same world and watch them talk to each other.
5. Fuse two creatures with the explicitly labeled Meta button, then inspect their lineage in the Collection.
6. Paint terrain, plant seeds, place grounded decorations, and create named custom biomes with local photo conversion or live Muse Image scenery. Assign residents to areas and carry placed items across World boundaries. Photo items can use Muse Image artwork and editable height estimates.

Saves live in browser storage. The editor's embedded preview and the standalone preview can have separate saves. Use Save & Restore for transfers. Photos are sent to Baseten, Fireworks or the Meta Model API only when a live feature is used; local background conversion and sprite tracing stay on-device. Review provider policies before using personal photos.

## Release verification history

- **November 4 release verification.** All 151 automated tests passed, along with the TypeScript check and production build. After republishing, the public health endpoint returned HTTP 200, the habitat opened with the saved Halobreeze, and the served code contained the fan classification fix and all four updated recovery messages.
- Earlier on November 4, live phone checks covered the release confirmation. The fixed sample backdrop was generated through the deployed Muse Image biome route.
- The November 4 build splits the main entry (~447 kB minified / 134 kB gzip) and HabitatCanvas (~459 kB / 235 kB gzip). The earlier bundle sizes and timing observations below are historical.

- **Final local verification, November 3, 2026 (Pacific): 134/134 tests passed, zero skipped; TypeScript passed; production build passed with the actual image and audio files retrieved from the live preview.** API integration checks used an isolated server and blank provider keys. No paid inference was used by the automated checks. A refund test was corrected to use the wallet's local date rather than UTC; the 2,000-cent runtime budget was preserved. Explicit smaller budgets in synthetic limit tests are deliberate fixtures.
- Build completed in about 3.1 seconds in this run. Vite warns about the main JavaScript chunk: approximately 1.17 MB minified / 439 kB gzip. Passing a build does not establish fast loading or 60 FPS.
- Historical live evidence: the five-photo table and forced incubator failures above; earlier hosted checks covered recognition, hatch/claim, reload, fusion attribution, chat, banter and photo quests. Those are dated observations, not a fresh end-to-end certification of every later change.
- Latest performance browser checks covered resident movement, World exploration/return, painting, undo/redo/cancel, and Collection/Incubator/Fusion navigation with four saved residents. Relevant terrain/build/grass/storage tests also passed.
- **Outside the release checks:** physical camera hardware, sustained performance on physical phones or in large habitats, crash recovery across two browser tabs, and live multi-instance budget and job recovery. A final video link and submission receipt remain unverified.

See [demo-script.md](../demo-script.md) for the three-minute recording plan and [SUBMISSION.md](../SUBMISSION.md) for the current draft and remaining deliverables.

### Shared AI storage setup

Create a persistent Upstash Redis database with eviction disabled and a size/REST request limit that accommodates generated images. Use its HTTPS REST endpoint and read/write REST token as server-only secrets:

- `AI_REDIS_REST_URL`
- `AI_REDIS_REST_TOKEN`
- `AI_STORAGE_NAMESPACE=oddlings-production` (use the same value on every instance)
- `AI_DAILY_BUDGET_CENTS=2000` and `AI_MAX_CONCURRENT=4` retain the existing limits.

Production rejects paid AI requests while shared storage is unconfigured or unavailable. Daily amounts remain conservative per-request reservations, not a measurement of provider billing. Configure provider billing controls separately. Concurrency leases expire after ten minutes to recover crashed workers; provider requests have shorter abort deadlines. Completed job results are shared across instances and retained for ten minutes. An interrupted worker leaves an expiring pending record so clients can retry/refund.

Validate the configured store from two running instances before republishing: reserve four concurrent jobs across them, confirm the fifth is busy, poll a job through the other instance, and restart one instance to confirm daily reservations persist. Automated tests use an HTTP storage double; production credentials and a live database are still required for this deployment check.

</details>

## Assets and contributions

Source files carry Apache-2.0 notices. The project bundles scenery, synthesized music, procedural pixel graphics, and model-generated photo artwork. Web fonts come from Google Fonts. The MediaPipe segmenter model loads from jsDelivr at runtime. The optional apple test photo is by Sprinno and uses CC0. [Red apple on white background](https://commons.wikimedia.org/wiki/File:Red_apple_on_white_background.jpg)

Photos in `photo-to-oddling.png` (all from Wikimedia Commons): [Coffee Mug (Unsplash)](https://commons.wikimedia.org/w/index.php?curid=61714733), Ryan Holloway, CC0; [A wireless computer mouse](https://commons.wikimedia.org/w/index.php?curid=83718265), Pixloom, CC BY-SA 4.0; [knife and fork set on green cloth](https://commons.wikimedia.org/wiki/File:2022-10-27_knife_and_fork_set_on_green_cloth_(focus_stack_-_HiRes).jpg), Franz van Duns, CC BY-SA 4.0; [A Vans Sneaker On The Side](https://commons.wikimedia.org/w/index.php?curid=79804888), Joeltorresmejia78, CC BY-SA 4.0; [Houseplant Calathea orbifolia](https://commons.wikimedia.org/w/index.php?curid=104046541), Supsoph, CC BY-SA 4.0. The sheet is a derivative of these photos and is shared under the same licenses.

Kittybri built Oddlings from scratch during the hackathon with Google AI Studio, Codex, and Claude. The game's artwork was created for Oddlings with AI assistance. The November 4 photo gallery uses Kittybri's own photographs. The earlier Wikimedia test photos are credited above.

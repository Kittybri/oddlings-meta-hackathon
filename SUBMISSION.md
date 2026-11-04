# Submission preparation

Play: https://oddlings-meta.ai.studio/
Source: https://github.com/Kittybri/oddlings-meta-hackathon
License: Apache-2.0 (see LICENSE).

Status: current source passes 134 tests, TypeScript and a production build with real media assets. Documentation and a three-minute recording plan are prepared. Latest repository reconciliation/publication, final video, stable deployment and the actual hackathon submission still need completion.

Participant guide: https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details
Submission form: https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit
Deadline: November 4, 2026, 6 PM Pacific / 9 PM Eastern.

Suggested track: Indie Developer. Suggested problem statement: Build for Your World.

## Project description draft

Oddlings makes the belongings around you into a personal creature sandbox. Photograph an object, incubate its egg, and discover a pixel companion drawn from that object, with a personality and traits to match. Talk to it and it answers in its own voice, remembering how you've cared for it. Creatures chat with each other as friends or rivals depending on what they're made of. They send you on photo quests ("show me something round"), and Meta's vision checks your photo and rewards you. Build terrain and gardens, assign residents to named worlds, activate bounded creature abilities, and fuse companions into hybrids with traceable inherited traits.

## Use of Meta products

Oddlings uses two Meta model families across three provider integrations, all through server-only integrations with validated outputs:

- **Muse Spark Open on Baseten** (`meta-models/muse-spark-open-1026`): multimodal object recognition, structured creature design, live fusion, diary entries and speech lines, and color review of the traced photo sprite.
- **Muse Image on the Meta Model API** (`muse-image-1.0`): redraws the photographed object as a creature in one consistent 8-bit house style. Draws creatures, placeable photo items, AI scenery and hybrids informed by both parent images. Daily reservations and the existing lifetime image counter limit requests; see the limitations below.
- **Muse Spark Open on Fireworks** (`accounts/fireworks/models/muse-spark-open`):
  - live chat with each creature in its own voice;
  - creature-to-creature conversations whose tone (friends, rivals, neighbors) follows their materials;
  - vision checks for photo quests.

Provider/model/live/timestamp provenance distinguishes live AI results from manual/demo creation. Generated abilities map to explicit, bounded energy, gardening or trust mechanics; quest rewards are fixed (one heart, 15 energy). SAM is not integrated: object cut-out uses Google's MediaPipe segmenter in the browser. Custom photo backgrounds offer clearly distinguished local conversion and live Muse Image scenery generation.

## Why Meta matters

The model interprets an unselected photo rather than requiring the player to pick an object category, then creates a personality, visual design and traits, and Muse Image turns the real object into consistent character art. After hatching, Meta keeps the creature alive. It talks back with context from the game state, it banters with other residents, and it judges real-world photos for quests that send the player looking around their own room. Fusion reasons over two parents to produce a named hybrid and inherited lineage. This supports a loop well beyond basic image analysis: discover, incubate, care, talk, explore, build, activate and fuse.

## New work and verification

Event work includes:
- the photo/incubator flow and object-shaped pixel creatures;
- live server integration and traceable fusion;
- terrain, decorations and seed growth;
- custom-biome saves and resident assignment;
- provenance UI and regression fixes;
- the photo-traced sprite pipeline and Muse Image creature art;
- creature chat, creature banter and photo quests;
- the pixel-style UI pass.

Preserve earlier development records and distinguish inherited code if any. Do not assert every line was newly written without reviewing project history.

Verified November 1:
- fresh live photo-to-egg-to-hatch, the saved timer across refresh and a single claim;
- live Meta fusion and saved model attribution;
- 84 tests, TypeScript and the production build pass.

Verified live on November 2:
- Muse Image returned a drawing for a test picture.
- Creature chat answered in character.
- A banter exchange played in the world.
- Photo quests judged eight of eight checks correctly, including the entrant's own tongue-drum and bamboo photos.
- New server code has passing unit tests.

### Latest event work after the earlier evidence

- Live fusion combines Muse Spark trait synthesis with Muse Image artwork from both parents. Costs 20 Sparkles, refunded on failure; parents remain and lineage is retained.
- Photo-made items have Muse Image artwork and Muse Spark height estimates editable by the player. These map to cozy game scale, not physical metrology. Full item definitions/art now transfer in save bundles.
- Incubation lasts 30 seconds; art starts during incubation. Hatch naming supports manual names and live Meta suggestions.
- World areas keep resident assignments and support wandering toward built-up places and carrying decorations across area boundaries.
- The optional First Garden Adventure links two residents' abilities to a bloom and factual diary keepsake, using a free starter path.
- Reliability work covers egg claim persistence/retry, camera mount and stream cleanup, upload compression, complete item/region restore, biome-save error handling, analysis lifetime guards, quest-check refunds, diary refresh and library-capacity safety.
- Credit protection uses one trusted Cloud Run proxy hop, retained player limits, a default **2,000-cent ($20) UTC daily reservation budget**, daily image/text count limits and four concurrent requests. Reservations are conservative estimates, not measured bills; file-backed accounting is not a hard guarantee across multiple instances or fresh containers. Missing/expired jobs return retry errors; client failure paths preserve applicable game-resource refunds.
- Rendering work replaced per-cell terrain DOM with cached regional surfaces, skipped unnecessary hover updates and cached grass geometry. Development-preview DOM count fell about 84% (31,400 to 5,060). Four-resident gameplay still measured around 30 FPS; no 60 FPS or physical-mobile performance claim is made.

### Final automated verification

November 3, 2026 (Pacific): **134 tests passed, 0 failed, 0 skipped; TypeScript passed; production build passed** with current live source and real images/audio. The isolated API server and tests had provider keys blank. The local-day test fixture was repaired; runtime budget remains 2,000 cents. Main bundle warning remains (~1.17 MB minified / 439 kB gzip).

Not verified in this final pass: physical camera capture; a new paid full photo/hatch/name/chat/fusion/item recording; large-resident and prolonged mobile performance; two-tab crash-safe rewards; interrupted cross-area transfers; real deployed proxy behavior; multi-instance accounting/job recovery; final judge access. Historical evidence above remains dated rather than implying these checks were repeated.

## Still required

- Rerun checks if the source changes after this verified snapshot; retain the final logs.
- Record a fresh live end-to-end demonstration; retain the existing five-photo evidence as historical evidence.
- Reconcile the latest source with the reviewed public repository and verify anonymous access. No GitHub work is performed by this task.
- Record/upload the actual three-minute video using demo-script.md; verify judge access.
- Choose and verify a stable live product URL; the AI Studio development preview is not a deployment guarantee.
- Fill team name/members and the entrant's own survey answers.
- Review the submission publication/promotion agreement before accepting it.
- Submit through the platform and retain confirmation. No submission has been made by this preparation work.

Do not claim guaranteed eligibility or prize qualification. The participant guide's prohibited/generic examples include simple image analyzers; demonstrate the complete interactive game loop and substantive Meta synthesis.

# AllDunks — Development Plan

## Vision and current status

A single-player, phase-based, 3-on-3 basketball browser game about coaching: assign a team's actions during a planning phase, then watch the play unfold against a reacting defense. AllDunks is the title; passing, jump shots, layups, drives, screens, rebounds, and dunks all have a place.

The initial TypeScript engine and playable browser prototype are implemented on `codex/core-rules`. Milestone 4 now replaces the 11 named court zones with a shared 60-cell axial hex court. Actions still resolve immediately; milestone 5, planned plays, is next. Clear planning and execution feedback remains a release requirement. Existing validation describes the old prototype; it does not establish that these new requirements are complete.

See [TODO.md](TODO.md) for priorities, [README.md](README.md) for running the current prototype, and [core-rules.md](core-rules.md) for its existing rules. This plan takes precedence for future development. Update the detailed rules alongside the hex and timeline implementation so the documents agree.

## Confirmed basketball requirements

- One human controls three players against three AI players on a top-down half court.
- Reach or exceed 21 points to win. Inside-arc baskets score two; outside-arc baskets score three. No exact-score requirement.
- Each player's stamina determines their phase action budget. Most have 4–6 stamina; rare exceptions have 3 or 7, balanced through height and other strengths or weaknesses. Keep the provisional larger-roster target of at least 90% within 4–6.
- Height matters for at-rim contests and rebounding. Slow centers typically gain height and interior strengths; fast guards typically sacrifice height and rebounding.
- An offensive rebound starts a fresh planning phase with floor(normal stamina × 2/3) moves per player. Always calculate from normal stamina; repeated rebounds do not compound the reduction. No minimum-one override.
- An undefended attempt directly under the rim is a guaranteed two-point dunk. A defended attempt there resolves as a regular probability-based shot at the rim.
- Human defense resolves automatically through ratings, positioning, strategy, and probability. AI defense must respect movement budgets and make competent coverage decisions.

## Priorities

### MUST — next playable release

1. **Hex coordinates:** replace named-zone movement and distance with a bounded hex court shared by rules, AI, previews, and rendering.
2. **Plan first, execute second:** assign all offensive actions before committing the play, like a coach calling a play in a timeout. Playback executes the submitted sequence without further action assignment.
3. **Clear user feedback:** show the planned play, action costs and risks, the current event during execution, and understandable reasons for success, failure, possession changes, and rebound resets. Include pause, speed, and single-step controls. An event log alone does not satisfy this requirement.

Feedback is part of each MUST milestone, not work postponed until visual polish. The next playable release is incomplete until all three are usable together.

### SHOULD — visual presentation

- Pixel-art players and court assets, after hex dimensions and positioning are stable.
- Animations for blocks, made shots, misses, and dunks. Introduce an explicit block outcome before using a block animation; the current engine includes defensive pressure in miss probability and has no separate block event.

### WANT — persistence and seasons

- Export and import the game as a versioned JSON save file.
- Season progression with player development. Both wins and losses award points to spend improving players. Tune award amounts and upgrade costs; a larger award for wins is a proposed default.

## Planned phase flow

1. Start a checked-ball possession with normal action allowances, or a rebound phase with reduced allowances and preserved on-court positions.
2. Enter planning mode. Select players, assign actions on a shared team timeline, and preview paths, expected ball ownership, and each player's remaining budget. Edit, reorder, and remove actions freely before committing.
3. Validate the complete plan for budgets, adjacency, action dependencies, and foreseeable conflicts. Explain issues at the relevant player, hex, or timeline step. Planning and validation consume no stamina and no random draws.
4. Commit the play. Freeze the assigned plan and enter execution mode. Resolve movement, passing, shooting, and bounded defensive responses in a documented order. The player can pause, change playback speed, or step through events, but cannot issue new actions mid-play.
5. Display the current action, ball location, defensive response, and result as execution advances. Distinguish a planning estimate from actual execution odds after defenders move.
6. A shot, turnover, or possession-ending violation stops the submitted sequence and cancels remaining assignments. Resolve a missed shot and rebound before handing control back.
7. An offensive rebound starts a new planning phase at current positions with reduced stamina. A defensive rebound, made basket, or turnover starts the other team's normal possession. A winning basket ends the game immediately.
8. Before each opponent possession, choose defensive strategy. AI offense submits and executes a plan under the same hex, stamina, and resolution rules; human defenders react automatically. Retain the strategy across offensive rebounds.

For the first planned-play version, keep checked-ball resets on possession changes and omit transition clearing, fouls, free throws, and out-of-bounds play. Screens and richer finishing options remain follow-up tactical work.

## Hex court and spatial rules

Use axial `(q, r)` coordinates with a derived cube distance. Keep conversion to SVG/pixel positions in the renderer. Provide one authoritative neighbor and distance implementation for movement, contests, passing, drives, AI, and path previews.

Define a finite playable hex set and explicit court markings: rim/under-rim cell or cells, paint, midrange, three-point area, and boundaries. Shot value must follow the shooter's cell classification rather than an approximate screen coordinate. Define how arc-boundary cells are classified.

Choose cell size so a player with ordinary stamina can create useful positioning within one phase. Start with a coarse board and validate sample possessions before increasing resolution. Define hex-based contest reach and pass pressure; preserve the guaranteed open dunk when no defender can contest.

Remove named-zone assumptions from state, legality checks, action targets, check-ball positions, AI, tests, and UI together. Keep heights, skill ratings, stamina rarity, scoring, and rebound rounding intact.

## Action planning and execution

Use a shared timeline with room for multiple players to act in a step. Each player has their own queue and stamina budget. The timeline must support off-ball cuts coordinated with passes and shots, rather than merely submitting one player's actions at a time.

Provisional action costs remain one for movement, dribbling/driving, passing, and shooting. A player can spend their last move shooting. The planner should flag an exhausted intended receiver and prevent knowingly scheduling a shot that player cannot afford. Do not turn unrelated teammates' off-ball actions into an immediate violation solely because the current ball handler has spent their budget; determine whether the committed plan can still legally progress. Replace the old immediate-action expiry assumption explicitly.

Before implementation, write down and test:

- Ordering of same-step movement, passes, shots, and defensive reactions; when a pass arrives and the receiver may act.
- Whether same-step teammate swaps are legal, how two players targeting one hex are handled, and how opponents sharing a hex represent coverage.
- How actions depend on expected ball ownership and earlier movement.
- When a blocked or failed action spends its cost and what later dependent actions do.
- The defensive reaction budget for a timeline step containing multiple offensive actions. Several simultaneous assignments must not accidentally generate unlimited defense.
- How an unfinished or exhausted plan expires when it produces no shot.

Proposed initial failure behavior: a newly impossible movement or pass is visibly skipped and the affected player holds position; do not silently invent a replacement action. A shot, rebound, turnover, or possession-ending violation ends the play and discards the remaining plan. Settle exact cost/refund and dependency rules with worked examples in milestone 5. These are implementation defaults to specify, not additional confirmed user requirements.

## Feedback — MUST

During planning:

- Show each player's projected path, action order, planned ball movement, and remaining budget.
- Highlight the selected hex/action and legal targets. Explain disabled actions and conflicts at the point of interaction.
- Show costs and estimated risks before commitment. Label predictions as estimates because the defense will react during execution.

During execution:

- Highlight the active timeline step, acting player, pass or shot target, ball, and relevant defenders.
- Provide play/pause, speed, and single-step controls. Playback speed and pausing must never change simulation results.
- Explain important outcomes in short language, including the main numerical contributors: for example, "Contested finish — 42% chance" or "Pass intercepted — receiver closely guarded."
- Visibly identify skipped assignments, exhausted budgets, possession changes, and offensive rebounds. Explain that rebound budgets reset to two-thirds rounded down.

After a play:

- Summarize the result and the key reason, preserve an inspectable event history, and make the next available action clear.
- Distinguish makes, ordinary misses, and blocks once blocks exist. Never present every contested miss as a block.
- Keep text, contrast, keyboard access, and reduced-motion behavior usable on desktop and narrow screens. Required feedback must work before pixel art or advanced animations are ready.

## AI and balance

Adapt both offensive planning and defensive reactions to hex positions and timeline execution. AI must not know future random draws or exploit the human's unexecuted assignments. Defensive decisions use the current simulated court state; do not read the rest of the human plan to anticipate actions unfairly.

Retain matchup assignments, evaluate rim threats and open shooters, help only when it improves the situation, and account for recovery and remaining budget. Add screen coverage when screens are implemented.

Test open rim threats, dangerous shooters, help-and-recovery decisions, passes to cutters, and repeated harmless passes. Compare mirrored lineups and rare stamina extremes through seeded simulations. Track shot quality, useful actions, rebounds, and win rates; neither passing tests nor equal raw stat totals proves the game is balanced.

## Technical approach

Continue strict TypeScript with the rendering-independent rules engine and native DOM/SVG browser interface. Keep court geometry, tuning data, planning validation, deterministic execution, presentation, and persistence separately testable.

Extend the state machine to explicit planning, executing, resolving, and game-over states. Store committed plans and execution progress in serializable state. Resolve seeded simulation events independently of wall-clock playback, so pause, speed, stepping, and later save/load preserve outcomes.

No account system or remote server is required. JSON persistence should use browser file download/upload rather than promise unrestricted direct filesystem access.

## Development milestones and completion criteria

### 1–3. Initial rules, engine, and browser prototype — implemented baseline

Retain the existing engine and browser validation as regression evidence. The immediate-action/named-zone prototype remains runnable until each replacement is integrated.

### 4. Hex court — MUST, implemented

Implement axial coordinates, finite court cells, rim and scoring classifications, adjacency, distance, check-ball placement, and readable hex rendering. Migrate state, actions, formulas, and AI to the same spatial model. Update core-rules.md.

Done when legal movement follows hex adjacency; contours, scoring, contest range, and under-rim eligibility are visible and consistent; existing basketball invariants pass on the new court; and ordinary-stamina sample possessions remain practical.

### 5. Planned plays and deterministic execution — MUST, next

Specify same-step ordering and failure rules with worked possessions, then implement a shared timeline, per-player queues, editing, whole-plan validation, commit, execution, and defensive reactions. Migrate AI offense to submitted plans. Replace incompatible immediate-action expiry rules. Add planning routes and dependency feedback while building the planner.

Done when coordinated movement/pass/shot plans execute without mid-play assignments; invalid plans leave state and RNG untouched; collisions and broken dependencies have defined outcomes; defense has bounded legal reactions; and shots, turnovers, rebounds, and game-over cancel the correct remaining actions.

### 6. Playback and outcome feedback — MUST release gate

Finish active-event highlights, concise explanations, result summaries, play/pause, speed, stepping, and responsive/keyboard interaction. Feedback work starts in milestones 4–5; this milestone verifies the complete experience.

Done when a human can plan, run, and understand a full game without reading debug logs; rebound planning and budget resets are clear; errors show at the relevant action; and the same seed and plan yield identical results at every playback speed and under stepping/pausing. Verify both successful and broken plays in the browser.

### 7. Tactical AI and balance

Improve coverage, help/recovery, offensive plan quality, and stamina/height tradeoffs on the settled hex and timeline rules. Add screens only with matching planning, resolution, defensive coverage, and feedback. Basic legal and competent defense is required in milestones 4–6; deeper tuning continues here.

Done when scenario checks reject obvious defensive mistakes and seeded mirrored simulations and human playtests expose no dominant action or rare-player profile. Record remaining tuning limitations honestly.

### 8. Pixel art and outcome animations — SHOULD

Establish pixel-art scale and silhouettes on the stable hex court. Add made-shot, miss, dunk, and block animations; define explicit block probability/events and their rebound consequences before animating blocks. Preserve open-dunk guarantees. Offer reduced-motion and fast-play alternatives.

Done when each implemented outcome has distinct readable presentation, players remain distinguishable, and visual timing does not change simulation outcomes.

### 9. Versioned JSON saves — WANT, before seasons

Add download/upload of a JSON save with a schema version, roster and ratings, scores, possession and phase, hex positions, stamina, strategy, RNG state, committed plan and execution cursor, and match status. Include completed-game results needed by later season progression. Decide whether to save only at stable boundaries or support paused execution; state the supported boundary in the interface.

Validate imported files and reject unsupported or invalid data without changing the current game. Keep transient timers and DOM out of saves. Define migrations before changing a published save schema.

Done when a saved game resumes with the same legal state and next random outcome, invalid files preserve the current game, and export/import works from the browser.

### 10. Seasons and player development — WANT

Define a finite season schedule and results, award development points after both wins and losses, and let the human spend them on players between games. Tune win/loss awards, upgrade costs, and caps. Preserve archetype tradeoffs and keep rare stamina extremes rare; do not let every player become fast, tall, and excellent at every skill.

Extend JSON saves to preserve season position, results, point balance, upgraded ratings, and reward history. Apply each game's reward once, including after reload/import. Show earned points, upgrade costs, effects, and remaining balance clearly.

Done when a season can be played, saved, resumed, and completed; wins and losses both award points exactly once; upgrades cannot overspend or exceed defined limits; and the resulting roster remains balanced enough for playtesting.

## Next playable release acceptance criteria

- A human can complete a 3-on-3 game to 21 in the browser using the hex court and submitted plays.
- All offensive actions are assigned before playback; movement, passing, shooting, and off-ball coordination remain useful.
- Each player's stamina cannot be overspent; scoring, height tradeoffs, rare stamina profiles, guaranteed open dunks, and rebound rounding remain correct.
- Offensive rebounds stop the current play and start a new reduced-budget planning phase.
- Both teams use the same court and execution rules. Automatic human defense and competent, budget-limited AI defense remain functional.
- Required planning, execution, and result feedback works without relying on pixel art or advanced animations.
- Pausing, stepping, or changing speed does not alter the seeded result.
- All superseded named-zone and immediate-action assumptions are removed from active rules and tests, with historical validation clearly identified.

## Main risks and decisions to resolve

- A dense hex board may consume all stamina before players create useful opportunities; tune cell count before making assets.
- Simultaneous movement, passing, collisions, and defensive reactions need an explicit order before the timeline engine is written.
- Skipped actions and broken dependencies must be fair and visible, rather than silently replacing a player's intended play.
- Playback must explain causality without forcing the player to watch a long sequence at normal speed.
- Progression can erase archetype tradeoffs unless upgrade costs and caps are designed deliberately.
- Save/load must preserve RNG and reward history to avoid changed outcomes or duplicate development points.

## Historical prototype validation

The following records describe the initial named-zone, immediate-action prototype. Re-run and adapt these checks for the new milestones; they are not evidence of completed hex, timeline, feedback, persistence, or season work.

## Milestone 2 validation

The initial 16 scenario tests passed, including repeat rebound allowances, 21-point wins, guaranteed open dunks, contested rim shots, height modifiers, rare stamina profiles, invalid actions, defensive reactions, and seeded reproducibility. A separate simulation completed 120 games: 60 with default lineups and 60 with rare-profile stress lineups, mirrored across teams. This establishes termination and rule consistency, not roster balance or final AI quality. The baseline AI produces low-quality shots and needs the planned tactical improvements and playtesting. The browser interface is now implemented; see milestone 3 below.

## TypeScript conversion

Source, roster, scenario tests, and simulation runner use TypeScript with explicit state, action, zone, player, strategy, and event types. The build emits JavaScript, declarations, and source maps under dist/. Run npm ci, npm run typecheck, npm test, and npm run simulate -- 30. All 16 tests passed after conversion; 120 simulation results matched the original JavaScript version. Four seeded full games also matched action by action, including state and event logs.

## Milestone 3 validation

The browser court supports player selection, court-zone movement, passing, shooting, chance previews, stamina counters, 21-point scoring, reduced-stamina rebound phases, strategy selection, opponent step/play/pause controls, game-over results, seeded restart, and readable event feedback. The local server runs with npm run dev at http://127.0.0.1:5173. State is in memory and resets on reload.

Strict type checking and all 19 tests passed, including three UI-session flow tests. Browser checks covered off-ball movement, a completed pass, scoring, defensive strategy, an opponent offensive rebound with reduced allowances, a complete game ending at 21, restart, and automatic opponent playback returning control. Responsive layout inspection found that small screens placed instructions before controls; controls now precede the supplementary panels. Browser console checks showed no errors during these flows. Detailed AI tuning, balance, sound, and richer animation remain later milestones.

## Milestone 4 validation

The 60-cell axial court is shared by movement, shot classification, contests, pass/drive pressure, rebound distance, AI, and browser targets. Check-ball positions, state/action types, event descriptions, and tests now use hex coordinates. Pixel projection stays in the renderer. New geometry tests cover board bounds, shortest paths for every cell pair, scoring areas, coordinate labels, invalid movement, and reaching the rim with normal stamina. Original scoring, rebound, stamina, height, and dunk scenarios were migrated. This milestone does not implement the phase 5 planner or complete the later feedback release gate.

Verification: strict type checking and all 24 tests passed. The simulation runner completed 120 games across default and rare-player mirrored lineups. Browser testing completed a 14–21 game, verified defended-hex movement, live three-to-two-point preview changes, restart, and keyboard hex activation with no console errors. Phase 5 remains next; AI quality and balance still require later tuning.

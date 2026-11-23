# AllDunks — Initial Game Plan

## Vision

A single-player, phase-based, 3-on-3 basketball browser game focused on tactical choices, court positioning, and calculated risk. AllDunks is the title, not a restriction on gameplay: passing, jump shots, layups, drives, screens, rebounds, and defense all matter. Dunks can be one finishing option, not the central mechanic.

Status: milestones 1 and 2 are implemented on codex/core-rules. See [core-rules.md](core-rules.md) for rules and [README.md](README.md) for running the engine checks. The prototype uses strict TypeScript compiled to JavaScript ES modules, shared by Node and the future browser UI. Milestone 3, the playable court interface, is next.

## Confirmed requirements

- One human player controls a three-player team against an AI team.
- Play is organized into phases rather than continuous real-time action.
- Each athlete has a stamina stat that determines how many moves they can make in a phase. Most are 4–6; rare 3 or 7 profiles require compensating strengths and weaknesses, including height.
- The score limit is 21; reaching or exceeding it wins.
- The human team's defense resolves through probability-based calculations.
- AI defense must make competent, understandable basketball decisions.
- An offensive rebound begins a new offensive phase with floor(normal phase stamina × 2/3) moves per athlete, representing the shorter remaining shot clock. Round down exactly; there is no minimum-one override.

## Accepted first playable scope

Use a top-down half court and games to 21, with two-point baskets inside the arc and three-point baskets outside it. Start with court zones or a small grid to make movement, spacing, and legal actions clear. Use six fixed athletes and a small set of meaningful stats before adding roster building or progression. This first-playable scope is accepted; the exact court representation remains to be chosen.

The player should win through creating good opportunities, not repeatedly exploiting one dominant action.

## Possession and phase flow

1. Start a possession and assign each offensive athlete their phase move allowance from stamina.
2. On human offense, select an athlete and perform a legal action, paying its move cost.
3. Let AI defenders react to that action under a defined reaction budget.
4. Continue until the offense shoots, turns the ball over, or exhausts the phase allowance.
5. Resolve a shot using shooter ability, shot location, defensive pressure, and other visible modifiers.
6. Resolve a missed shot into an offensive rebound, defensive rebound, or dead ball.
7. On an offensive rebound, start a new offensive phase with the reduced allowance.
8. On a defensive rebound, made basket, or turnover, change possession and start the appropriate next phase.
9. On AI offense, resolve its attack against the human team's defensive ratings, positioning or abstract coverage, and selected defensive strategy.

The core rules specify checked-ball resets on possession changes and a phase violation when the ball holder cannot progress play. See core-rules.md for resolution order.

## Stamina and action economy

Stamina must determine the number of moves an athlete can make in a phase. Represent the remaining allowance separately so spending moves does not overwrite the athlete's underlying stat.

Stamina rules:

- Normal phase allowance: derived directly from the athlete's stamina stat.
- Offensive rebound allowance: floor(normal phase allowance × 2/3), with no minimum-one override. For example, five becomes three, six becomes four, and one becomes zero.
- Example: a normal allowance of six becomes four after an offensive rebound.
- Recalculate from the normal allowance on every offensive rebound; do not compound the reduction. Rounding down is confirmed. The prototype uses the normal allowance as the baseline on every rebound.
- A defensive rebound gives the new offense its normal allowance.
- Apply the same rebound rules to both teams.
- Keep long-term fatigue out of the first prototype. Add it only if phase stamina alone proves insufficient.

Prototype movement, passing, driving, and shooting each cost one move. A zero-allowance athlete can receive a pass but cannot shoot; a completed pass to that athlete ends the phase as a violation. Screens remain later work. See core-rules.md for complete timing and costs.

## Offensive actions

First prototype:

- Move to a legal adjacent court location.
- Pass to a teammate, with risk based on distance, passing ability, and defensive coverage.
- Drive with the ball, considering the defender and available space.
- Shoot: three-point perimeter shot, two-point midrange shot, or two-point finish near the rim.
- Under-rim attempt: when the ball handler is directly under the rim and undefended, resolve the attempt as a dunk with 100% success for two points, without a shot-success roll. When defended, resolve the attempt as a regular two-point shot at the rim, using finishing ability and defensive pressure to calculate success probability. Evaluate coverage at shot resolution using the shared court-based contest rule; define its exact range with the court layout. No separate dunk-ability eligibility restriction for the first playable.

After the core loop works:

- Set a screen and handle switches or help defense.
- Add cuts, give-and-go opportunities, and distinct finishing options.
- Expand finishing options beyond the initial layup and under-rim dunk.

## Probability-based human defense

Give the human meaningful defensive strategy choices while letting calculations resolve opponent possessions. Initial strategies could include balanced coverage, protecting the paint, and pressuring the perimeter.

Calculate opponent opportunities using offensive abilities, defensive ratings, matchup quality, strategy, and stamina constraints. Resolve the attack as explicit events such as a shot, turnover, foul if implemented, and rebound. Avoid collapsing all outcomes into one unexplained success roll.

Show the major reasons for outcomes. Strong defense should improve the odds without guaranteeing a stop. Decide during prototyping whether AI offense uses the same court simulation internally or a simpler possession model; the latter must still honor stamina and offensive rebound phases.

## Competent AI defense

Start with a rules-and-scoring approach; machine learning is unnecessary for the initial version.

For each legal reaction, score:

- Immediate threat to the rim and ability to contest the ball handler.
- Shooter ability, distance to the basket, and open space.
- Passing-lane pressure and the cost of leaving an assignment.
- Help defense, recovery distance, and available reaction budget.
- Screen coverage once screens exist.

Use explicit matchup assignments and prevent defenders from chasing the ball indiscriminately. Help only when the expected benefit outweighs the scoring chance conceded elsewhere. Preserve legal movement and budgets; the AI must not teleport, receive unlimited reactions, or act on future player choices.

Recommended starting timing: one bounded defensive response after each human offensive action. Define a team or per-defender response budget and any zero-cost coverage updates before implementation. Check that harmless passes cannot generate unlimited defensive movement.

## Suggested athlete stats

Keep the first set small:

- Stamina: phase move allowance; most athletes have 4–6, with rare 3 or 7 exceptions balanced against height and skill strengths.
- Height: physical reach in centimeters; affects at-rim contests and rebounding. Slow centers typically gain height/interior strengths; fast guards typically sacrifice height/rebounding.
- Shooting: perimeter and/or midrange accuracy.
- Finishing: ability to score near the rim.
- Passing: pass success under pressure.
- Defense: contesting and containing opponents.
- Rebounding: ability to secure missed shots.

Introduce separate speed, ball handling, or additional defensive skills only when they create distinct decisions that the initial stats cannot support.

## Interface and feedback

- Show the court, all six athletes, ball possession, score, and current phase.
- Display each athlete's remaining moves and highlight legal actions.
- Preview approximate shot quality and action costs before committing.
- Label rebound phases clearly and explain their reduced move allowance.
- Provide a compact event log explaining shots, turnovers, defensive reactions, and rebounds.
- Use simple animations after the underlying rules are reliable.

## Technical approach to evaluate

The rules prototype uses strict TypeScript, compiles to JavaScript ES modules, and runs checks with the built-in Node test runner. TypeScript and Node type definitions are development-only dependencies. Choose the browser rendering/UI library during milestone 3. Keep game rules independent of rendering so possessions can be simulated and verified without a browser.

Use an explicit game-state machine, legal-action validation, and seeded randomness for reproducible debugging. Store probabilities and action costs in tuning data rather than scattering constants through UI code. No server or account system is needed for the first playable version.

## Implementation milestones

### 1. Lock the core rules — specified

Define court layout, phase timing, stamina allowances, action costs, possession changes, defensive reaction budgets, and shot/rebound outcomes. Write a few sample possessions to expose ambiguities.

### 2. Build the rules prototype — implemented

Implement state transitions, legal actions, stamina spending, shot outcomes, and rebound phases with seeded randomness. Verify offensive rebounds reset to the reduced allowance and defensive rebounds change possession correctly.

### 3. Build the playable court

Add player selection, movement, passing, shooting, score display, move counters, and event feedback. Complete a full game with placeholder graphics.

### 4. Implement defensive intelligence

Add matchup assignment, contests, help and recovery, and threat scoring. Evaluate scenarios involving an open shooter, an unguarded drive, and a dangerous pass. Add screens and their coverage after the base defense is stable.

### 5. Add opponent possessions and defensive strategy

Implement probability-based human defense and readable AI possessions. Ensure both sides obey the same stamina and rebound constraints even if their presentation differs.

### 6. Balance and polish

Tune shot probabilities, action costs, rebound frequency, and defensive response budgets. Add animations and sound once full games are tactically interesting.

## Acceptance criteria for the first playable

- A human can complete a 3-on-3 game against AI in a browser.
- Each athlete's phase allowance derives from stamina and cannot be overspent.
- Offensive rebounds visibly begin a reduced-stamina offensive phase.
- Human defense uses probability-based outcomes affected by meaningful defensive choices.
- AI covers obvious threats, reacts legally, and does not abandon dangerous shooters without reason.
- Movement, passing, driving, and different shot locations offer useful choices.
- Baskets score two or three points according to location; dunks score two.
- An undefended attempt directly under the rim is a guaranteed two-point dunk. A defended attempt there resolves as a probability-based two-point shot at the rim. Dunks are unavailable elsewhere.
- Rebound allowances use exactly floor(normal allowance × 2/3).
- Outcomes and remaining moves are understandable from the interface.
- Seeded simulations can reproduce reported rule or AI bugs.

## Milestone 1 decisions

The prototype defaults are recorded in core-rules.md: 11 named court zones, one-move actions, one bounded defensive response per successful setup action, games to 21 without a winning margin, automatic defense with strategy selected per opponent possession, and shared rules for AI offense. Possession changes reset to a check; offensive rebounds preserve positions and reset to floor(normal stamina × 2/3).

These defaults resolve the initial design questions for implementation. Tune probabilities, AI scoring, zone connections, and stamina through scenario checks and playtesting. Confirmed scoring, rebound rounding, and dunk behavior remain requirements.

## Main design risks

- Too many actions can make a possession tedious; too few can erase tactical choices.
- Unlimited defensive reactions can punish passing and break the action economy.
- Excessive randomness can make good decisions feel irrelevant; deterministic outcomes can remove tension.
- Abstract human defense needs meaningful choices and clear feedback to remain engaging.
- Rebound phases must create urgency without making second-chance possessions ineffective.

## Milestone 2 validation

The initial 16 scenario tests passed, including repeat rebound allowances, 21-point wins, guaranteed open dunks, contested rim shots, height modifiers, rare stamina profiles, invalid actions, defensive reactions, and seeded reproducibility. A separate simulation completed 120 games: 60 with default lineups and 60 with rare-profile stress lineups, mirrored across teams. This establishes termination and rule consistency, not roster balance or final AI quality. The baseline AI produces low-quality shots and needs the planned tactical improvements and playtesting. No browser interface has been implemented yet.

## TypeScript conversion

Source, roster, scenario tests, and simulation runner use TypeScript with explicit state, action, zone, player, strategy, and event types. The build emits JavaScript, declarations, and source maps under dist/. Run npm ci, npm run typecheck, npm test, and npm run simulate -- 30. All 16 tests passed after conversion; 120 simulation results matched the original JavaScript version. Four seeded full games also matched action by action, including state and event logs.

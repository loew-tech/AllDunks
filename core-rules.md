# AllDunks core rules — first playable

Milestone 1 specification. Confirmed requirements take precedence; other choices below are prototype defaults to tune through play. This milestone defines behavior; milestone 2 implements the rules engine.

## Match and possessions

One human controls three athletes against three AI athletes on a half court. First team to reach or exceed 21 wins, without a winning-margin requirement. Baskets inside the arc score two; outside score three. The human starts the first possession. No free throws, fouls, screens, loose-ball scrambles, or out-of-bounds events in the initial rules engine.

A possession consists of an opening offensive phase and any offensive-rebound phases. A made basket, defensive rebound, intercepted pass, stopped drive resulting in a turnover, phase violation, or voluntary end-possession changes possession. All changes of possession start a checked-ball phase with reset positions and full allowances. This deliberately omits transition play and clearing the ball in the first playable.

## Court

Use 11 named zones. Connections are undirected; movement costs one per edge. Same-team athletes cannot share a zone; opponents may share a zone to represent close coverage. Movement through an intermediate zone requires a separate action.

| Zone | Shot type | Connected zones |
| --- | --- | --- |
| Top arc (T) | Three | Left wing, right wing, high paint |
| Left wing (LW) | Three | Top arc, left corner, left elbow |
| Right wing (RW) | Three | Top arc, right corner, right elbow |
| Left corner (LC) | Three | Left wing, left block |
| Right corner (RC) | Three | Right wing, right block |
| High paint (H) | Midrange two | Top arc, left elbow, right elbow |
| Left elbow (LE) | Midrange two | Left wing, high paint, left block |
| Right elbow (RE) | Midrange two | Right wing, high paint, right block |
| Left block (LB) | At-rim two | Left corner, left elbow, rim |
| Right block (RB) | At-rim two | Right corner, right elbow, rim |
| Rim (R) | Under-rim two | Left block, right block |

At a check, offense starts at T (ball handler), LW, RW; defense starts at H, LE, RE, matched respectively. After an offensive rebound, preserve all positions and give the ball to the rebounder.

Graph distance means shortest edge count. A defender contests from the shooter's zone or an adjacent zone. An athlete remains able to contest and rebound after spending all movement allowance. Show court connections and contest coverage in the interface so named-zone adjacency is understandable.

## Stamina and phase timing

Normal allowance equals the athlete's integer stamina stat. Most athletes have stamina 4–6. Rare exceptions have stamina 3 (typically a slow, tall center) or 7 (typically a fast, short guard). Valid roster stamina is 3–7; other ability ratings are integers from 0 to 100. Height is a separate physical attribute measured in centimeters. Every athlete has an independent remaining allowance. No borrowing, negative balances, or fatigue across possessions.

On every offensive rebound, reset each athlete's allowance to floor(normal stamina × 2/3). Always use normal stamina, including repeated rebounds. Do not preserve unspent moves or compound reductions. No minimum override: stamina one produces zero. Both teams follow these rules.

Each successful non-shot offensive action permits at most one defensive movement reaction by one defender, moving one graph edge for one allowance. The defense may hold. Reactions never earn more reactions. Validate the whole action before paying costs or consuming random numbers.

Shots resolve immediately against current coverage: there is no extra defensive move after committing a shot. The defense has already had an opportunity to respond to the preceding setup action. Thus a move to the rim may be answered before the player gets a shot. Preview shot quality only after that response is complete.

After action resolution and any reaction, if the ball handler has no affordable action that can progress play, end the phase as a violation. Moving a teammate cannot restore the ball handler's allowance, so it cannot postpone this condition. The human can voluntarily end the possession. There is no additional real-time clock.

## Athlete balance and height

Stamina represents phase mobility as well as endurance; do not add a second speed multiplier to movement costs. Players with more stamina have more actions, so their height and skill profile must compensate for that advantage.

- Target at least 90% of a larger roster within stamina 4–6; stamina 3 and 7 together account for at most 10%. This percentage is a prototype rarity target, not a requirement to force an exception into every small roster.
- Keep the default six-athlete first-playable roster within 4–6. Use separate balanced test lineups to exercise rare exceptions. Do not make a stamina-3 center or stamina-7 guard mandatory on each team.
- A stamina-3 center should typically be tall (roughly 208–218 cm), with strong rebounding, interior defense, or finishing to compensate for limited actions; usually sacrifice perimeter shooting or passing as well.
- A stamina-7 guard should typically be short (roughly 175–185 cm), with weaker reach and rebounding to compensate for extra actions. Shooting and passing can be strengths, but do not maximize every skill.
- Players within 4–6 may have varied heights and archetypes. Height is an advantage in specific situations, not a universal rating bonus. The example height bands are tuning guides rather than eligibility restrictions.
- Compare complete player profiles in mirrored lineups and seeded simulations. Equal totals across raw stats do not establish balance because an extra action has a different value from one rating point. Track win rate, shot quality, rebounds, and useful actions before adjusting roster profiles.

Height must affect outcomes rather than serving only as flavor. Initial tuning rules:

- For contested at-rim shots only, add clamp((defender-height-cm - shooter-height-cm) × 0.002, -0.04, 0.04) to each defender's pressure. Use the usual strongest-plus-half-others combination afterward. Perimeter and midrange pressure remain unchanged.
- For rebounds, multiply each candidate's weight by clamp(1 + (height-cm - 195) × 0.01, 0.75, 1.25). Ratings and positioning still matter.
- Height never extends contest range, permits remote blocks, or changes an undefended under-rim dunk's guaranteed success. It also does not change stamina-derived action costs.

## Actions

| Action | Cost paid by | Effect |
| --- | --- | --- |
| Move without ball | Moving athlete: 1 | Move to an adjacent zone without a teammate |
| Dribble / drive | Ball handler: 1 | Move to an adjacent zone without a teammate; pressure may cause a turnover |
| Pass | Passer: 1 | Transfer ball to either teammate if successful; receiver pays nothing |
| Shoot | Shooter: 1 | Resolve shot and then basket or rebound |
| End possession | None | Concede possession |

A zero-allowance athlete can receive a pass, contest, and rebound, but cannot move, pass, or shoot. Warn before passing to an exhausted teammate; such a completed pass immediately causes a phase violation. A shot using the final move is legal and resolves before expiry. Invalid actions leave state and RNG unchanged.

## Shots and dunks

An undefended ball handler at R who spends one move to shoot automatically dunks for two points with 100% success. Do not consume a shot-success random draw. If any defender is at R, LB, or RB, the same action becomes a probability-based at-rim shot. Never roll a contested dunk separately. Blocks are represented by the contest penalty, not an additional block event.

For all other shots, calculate probability using ratings divided by 100:

- Three: base = 0.20 + 0.30 × shooting.
- Midrange two: base = 0.30 + 0.35 × shooting.
- At-rim two: base = 0.45 + 0.40 × finishing.
- For each contesting defender: pressure = (0.12 if same zone, otherwise 0.06) + 0.10 × defense, plus the height modifier specified above for at-rim shots only.
- Subtract the strongest pressure plus half of each other pressure; clamp probability to [0.05, 0.95].
- Draw uniform u in [0,1); make the shot if u < probability.

These are tuning constants, not claims about real basketball accuracy. Display the resulting percentage and contributors. The guaranteed open dunk overrides the normal probability cap.

## Passes and drives

For a pass, count defenders sharing or adjacent to the receiver's zone. Pass success = clamp(0.98 - 0.025 × max(0, distance - 1) - 0.10 × (1 - passing) - 0.06 × receiver-pressure-count, 0.55, 0.98). This models pressure at the target rather than geometric passing lanes. A failure is an interception and checked-ball possession change. A successful pass receives the normal defensive response.

For a dribble, evaluate defenders sharing or adjacent to the destination before movement. If none, movement is automatic without a turnover draw. Otherwise turnover probability = clamp(0.04 + 0.12 × strongest-defense + 0.04 × (additional-defenders), 0.04, 0.30). A successful drive moves the athlete, then permits the normal reaction. Failure changes possession. Off-ball movement does not roll for turnovers.

## Rebounds

Every missed shot immediately produces a rebound. All six athletes are candidates. Candidate weight = (1 + rebounding-rating) × proximity-factor × height-factor, using raw 0–100 rating and the height factor specified above. Proximity factor by distance from R: 0 → 4; 1 → 3; 2 → 2; 3 or more → 1. Select one athlete proportionally to weight using one random draw and stable athlete-ID ordering.

Offensive winner: retain positions, assign ball, start reduced-stamina phase for offense and defense. Defensive winner: change possession, reset checked-ball positions, assign the new team's designated ball handler and normal allowances. The rebounder's identity remains in the event log even when the next check resets ball ownership.

## Defensive decisions and opponent offense

Before each opponent possession, the human chooses balanced, protect paint, or pressure perimeter. That choice persists through offensive rebounds. Human defenders react automatically; outcomes use their ratings and the same probability formulas. No manual defensive movement is required.

AI offense uses the same zones, actions, stamina, reactions, and rebound rules as human offense. Present a short event sequence with the option to advance quickly. Use a one-action scoring policy initially: compare available shot value, pass-to-shot potential, and improvement in shot quality from movement, accounting for turnover risk and remaining allowance. An athlete with one move left should favor a viable shot over a move that guarantees expiry.

Defensive policy evaluates holding and every legal one-defender movement. Minimize the largest current offensive shot threat (shot points × success probability), then the next largest threat, then total threat. For paint protection, multiply at-rim threat by 1.20; for perimeter pressure, multiply three-point threat by 1.20. Balanced uses 1.00 throughout. On equal threat scores, prefer keeping initial matchup coverage, then spending fewer moves, then stable athlete/zone ID. Use identical policy on AI defense with balanced strategy initially.

This makes an unguarded rim worth addressing, penalizes abandoning a shooter, and bounds defensive movement. It is a baseline, not a guarantee of expert play. Scenario checks must establish that the AI contests an immediate rim threat when possible, preserves coverage of a dangerous shooter when help gains less, and does not waste its entire budget chasing harmless passes. Improve scoring in milestone 4 if these fail.

## State and event contract

State includes score, possession team, phase type (normal/rebound), phase number, positions, ball holder, six ratings records, six remaining allowances, selected strategy, RNG state, and match status. Resolution states are action → defensive reaction when applicable → shot/rebound or expiry → next action/phase/possession → match over. Stop immediately after a winning basket.

Use stable seeded randomness. Log action costs, legal defensive reactions, calculated chances, outcomes, rebound identity, phase allowance resets, and possession changes. No hidden extra actions. Keep formulas and tuning constants independent of rendering.

## Sample possessions / milestone 2 verification scenarios

1. **Open dunk after setup:** offense with a move remaining reaches R. Defense has no legal affordable reaction that places anyone at R/LB/RB and holds. Shooting costs one, awards two, consumes no shot RNG draw, then starts the opponent's checked possession unless it wins the match.
2. **Defended rim:** shooter at R, defender at LB with defense 80, shooter finishing 70, and equal shooter/defender height. Base 0.73 minus adjacent pressure 0.14 gives 0.59. Attempt is a two-point shot, not a guaranteed dunk. A roll of 0.58 scores; 0.59 misses.
3. **Repeated offensive rebounds:** normal stamina [5,6,4] resets to [3,4,2] after the first offensive rebound, regardless of unspent moves. A later offensive rebound resets to [3,4,2] again. Preserve locations and give the rebounder the ball.
4. **Defensive rebound:** any miss secured by defense ends the possession, resets court positions, and restores normal allowances [5,6,4] for that team. The next possession is not a reduced phase.
5. **Last-move shot versus stranded ball:** a shooter with one move can shoot and resolve normally. Passing to a teammate with zero moves is legal with a warning; if completed, it produces a violation. No automatic free shot.
6. **Three to win:** at 20 points a made three ends the game at 23. Do not start another possession or require an exact score of 21.
7. **Finite reactions:** each successful pass permits at most one legal one-edge defensive movement costing one. Repeated passes spend offense and defense allowance; no defender can move after their allowance reaches zero, though they still contest.
8. **Invalid action:** trying to move two edges or spend zero available allowance changes neither state nor RNG.

9. **Rare stamina extremes:** a stamina-3 center gets three normal moves and two on every rebound phase; a stamina-7 guard gets seven normal moves and four on every rebound phase. The distribution target must not silently change these allowances.
10. **Height tradeoff:** at equal position and rebounding rating, a 215 cm athlete has rebound weight factor 1.20 while a 180 cm athlete has 0.85. A 215 cm defender contesting a 180 cm shooter at the rim adds the capped 0.04 pressure modifier; the reverse matchup subtracts 0.04. An open under-rim dunk remains guaranteed at either height.

## Milestone 1 completion

Court, timing, costs, possession changes, rebound rules, probabilities, and AI baseline are specified sufficiently to begin the rules prototype. Validate formulas and scenario expectations in milestone 2. Balance, presentation, screens, and richer AI remain later work.

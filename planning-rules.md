# Planned plays — phase 5

This is the active turn model for both teams. It replaces the prototype's immediate-action offense. The low-level `applyAction` API remains for isolated rules regression tests; browser play and the simulation runner use `commitPlan` and `stepPlay`.

## Timeline and holds

At the start of a phase, S is the largest current offensive-player move allowance. Every offensive player receives exactly S slots, all defaulting to hold. A player with allowance N may replace at most N slots with active actions. They can hold for every slot; no active action is mandatory. Holds cost zero, do not restore stamina, do not extend the phase, and do not generate defensive movement. A holding defender still contests and rebounds.

After an offensive rebound, reset allowances to floor(normal stamina × 2/3), recalculate S, and start a fresh all-hold draft. Repeated rebounds always use normal stamina. Both teams follow the same rules.

## Planning

One assignment per player per slot: hold, adjacent movement, pass to a teammate, or shoot. Movement by the ball holder becomes a dribble/drive during execution. All active actions cost one move. A player cannot move and shoot in the same slot, but can receive a pass and shoot in that slot.

Select a timeline cell to edit that player's slot. Assigning an action cycles to the next teammate at the same step. After the third teammate, advance to the next step and the first teammate. At the end of the final step, keep the final slot selected for review instead of wrapping and overwriting earlier assignments. The active player’s hex glows gold; the Hold button above the player assigns a zero-cost hold and follows this same cycle. New phases start with the first roster player. Direct timeline edits remain available. Clear returns a slot to hold; earlier/later swaps it with its neighbor in that player's row. Clearing the play restores all holds.

The court forecasts positions immediately before the selected step. Dashed paths show planned movement. Forecasts assume offensive actions succeed and defenders stay at their current positions; displayed odds are estimates, not guarantees. Validation and editing never consume RNG, live stamina, or live court state.

Validation checks team/phase identity, timeline shape, player identity, total active-action budget, adjacency/bounds, teammate occupancy, pass ownership, and shot ownership. Two teammates targeting one hex are invalid. A move into a teammate who is not leaving is invalid. Swaps and cycles are legal when everyone vacates successfully. Known errors block commitment; temporary invalid drafts can be edited freely.

No shot and assignments after a scheduled shot produce warnings. They do not block commitment: an all-hold play is allowed, and unused later assignments will be cancelled when the shot resolves. Active assignments still count against planning budgets even when scheduled after a shot.

## Committing and executing

Commit copies the complete plan into serializable game state and closes planning. Assignment edits and strategy changes are unavailable during execution. The execution cursor advances only through `stepPlay`; a timer controls presentation, never basketball outcomes. Play/pause, speed, single-step, or serialization between steps yield the same results for a given state and seed.

Each shared step resolves in this order:

1. **Holds:** record zero-cost holds.
2. **Movement:** resolve teammate occupancy simultaneously using the step-start board. Drive risk uses defenders at the start of the step. Pay each attempted move once, then apply surviving destinations together. If a drive turns the ball over, resolve the possession change and cancel the rest of the play. Other simultaneous off-ball movement may have occurred before the reset.
3. **Pass:** only the ball holder at the start of the step may pass. The pass targets the receiver's position after movement. A receiver may shoot later in this same step, but may not relay another pass until a later step. Interceptions end the play.
4. **Defense:** at most one legal, budgeted defensive movement response if any offensive movement or pass succeeded. Several simultaneous setup actions still earn only one response. A step containing only holds or a stand-alone shot earns none. Defense evaluates the current court, not the human's remaining plan or future RNG.
5. **Shot:** resolve against coverage after that defensive response. An undefended shot at `(0,0)` is a guaranteed two-point dunk with no shot-success draw. A defended attempt uses the ordinary at-rim calculation. Resolve misses and rebounds immediately.

Use stable athlete-ID order where an order is needed within a stage. Unexpectedly unavailable assignments are skipped visibly, with no invented replacement. An attempted active action costs one when budget remains; an exhausted player's skipped action costs zero. Illegal movements stay in place. Full-plan validation prevents foreseeable failures; stochastic turnovers cancel dependent future steps rather than trying to recover automatically.

## Ending a play

A shot, turnover, offensive rebound, or winning basket cancels the remaining steps. An offensive rebound returns to planning at preserved positions with reduced budgets; possession changes reset to a check with normal budgets. Stop immediately at a winning basket.

If the last step finishes without a shot or turnover, expire the phase as a turnover. An exhausted ball holder alone does not end the phase early: teammates may continue their assigned actions, and everyone may hold. A completed pass to an exhausted receiver is legal; that receiver cannot shoot without an allowance, and the remaining timeline may ultimately expire.

## Opponent play and limitations

AI offense constructs and commits a complete plan before execution and obeys the same validator and timeline. It currently uses the baseline one-action evaluator to choose assignments against an optimistic projection. It does not replan during playback. Tactical offensive quality, stronger defensive decisions, richer execution explanations, and animation remain follow-up work.

The phase 5 interface includes essential draft errors, paths, locked playback, active-column indication, and result logs. Phase 6 remains the feedback release gate for a more polished, understandable experience. JSON files and season progression remain later milestones.

## Playback presentation

Play uses green buttons with a play icon both above the court and in the action panel. Automatic playback has a default 1.8-second interval per shared step; there is no mandatory pause or acknowledgement between results. Pause, speed selection, and manual stepping remain available. The court-level results panel shows actual events and chances from the resolved step, with shot/turnover/rebound outcomes prioritized over routine movement. The last step report remains visible after the play ends. These presentation reports do not consume RNG or change simulation timing.

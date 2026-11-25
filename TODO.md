# TODO

## MUST

1. Hex coordinates â€” implemented in phase 4.
2. Assign all actions first, then play out the sequenceâ€”like a coach calling a play during a timeout â€” implemented in phase 5.
   - Let S be the highest offensive-player action allowance in the current phase. Give every player S timeline slots, all initialized to hold. Each player can hold for the entire phase and is never required to perform an active action.
   - The coach may replace holds with active actions anywhere in the timeline. A player with allowance N can spend at most N stamina on active actions; remaining slots stay holds. Active actions and holds together occupy exactly S slots, not S additional holds beyond active actions.
   - Holds keep the player in place, cost no stamina, and do not restore stamina, extend the phase, or generate extra defensive reactions. Holding players still contest and rebound normally.
   - Recalculate S and N from reduced phase allowances after an offensive rebound. If the entire play contains only holds, run out the phase and turn possession over; do not force an active action.
3. Clear feedback to the user about what is happening â€” required for the next playable release.
   - During planning: show routes, action order, stamina costs, risks, and invalid assignments.
   - During playback: highlight the current action, explain outcomes, and provide pause, speed, and single-step controls.
   - Replace the playback-speed dropdown with a slider. Show the current speed multiplier and allow adjustment during playback.
   - After the play: summarize the result and explain possession changes and reduced-stamina rebound phases.

## SHOULD

1. Pixel art.
2. Animations for blocks, scores, misses, and dunks.
   - Add a distinct block outcome to the rules engine and connect it to the court popup; contested misses currently have no separate block event.

## WANT

1. Store the game in a JSON file.
2. Level up players as the season progresses.
   - Wins and losses yield points to spend developing players.

Implementation order and completion criteria are tracked in [plan.md](plan.md).

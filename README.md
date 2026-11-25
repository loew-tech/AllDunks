# AllDunks

A single-player, phase-based 3-on-3 basketball browser game in development.

Milestones 1–4: the core rules, TypeScript engine, and playable browser court are implemented. The engine compiles to standard JavaScript ES modules shared by the browser and Node. Use Node 22 or newer; TypeScript and Node type definitions are development dependencies, with no runtime dependencies.

## Play locally

```powershell
cd C:\Users\steve\Documents\programming\projects\games\AllDunks
npm ci
npm run dev
```

Open **http://127.0.0.1:5173** in your browser. Leave the terminal running; stop it with Ctrl+C. `npm start` does the same thing. To use a different port in PowerShell, set `$env:PORT = '5174'` before starting. This is a local server bound to your computer, with no publishing or account setup.

Select a mint player, then click a highlighted hex or use the action panel. Shooting, passing, and movement each cost one move. Shot and pass chances are shown before committing. On defense, choose your strategy and click **Play opponent possession**, or **Next AI action** to advance one step. **New game** restarts the selected seed, so repeated games can reproduce the same rolls. Change the game seed near the instructions for a different sequence. Games are not saved across reloads.

The build has no hot reload: after source edits, stop and rerun `npm run dev`, then reload the page. The 60-cell court uses axial (q, r) coordinates. Each adjacent hex costs one move. Pale green hexes are legal destinations; orange dots mark destinations currently covered by defenders. Light perimeter cells score three, interior cells score two, and only (0,0) is directly under the rim. A cell crossing the arc is classified by its center. Pixel positions do not determine movement distance. Player height, selected-player ratings, remaining moves, reduced-stamina phases, and recent outcomes are visible in the interface.

## Verify

```powershell
npm ci
npm run typecheck
npm test
npm run simulate -- 30
```

`npm run build` compiles source, UI, tests, and scripts into `dist/`, including declarations and source maps, and copies browser assets. Tests and simulations build automatically. Generated output and `node_modules/` are ignored by Git. `tsconfig.json` enables strict checking; [src/types.ts](src/types.ts) defines the public game state, player, action, strategy, and event types.

See [core-rules.md](core-rules.md) for game rules and [plan.md](plan.md) for milestones. Games end at 21 or higher. Most stamina is 4–6; the 20-profile pool contains one stamina-3 center and one stamina-7 guard. Default lineups use the ordinary range. Height affects rim contests and rebounds. Offensive rebounds reset moves to floor(normal stamina × 2/3). Open under-rim attempts dunk automatically; defended attempts use normal at-rim probabilities.

## Engine entry points

```js
import { createGame, legalActions, applyAction, selectStrategy,
  chooseOffensiveAction, shotPreview } from './dist/src/engine.js';

let game = createGame({ seed: 42 });
const choices = legalActions(game);
game = applyAction(game, choices.find(action => action.type === 'shoot'));
if (game.strategyOpen) game = selectStrategy(game, 'protect-paint');
if (game.possession === 'ai') game = applyAction(game, chooseOffensiveAction(game));
console.log(game.scores, shotPreview(game), game.events);
```

Transitions return new state; invalid actions throw without mutating input or advancing RNG. Strategy can be selected before the opponent's first action and persists through rebound phases. Events include action costs, probabilities, contests, rolls, rebounds, phase starts, and possession changes. Tests and the simulation runner exercise the same public API.

The current AI is a deterministic baseline with bounded defensive movement and one-action offensive lookahead. Simulation checks establish reproducibility and termination; their outcomes do not establish roster balance or strong basketball play. Broader AI and tuning remain milestones 4–6. The first interface uses instant court updates and a paced opponent-action sequence; richer animations and sound remain later work.

TypeScript source uses `.js` import extensions so compiled ES modules resolve directly. Code within `src/`, `test/`, and `scripts/` imports source modules through those paths; TypeScript resolves them to the corresponding `.ts` files. External JavaScript consumers import the compiled `dist/src/engine.js` module. Compiler configuration follows the official [NodeNext module guidance](https://www.typescriptlang.org/tsconfig/module.html) and [strict checking options](https://www.typescriptlang.org/tsconfig/strict.html).

## Hex court milestone

`src/court.ts` owns finite cells, axial/cube distance, adjacency, shot areas, and check-ball positions. `web/court-view.ts` owns pixel projection and polygon geometry. The engine, AI, action panel, and court use the same cell data. Current actions still resolve immediately; assigning a complete play before execution is the next milestone.

The hex migration retains scoring to 21, stamina/height tradeoffs, guaranteed undefended dunks, contested rim shots, and floor(normal stamina × 2/3) rebound resets. Geometry tests compare cube distance against an independent breadth-first search over every pair of board cells.

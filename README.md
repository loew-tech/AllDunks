# AllDunks

A single-player, phase-based 3-on-3 basketball browser game in development.

Milestones 1 and 2: the core rules are specified and a rendering-independent TypeScript rules prototype is implemented. There is no browser interface yet. The engine compiles to standard JavaScript ES modules for Node or the future browser interface. Use Node 22 or newer; TypeScript and Node type definitions are development dependencies, with no runtime dependencies.

```powershell
npm ci
npm run typecheck
npm test
npm run simulate -- 30
```

`npm run build` compiles source, tests, and scripts into `dist/`, including declarations and source maps. Tests and simulations build automatically. Generated output and `node_modules/` are ignored by Git. `tsconfig.json` enables strict checking; [src/types.ts](src/types.ts) defines the public game state, player, action, strategy, and event types.

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

The current AI is a deterministic baseline with bounded defensive movement and one-action offensive lookahead. Simulation checks establish reproducibility and termination; their outcomes do not establish roster balance or strong basketball play. Broader AI and tuning remain milestones 4–6. The next milestone is the playable court interface.

TypeScript source uses `.js` import extensions so compiled ES modules resolve directly. Code within `src/`, `test/`, and `scripts/` imports source modules through those paths; TypeScript resolves them to the corresponding `.ts` files. External JavaScript consumers import the compiled `dist/src/engine.js` module. Compiler configuration follows the official [NodeNext module guidance](https://www.typescriptlang.org/tsconfig/module.html) and [strict checking options](https://www.typescriptlang.org/tsconfig/strict.html).

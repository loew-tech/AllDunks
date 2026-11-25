import { driveRisk, passProbability, shotPreview } from '../src/engine.js';
import { cellLabel, neighbors } from '../src/court.js';
import type { PlannedAction, Strategy } from '../src/types.js';
import type { GameSession } from './session.js';

export const strategyNames: Record<Strategy, string> = {
  balanced: 'Balanced', 'protect-paint': 'Protect the paint', 'pressure-perimeter': 'Pressure the perimeter',
};
export const escape = (v: unknown): string => String(v).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function assignmentOptions(session: GameSession): PlannedAction[] {
  if (!session.canEdit) return [];
  const s = session.preview, id = session.selectedId;
  return [
    { type: 'hold', athlete: id },
    ...neighbors(s.positions[id]).map(to => ({ type: 'move' as const, athlete: id, to })),
    ...s.players.filter(p => p.team === 'human' && p.id !== id).map(p => ({ type: 'pass' as const, athlete: id, to: p.id })),
    { type: 'shoot', athlete: id },
  ];
}

export function timelineMarkup(session: GameSession): string {
  const s = session.state;
  if (s.status === 'over' || (s.possession === 'ai' && s.mode === 'planning')) return '';
  const plan = s.playback?.plan ?? session.draft;
  const names = (id: string) => s.players.find(p => p.id === id)?.name ?? id;
  const label = (a: PlannedAction): string => a.type === 'hold' ? 'Hold' : a.type === 'shoot' ? 'Shoot'
    : a.type === 'pass' ? `Pass to ${names(a.to)}` : `Move ${a.to}`;
  const validation = session.canEdit ? session.validation : { issues: [] };
  return `<section class="panel timeline-panel" aria-label="Team play timeline"><h2>${s.mode === 'executing' ? 'Committed play' : 'Call the play'}<small>${plan.slots} shared steps · each player may hold throughout</small></h2>
    <div class="timeline-scroll"><table class="timeline"><thead><tr><th scope="col">Player</th>${Array.from({length:plan.slots},(_,i)=>`<th scope="col">Step ${i+1}</th>`).join('')}</tr></thead><tbody>
    ${Object.entries(plan.rows).map(([id,row]) => `<tr><th scope="row">${escape(names(id))}<small>${row.filter(a=>a.type!=='hold').length} active / ${session.canEdit ? s.remaining[id] : (s.phase === 'rebound' ? Math.floor(s.players.find(p=>p.id===id)!.stamina * 2 / 3) : s.players.find(p=>p.id===id)!.stamina)} budget</small></th>
      ${row.map((a,i)=>`<td><button class="timeline-slot ${a.type==='hold'?'hold-slot':''} ${session.canEdit && id===session.selectedId && i===session.selectedStep?'selected-slot':''} ${s.playback?.cursor===i?'active-step':''}"
        data-slot="${i}" data-slot-player="${id}" aria-label="${escape(names(id))} step ${i+1}: ${escape(label(a))}" ${!session.canEdit?'disabled':''}>${escape(label(a))}</button></td>`).join('')}</tr>`).join('')}
    </tbody></table></div>
    ${session.canEdit ? `<div class="timeline-tools"><button data-command="clear-slot">Clear slot to hold</button><button data-command="earlier" ${session.selectedStep===0?'disabled':''}>Move earlier</button><button data-command="later" ${session.selectedStep===plan.slots-1?'disabled':''}>Move later</button><button data-command="clear-plan">Clear play</button></div>
    <div class="plan-issues" aria-live="polite">${validation.issues.map(i=>`<p class="plan-issue ${i.severity}">${i.severity==='error'?'Fix':'Note'} · Step ${i.step+1}${i.athlete?' · '+escape(names(i.athlete)):''}: ${escape(i.message)}</p>`).join('') || '<p class="plan-valid">Plan is valid. Chances shown are estimates; defenders react during execution.</p>'}</div>` : '<p class="planning-hint">Assignments are locked. The highlighted column is the next step to execute.</p>'}
  </section>`;
}

export function controlsMarkup(session: GameSession, actions: PlannedAction[], running: boolean, speed: number): string {
  const s = session.state;
  if (s.status === 'over') return `<section class="panel control-panel"><div class="eyebrow">Final · first to 21</div><h2>${s.winner==='human'?'Your court.':'Run it back.'}</h2><p class="final-score">${s.scores.human} : ${s.scores.ai}</p><button class="primary" data-command="new-game">Play again</button></section>`;
  if (s.mode === 'executing') return `<section class="panel control-panel"><h2>Play in motion <small>Step ${(s.playback?.cursor??0)+1} / ${s.playback?.plan.slots}</small></h2><p class="notice">Assignments are locked. Movement, then pass, defense, and shot resolve in each step.</p><div class="action-buttons"><button class="primary" data-command="toggle-play">${running?'Pause playback':'Play sequence'}</button><button data-command="next-step" ${running?'disabled':''}>Next step</button></div><label class="speed-label" for="playback-speed">Playback speed</label><select id="playback-speed">${[0.5,1,2,4].map(n=>`<option value="${n}" ${n===speed?'selected':''}>${n}×</option>`).join('')}</select></section>`;
  if (s.possession === 'ai') return `<section class="panel control-panel"><h2>On defense <small>AI planning</small></h2><p class="notice">Choose coverage before the opponent commits its play.${s.phase==='rebound'?' Reduced rebound budgets apply.':''}</p><div class="strategy-buttons">${(Object.keys(strategyNames) as Strategy[]).map(key=>`<button data-strategy="${key}" class="${s.strategy===key?'active':''}" aria-pressed="${s.strategy===key}" ${!s.strategyOpen?'disabled':''}>${strategyNames[key]}</button>`).join('')}</div><div class="action-buttons"><button class="primary" data-command="run-ai">Run opponent play</button><button data-command="commit-ai">Prepare for stepping</button></div></section>`;
  const previewState = session.preview;
  const selected = s.players.find(p=>p.id===session.selectedId)!;
  const forecast = shotPreview(previewState, selected.id);
  const active = session.draft.rows[selected.id].filter(a=>a.type!=='hold').length;
  const errors = session.validation.issues.filter(i=>i.severity==='error');
  const actionButton = (a:PlannedAction,i:number):string => {
    let label='', detail='1 move';
    if(a.type==='hold'){label='Hold this step';detail='0 stamina';}
    if(a.type==='move'){label=cellLabel(a.to); const risk=selected.id===previewState.ballHolder?driveRisk(previewState,selected.id,a.to):0;detail=(risk?`${pct(risk)} turnover · `:'')+'1 move';}
    if(a.type==='pass'){label='Pass to '+s.players.find(p=>p.id===a.to)!.name;detail=pct(passProbability({...previewState,ballHolder:selected.id},a.to))+' estimate · 1 move';}
    if(a.type==='shoot'){label='Assign shot';detail=`${forecast.points} pts · ${pct(forecast.probability)} estimate`;}
    return `<button data-assignment="${i}" class="${a.type==='shoot'?'primary':''}">${escape(label)}<small>${escape(detail)}</small></button>`;
  };
  return `<section class="panel control-panel"><h2>${escape(selected.name)} <small>Assign step ${session.selectedStep+1}</small></h2>
    <p class="notice">${active} / ${s.remaining[selected.id]} active actions assigned. All other slots hold. ${s.phase==='rebound'?'Rebound budget: ⅔ rounded down.':''}</p>
    <p class="planning-hint">Court previews positions before step ${session.selectedStep+1}. Ball forecast: ${escape(s.players.find(p=>p.id===previewState.ballHolder)!.name)}. A pass can arrive before a same-step shot.</p>
    <div class="action-buttons">${actions.map(actionButton).filter((_,i)=>actions[i].type==='hold'||actions[i].type==='shoot').join('')}</div>
    <div class="actions-label">Assign movement</div><div class="action-buttons">${actions.map(actionButton).filter((_,i)=>actions[i].type==='move').join('')}</div>
    <div class="actions-label">Assign pass</div><div class="action-buttons">${actions.map(actionButton).filter((_,i)=>actions[i].type==='pass').join('')}</div>
    <div class="actions-label">Commit the whole play</div>${errors.length?`<p class="notice error">Fix step ${errors[0].step+1}: ${escape(errors[0].message)}. See the timeline for all issues.</p>`:''}<div class="action-buttons"><button class="primary" data-command="run-plan" ${errors.length?'disabled':''}>Run play</button><button data-command="commit-plan" ${errors.length?'disabled':''}>Commit for stepping</button></div><p class="planning-hint">Assignments advance to the next slot. Click any timeline cell to edit it. Invalid plans must be corrected before committing.</p></section>`;
}

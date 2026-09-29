#!/usr/bin/env node
// prd2jira plan <prd.md>            preview the epics, stories and scope warnings
// prd2jira push <prd.md> --project KEY   create them in Jira (needs JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN)
import { readFileSync } from 'node:fs';
import { parsePRD, summary } from '../src/parse.js';
import { push } from '../src/jira.js';

const [cmd, file, ...rest] = process.argv.slice(2);
const flag = n => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : null; };
const c = { dim: s => `\x1b[2m${s}\x1b[0m`, b: s => `\x1b[1m${s}\x1b[0m`, y: s => `\x1b[33m${s}\x1b[0m`, r: s => `\x1b[31m${s}\x1b[0m`, g: s => `\x1b[32m${s}\x1b[0m`, bl: s => `\x1b[38;5;69m${s}\x1b[0m` };

if (!['plan', 'push'].includes(cmd) || !file) {
  console.log('usage: prd2jira plan <prd.md> [--json]\n       prd2jira push <prd.md> --project KEY [--points-field customfield_10016]');
  process.exit(1);
}
const plan = parsePRD(readFileSync(file, 'utf8'));
if (rest.includes('--json')) { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }

const s = summary(plan);
console.log(`${c.b(plan.title)}\n${c.dim(`${s.epics} epics · ${s.stories} stories · ${s.points} points · ${s.withAC}/${s.stories} with acceptance criteria`)}\n`);
for (const e of plan.epics) {
  console.log(c.bl(`▸ EPIC  ${e.title}`));
  for (const st of e.stories) console.log(`    ${st.priority}  ${st.title}  ${c.dim(st.points ? st.points + ' pts' : 'unestimated')}${st.ac.length ? c.dim(`  · ${st.ac.length} AC`) : ''}`);
}
if (plan.warnings.length) {
  console.log(`\n${c.b('Scope check')}`);
  for (const w of plan.warnings) console.log(`  ${w.level === 'error' ? c.r('✕') : w.level === 'warn' ? c.y('!') : c.dim('·')} ${w.msg}`);
}
if (cmd === 'push') {
  const env = { baseUrl: process.env.JIRA_BASE_URL, email: process.env.JIRA_EMAIL, token: process.env.JIRA_API_TOKEN };
  const projectKey = flag('project');
  if (!env.baseUrl || !env.email || !env.token || !projectKey) { console.error(c.r('\nSet JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN and pass --project KEY')); process.exit(1); }
  if (plan.warnings.some(w => w.level === 'error')) { console.error(c.r('\nFix the errors above before pushing.')); process.exit(1); }
  console.log('');
  const res = await push(plan, { ...env, projectKey, pointsField: flag('points-field'), log: m => console.log(c.g(m)) });
  console.log(c.g(`\n✓ created ${res.epics} epics and ${res.stories} stories in ${projectKey}`));
}

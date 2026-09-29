// Generates n8n/prd-to-jira.workflow.json, embedding src/parse.js in the Code node so there is one parser.
import { readFileSync, writeFileSync } from 'node:fs';
const parser = readFileSync(new URL('../src/parse.js', import.meta.url), 'utf8').replace(/^export /gm, '');

const parseNode = `${parser}
// ---- n8n entry ----
const body = $input.first().json.body || $input.first().json;
const plan = parsePRD(body.prd || '');
const errors = plan.warnings.filter(w => w.level === 'error');
if (errors.length) throw new Error(errors.map(e => e.msg).join('; '));
const PRIORITY = { P0: 'Highest', P1: 'High', P2: 'Medium', P3: 'Low' };
return plan.epics.map(e => ({ json: {
  project: body.project, prdTitle: plan.title, epic: e.title, epicSummary: e.summary,
  stories: e.stories.map(s => ({ ...s, jiraPriority: PRIORITY[s.priority] || 'Medium' })),
  warnings: plan.warnings.map(w => w.msg),
} }));`;

const expandNode = `// One item per story, carrying the key of the epic Jira just created
const out = [];
for (const item of $input.all()) {
  const epicKey = item.json.key;
  const src = $('Parse PRD').all()[$input.all().indexOf(item)].json;
  for (const s of src.stories) out.push({ json: { project: src.project, epicKey, epic: src.epic, ...s,
    description: 'Part of epic: ' + src.epic + (s.ac.length ? '\\n\\nAcceptance criteria:\\n- ' + s.ac.join('\\n- ') : '') } });
}
return out;`;

const summaryNode = `const created = $input.all().map(i => i.json.key);
const warnings = $('Parse PRD').first().json.warnings;
return [{ json: { ok: true, storiesCreated: created.length, stories: created, scopeWarnings: warnings } }];`;

const wf = {
  name: 'PRD to Jira',
  nodes: [
    { id: 'n1', name: 'PRD in', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0],
      parameters: { httpMethod: 'POST', path: 'prd-to-jira', responseMode: 'responseNode', options: {} } },
    { id: 'n2', name: 'Parse PRD', type: 'n8n-nodes-base.code', typeVersion: 2, position: [240, 0],
      parameters: { jsCode: parseNode } },
    { id: 'n3', name: 'Create epic', type: 'n8n-nodes-base.jira', typeVersion: 1, position: [480, 0],
      parameters: { jiraVersion: 'cloud', project: { __rl: true, mode: 'id', value: '={{ $json.project }}' },
        issueType: { __rl: true, mode: 'name', value: 'Epic' }, summary: '={{ $json.epic }}',
        additionalFields: { description: '={{ $json.epicSummary }}\n\nFrom PRD: {{ $json.prdTitle }}', labels: ['prd-to-jira'] } },
      credentials: { jiraSoftwareCloudApi: { id: 'REPLACE_ME', name: 'Jira Cloud' } } },
    { id: 'n4', name: 'Expand stories', type: 'n8n-nodes-base.code', typeVersion: 2, position: [720, 0],
      parameters: { jsCode: expandNode } },
    { id: 'n5', name: 'Create story', type: 'n8n-nodes-base.jira', typeVersion: 1, position: [960, 0],
      parameters: { jiraVersion: 'cloud', project: { __rl: true, mode: 'id', value: '={{ $json.project }}' },
        issueType: { __rl: true, mode: 'name', value: 'Story' }, summary: '={{ $json.title }}',
        additionalFields: { description: '={{ $json.description }}', labels: '={{ ["prd-to-jira", ...$json.labels] }}',
          priority: '={{ $json.jiraPriority }}', parentIssueKey: '={{ $json.epicKey }}' } },
      credentials: { jiraSoftwareCloudApi: { id: 'REPLACE_ME', name: 'Jira Cloud' } } },
    { id: 'n6', name: 'Summary', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1200, 0], parameters: { jsCode: summaryNode } },
    { id: 'n7', name: 'Respond', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1, position: [1440, 0], parameters: { respondWith: 'firstIncomingItem', options: {} } },
  ],
  connections: {
    'PRD in': { main: [[{ node: 'Parse PRD', type: 'main', index: 0 }]] },
    'Parse PRD': { main: [[{ node: 'Create epic', type: 'main', index: 0 }]] },
    'Create epic': { main: [[{ node: 'Expand stories', type: 'main', index: 0 }]] },
    'Expand stories': { main: [[{ node: 'Create story', type: 'main', index: 0 }]] },
    'Create story': { main: [[{ node: 'Summary', type: 'main', index: 0 }]] },
    'Summary': { main: [[{ node: 'Respond', type: 'main', index: 0 }]] },
  },
  settings: { executionOrder: 'v1' },
  meta: { templateCredsSetupCompleted: false },
};
writeFileSync(new URL('../n8n/prd-to-jira.workflow.json', import.meta.url), JSON.stringify(wf, null, 2));
console.log('wrote n8n/prd-to-jira.workflow.json');

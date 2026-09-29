// Jira Cloud REST v3. Epics first, then stories linked with `parent` (works for team- and company-managed projects).
import { summary } from './parse.js';

export function adf(paragraphs, bullets = []) {
  const content = paragraphs.filter(Boolean).map(t => ({ type: 'paragraph', content: [{ type: 'text', text: t }] }));
  if (bullets.length) content.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Acceptance criteria' }] },
    { type: 'bulletList', content: bullets.map(b => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: b }] }] })) });
  return { type: 'doc', version: 1, content: content.length ? content : [{ type: 'paragraph', content: [] }] };
}

const PRIORITY = { P0: 'Highest', P1: 'High', P2: 'Medium', P3: 'Low' };

export function payloads(plan, projectKey, { pointsField = null, source = '' } = {}) {
  return plan.epics.map(e => ({
    epic: { fields: { project: { key: projectKey }, issuetype: { name: 'Epic' }, summary: e.title,
      description: adf([e.summary, `From PRD: ${plan.title}${source ? ` (${source})` : ''}`]), labels: ['prd-to-jira'] } },
    stories: e.stories.map(s => ({ fields: {
      project: { key: projectKey }, issuetype: { name: 'Story' }, summary: s.title,
      description: adf([`Part of epic: ${e.title}`], s.ac), labels: ['prd-to-jira', ...s.labels],
      priority: { name: PRIORITY[s.priority] || 'Medium' },
      ...(pointsField && s.points ? { [pointsField]: s.points } : {}),
    } })),
  }));
}

export async function push(plan, { baseUrl, email, token, projectKey, pointsField, fetchImpl = fetch, log = () => {} }) {
  const auth = 'Basic ' + (typeof Buffer !== 'undefined' ? Buffer.from(`${email}:${token}`).toString('base64') : btoa(`${email}:${token}`));
  const post = async body => {
    const r = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/rest/api/3/issue`, {
      method: 'POST', headers: { authorization: auth, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`Jira ${r.status}: ${await r.text()}`);
    return r.json();
  };
  const created = [];
  for (const group of payloads(plan, projectKey, { pointsField })) {
    const epic = await post(group.epic);
    log(`epic  ${epic.key}  ${group.epic.fields.summary}`);
    const stories = [];
    for (const s of group.stories) {
      s.fields.parent = { key: epic.key };
      const st = await post(s);
      log(`  story ${st.key}  ${s.fields.summary}`);
      stories.push(st.key);
    }
    created.push({ epic: epic.key, stories });
  }
  return { created, ...summary(plan) };
}

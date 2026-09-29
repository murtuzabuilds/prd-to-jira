// PRD markdown → a scoped Jira plan: epics, stories, points, priority, acceptance criteria.
// Pure function, no dependencies: the same file runs in Node, the browser and an n8n Code node.

const META = /^(problem|background|context|goals?|objectives?|success metrics?|metrics|kpis?|non-goals|out of scope|risks?( and open questions)?|open questions|users?|personas?|timeline|appendix|overview|summary)$/i;
const VAGUE = ['fast', 'easy', 'intuitive', 'seamless', 'simple', 'user-friendly', 'robust', 'better', 'improve', 'optimize', 'etc'];

export function parsePRD(md) {
  const lines = String(md).replace(/\r/g, '').split('\n');
  const plan = { title: '', meta: {}, epics: [], warnings: [] };
  let section = null, epic = null, story = null, metaKey = null;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    let m;
    if ((m = line.match(/^#\s+(.+)/)) && !plan.title) { plan.title = m[1].trim(); continue; }
    if ((m = line.match(/^(#{2,3})\s+(.+)/))) {
      const name = m[2].trim().replace(/^(epic|feature)\s*[:\-]\s*/i, '');
      story = null;
      if (META.test(name)) { metaKey = key(name); plan.meta[metaKey] = ''; epic = null; continue; }
      if (m[1] === '##' && /^(requirements|features|scope|user stories|epics)$/i.test(name)) { metaKey = null; section = 'req'; epic = null; continue; }
      metaKey = null;
      epic = { title: name, summary: '', stories: [] };
      plan.epics.push(epic);
      continue;
    }
    if (metaKey) { plan.meta[metaKey] += (plan.meta[metaKey] ? '\n' : '') + line.trim(); continue; }
    if (!epic) continue;

    if ((m = line.match(/^(\s*)[-*]\s+(.+)/))) {
      const depth = m[1].length, text = m[2].trim();
      if (depth === 0) {
        story = toStory(text);
        epic.stories.push(story);
      } else if (story) {
        story.ac.push(text.replace(/^(ac|given)\s*[:\-]?\s*/i, (s) => (/^given/i.test(s) ? s : '')));
      }
      continue;
    }
    if ((m = line.match(/^\s*(?:ac|acceptance criteria)\s*:\s*(.+)/i)) && story) { story.ac.push(m[1].trim()); continue; }
    if (line.trim() && !story) epic.summary += (epic.summary ? ' ' : '') + line.trim();
  }
  for (const k of Object.keys(plan.meta)) plan.meta[k] = plan.meta[k].trim();
  plan.warnings = lint(plan);
  return plan;
}

function toStory(text) {
  let points = null, priority = null, labels = [];
  text = text.replace(/\((\d+)\s*(?:pts?|points?|sp)\)/i, (_, n) => { points = +n; return ''; });
  text = text.replace(/\[(P[0-3])\]/i, (_, p) => { priority = p.toUpperCase(); return ''; });
  text = text.replace(/#([a-z][\w-]*)/gi, (_, l) => { labels.push(l.toLowerCase()); return ''; });
  return { title: text.replace(/\s{2,}/g, ' ').trim(), points, priority: priority || 'P2', labels, ac: [] };
}

export function lint(plan) {
  const w = [];
  if (!plan.title) w.push({ level: 'error', msg: 'PRD has no # title' });
  if (!plan.epics.length) w.push({ level: 'error', msg: 'No epics found. Use ## headings for each feature area.' });
  if (!plan.meta.goals && !plan.meta.goal) w.push({ level: 'warn', msg: 'No Goals section, so tickets will not trace back to an outcome' });
  const metrics = plan.meta['success-metrics'] || plan.meta.metrics || plan.meta.kpis || '';
  if (!/\d/.test(metrics)) w.push({ level: 'warn', msg: 'Success metrics have no target number' });
  for (const e of plan.epics) {
    if (!e.stories.length) w.push({ level: 'warn', msg: `Epic "${e.title}" has no stories` });
    for (const s of e.stories) {
      const where = `"${s.title}"`;
      if (!s.ac.length) w.push({ level: 'warn', msg: `${where} has no acceptance criteria` });
      if (s.points && s.points > 8) w.push({ level: 'warn', msg: `${where} is ${s.points} points: split it before the sprint` });
      if (s.points === null) w.push({ level: 'info', msg: `${where} is unestimated` });
      const vague = VAGUE.filter(v => new RegExp(`\\b${v}\\b`, 'i').test(s.title));
      if (vague.length) w.push({ level: 'warn', msg: `${where} uses vague wording (${vague.join(', ')}): say what done looks like` });
    }
  }
  return w;
}

export function summary(plan) {
  const stories = plan.epics.flatMap(e => e.stories);
  return {
    epics: plan.epics.length,
    stories: stories.length,
    points: stories.reduce((a, s) => a + (s.points || 0), 0),
    unestimated: stories.filter(s => s.points === null).length,
    withAC: stories.filter(s => s.ac.length).length,
  };
}

const key = s => s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

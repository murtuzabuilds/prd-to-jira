import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePRD, summary } from '../src/parse.js';
import { payloads, push } from '../src/jira.js';

const md = readFileSync(new URL('../examples/checkout-redesign.md', import.meta.url), 'utf8');

test('epics, stories, points, priority, labels and AC', () => {
  const p = parsePRD(md);
  assert.equal(p.title, 'Checkout Redesign (sample PRD)');
  assert.deepEqual(p.epics.map(e => e.title), ['Wallet payments', 'Cost transparency', 'Guest checkout']);
  const wallet = p.epics[0].stories[0];
  assert.equal(wallet.title, 'Add Apple Pay and Google Pay on the payment step');
  assert.equal(wallet.points, 5); assert.equal(wallet.priority, 'P0'); assert.deepEqual(wallet.labels, ['payments']);
  assert.equal(wallet.ac.length, 3);
  assert.deepEqual(summary(p), { epics: 3, stories: 5, points: 26, unestimated: 0, withAC: 4 });
});

test('meta sections are not epics', () => {
  const p = parsePRD(md);
  assert.ok(p.meta.problem.startsWith('38% of carts'));
  assert.ok(p.meta['out-of-scope'].includes('Buy now'));
});

test('scope check flags oversized, vague and AC-less stories', () => {
  const msgs = parsePRD(md).warnings.map(w => w.msg).join('\n');
  assert.match(msgs, /13 points: split it/);
  assert.match(msgs, /vague wording \(seamless\)/);
  assert.match(msgs, /seamless for guests" has no acceptance criteria/);
});

test('empty input is an error, not a crash', () => {
  assert.ok(parsePRD('').warnings.some(w => w.level === 'error'));
});

test('payloads map priority and put AC in the description', () => {
  const [g] = payloads(parsePRD(md), 'SHOP', { pointsField: 'customfield_10016' });
  assert.equal(g.epic.fields.issuetype.name, 'Epic');
  const s = g.stories[0].fields;
  assert.equal(s.priority.name, 'Highest'); assert.equal(s.customfield_10016, 5);
  assert.ok(JSON.stringify(s.description).includes('Acceptance criteria'));
});

test('push creates epics first and links stories to them', async () => {
  let n = 0; const calls = [];
  const fetchImpl = async (url, opts) => { const b = JSON.parse(opts.body); calls.push(b); return { ok: true, json: async () => ({ key: `SHOP-${++n}` }) }; };
  const res = await push(parsePRD(md), { baseUrl: 'https://x.atlassian.net', email: 'a@b.c', token: 't', projectKey: 'SHOP', fetchImpl });
  assert.equal(calls[0].fields.issuetype.name, 'Epic');
  assert.equal(calls[1].fields.parent.key, 'SHOP-1');
  assert.equal(res.created.length, 3); assert.equal(n, 8);
});

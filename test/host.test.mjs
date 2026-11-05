/**
 * Deterministic checks for the Host half: scanning, fork de-duplication,
 * official-price arithmetic, range filtering, and the disk cache.
 *
 * Run with: node test/host.test.mjs
 */
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cacheDir = mkdtempSync(join(tmpdir(), 'dsh-token-meter-test-'));
process.env.DSH_TOKEN_METER_CACHE = join(cacheDir, 'sessions.json');

const MODULE = new URL('../index.js', import.meta.url).href;

const PEAK = Date.UTC(2026, 9, 5, 2, 0, 0); // 10:00 Beijing, Monday: peak
const OFF_PEAK = Date.UTC(2026, 9, 5, 12, 30, 0); // 20:30 Beijing, Monday: off-peak

function assistant(seq, time, usage, model) {
  return {
    type: 'assistant/message',
    seq,
    time,
    data: {
      turn: 1,
      step: seq,
      message: { role: 'assistant', source: { kind: 'model', provider: 'deepseek-account', model } },
      stream: [],
      usage,
    },
    surfaceOp: 'append',
  };
}

function user(seq, time, text) {
  return {
    type: 'user/message',
    seq,
    time,
    data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] },
    surfaceOp: 'append',
  };
}

const SESSIONS = [
  {
    header: { id: 's-main', createdAt: PEAK, cwd: 'D:\\work\\alpha', isSeeded: false, version: 4 },
    live: false,
    inheritedEventCount: 0,
    events: [
      user(0, PEAK, 'first question'),
      assistant(1, PEAK, { inputTokens: 1000, outputTokens: 200, cacheReadTokens: 3000, cacheWriteTokens: 0 }, 'deepseek-flash'),
      assistant(2, OFF_PEAK, { inputTokens: 500, outputTokens: 100, cacheReadTokens: 1000 }, 'deepseek-flash'),
    ],
  },
  {
    header: { id: 's-fork', createdAt: PEAK, cwd: 'D:\\work\\alpha', isSeeded: true, version: 4, parentSession: 's-main' },
    live: false,
    // The inherited prefix replays the parent's usage and must not be billed twice.
    inheritedEventCount: 2,
    events: [
      user(0, PEAK, 'inherited question'),
      assistant(1, PEAK, { inputTokens: 99999, outputTokens: 99999 }, 'deepseek-flash'),
      assistant(2, PEAK, { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0 }, 'deepseek-flash'),
    ],
  },
  {
    header: { id: 's-sub', createdAt: PEAK, cwd: 'D:\\work\\beta', isSeeded: false, version: 4, origin: 'subagent' },
    live: false,
    inheritedEventCount: 0,
    events: [assistant(0, PEAK, { inputTokens: 2000, outputTokens: 400, cacheReadTokens: 8000 }, 'deepseek-v4-pro')],
  },
];

function makeContext(sessions) {
  const routes = new Map();
  const query = {
    async listSessions() {
      return sessions.map((session) => ({ header: session.header, live: session.live === true, persisted: true }));
    },
    async readSession(id) {
      const found = sessions.find((session) => session.header.id === id);
      if (found === undefined) throw new Error('not found: ' + id);
      return { session: found.header, inheritedEventCount: found.inheritedEventCount, events: found.events };
    },
  };
  const ctx = {
    get(name) {
      return name === 'sessionQuery' ? query : undefined;
    },
    on() {
      return () => {};
    },
    effect(callback) {
      return callback();
    },
    inject(_deps, callback) {
      callback({
        connection: {
          fetch: {
            register(route) {
              routes.set(route.path, route.fetch);
              return async () => {};
            },
          },
        },
        effect(callback2) {
          return callback2();
        },
      });
    },
  };
  return { ctx, routes };
}

async function boot() {
  const module = await import(MODULE + '?test=' + Math.random().toString(36).slice(2));
  const { ctx, routes } = makeContext(SESSIONS);
  module.apply(ctx);
  const stats = routes.get('/api/dsh-token-meter/stats');
  const requests = routes.get('/api/dsh-token-meter/requests');
  assert.equal(typeof stats, 'function', 'stats route registered');
  assert.equal(typeof requests, 'function', 'requests route registered');
  assert.equal(routes.has('/api/dsh-token-meter/context'), false, 'no composer context route');
  const call = async (path) => {
    const response = await stats(new Request('http://dsh.internal' + path));
    return await response.json();
  };
  const ledger = async (path) => {
    const response = await requests(new Request('http://dsh.internal' + path));
    const text = await response.text();
    const isJson = (response.headers.get('content-type') || '').includes('json');
    return { response, text, body: isJson ? JSON.parse(text) : null };
  };
  return { call, ledger, requests };
}

async function waitReady(call, path) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const body = await call(path);
    if (body.phase === 'ready') return body;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('scan never finished');
}

const { call, ledger } = await boot();
const body = await waitReady(call, '/api/dsh-token-meter/stats?range=all');

// Call counts prove the fork prefix was skipped: 2 main + 1 fork live event + 1 subagent.
assert.equal(body.totals.calls, 4, 'billed calls exclude the inherited prefix');
assert.equal(body.totals.sessions, 3, 'three sessions with usage');
assert.equal(body.totals.subagentSessions, 1, 'subagent session flagged');

// Pricing: peak and off-peak bands must differ for the same model.
const expected =
  (1000 * 2 + 3000 * 0.04 + 200 * 8) / 1e6 + // peak flash
  (500 * 1 + 1000 * 0.02 + 100 * 4) / 1e6 + // off-peak flash
  (100 * 2 + 50 * 8) / 1e6 + // fork live event, peak flash
  (2000 * 9 + 8000 * 0.3 + 400 * 27) / 1e6; // pro, peak
assert.ok(Math.abs(body.totals.cost - expected) < 1e-9, 'cost matches the official price table: ' + body.totals.cost);

assert.equal(body.totals.input, 3600);
assert.equal(body.totals.output, 750);
assert.equal(body.totals.cacheRead, 12000);
assert.equal(body.totals.tokenTotal, 3600 + 750 + 12000);
assert.equal(body.totals.unpriced, 0);
assert.equal(body.days.length, 1, 'both instants share one Beijing day');
assert.equal(body.models.length, 2, 'two models');
assert.equal(body.workspaces.length, 2, 'two workspaces');
assert.equal(body.sessions[0].id, 's-sub', 'ranking sorts by token total');
assert.equal(body.sessions.filter((session) => session.subagent).length, 1, 'exactly one delegated child');

const cachePath = process.env.DSH_TOKEN_METER_CACHE;
assert.ok(existsSync(cachePath), 'cache file written');
const saved = JSON.parse(readFileSync(cachePath, 'utf8'));
assert.equal(saved.version, 1);
assert.equal(Object.keys(saved.sessions).length, 3, 'all non-live sessions persisted');

// Range filtering keeps only calls inside the window.
const week = await call('/api/dsh-token-meter/stats?range=7');
assert.equal(week.totals.calls, 0, 'instants 31 days old fall outside a 7 day window');
const quarter = await call('/api/dsh-token-meter/stats?range=90');
assert.equal(quarter.totals.calls, 4, 'the same instants fall inside a 90 day window');

// The ledger lists one row per call, newest first, with facet counts.
const all = await ledger('/api/dsh-token-meter/requests?range=all');
assert.equal(all.body.ok, true);
assert.equal(all.body.rows.length, 4, 'one row per billed call');
assert.equal(all.body.totals.calls, 4);
assert.equal(all.body.totals.tokens, body.totals.tokenTotal);
assert.ok(all.body.rows[0].t >= all.body.rows[1].t, 'newest first');
assert.equal(all.body.facets.agents.length, 3, 'one facet entry per session');
assert.equal(all.body.facets.models.length, 2, 'one facet entry per model');

// A status filter narrows the rows without emptying its own facet list.
const okOnly = await ledger('/api/dsh-token-meter/requests?range=all&status=ok');
assert.equal(okOnly.body.totals.calls, 4);
const interruptedOnly = await ledger('/api/dsh-token-meter/requests?range=all&status=interrupted');
assert.equal(interruptedOnly.body.totals.calls, 0);

// Filters by session and by model reach the same numbers the aggregate proves.
const sub = await ledger('/api/dsh-token-meter/requests?range=all&agent=s-sub');
assert.equal(sub.body.totals.calls, 1);
assert.equal(sub.body.rows[0].model, 'deepseek-v4-pro');
const pro = await ledger('/api/dsh-token-meter/requests?range=all&model=deepseek-account%2Fdeepseek-v4-pro');
assert.equal(pro.body.totals.calls, 1);

// Paging slices the same ordered rows.
const paged = await ledger('/api/dsh-token-meter/requests?range=all&size=10&page=0');
assert.equal(paged.body.pages, 1);
assert.equal(paged.body.size, 10);

// Free text searches session title, model and directory.
const searched = await ledger('/api/dsh-token-meter/requests?range=all&q=beta');
assert.equal(searched.body.totals.calls, 1, 'directory match finds the subagent call');

// CSV export includes every filtered row, not just the page.
const csv = await ledger('/api/dsh-token-meter/requests?range=all&format=csv');
assert.equal(csv.response.headers.get('content-type'), 'text/csv; charset=utf-8');
assert.equal(csv.text.trim().split('\n').length, 5, 'header plus four rows');

// Warm start from the cache: no replay, same totals on the first response.
const warm = await boot();
const warmBody = await warm.call('/api/dsh-token-meter/stats?range=all');
assert.equal(warmBody.phase, 'scanning', 'a warm start still lists sessions first');
let warmReady = warmBody;
for (let attempt = 0; attempt < 60 && warmReady.phase !== 'ready'; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 25));
  warmReady = await warm.call('/api/dsh-token-meter/stats?range=all');
}
assert.equal(warmReady.totals.calls, body.totals.calls, 'cached totals match the live fold');
assert.ok(Math.abs(warmReady.totals.cost - body.totals.cost) < 1e-9, 'cached cost matches');

rmSync(cacheDir, { recursive: true, force: true });
console.log('host.test.mjs: all assertions passed');

/* ------------------------------------------------------------------ facets */

// The ledger's facet lists double as filter dropdowns: each list is counted
// under every other filter but its own, so choosing a value never empties the
// dropdown it came from.
{
  const allFacets = await ledger('/api/dsh-token-meter/requests?range=all');
  assert.ok(allFacets.body.facets.models.length > 0, 'models facet is populated');
  const modelKey = allFacets.body.facets.models[0].key;

  const filtered = await ledger('/api/dsh-token-meter/requests?range=all&model=' + encodeURIComponent(modelKey));
  const expectedKey = (row) => (row.provider || '') + '/' + (row.model || '');
  assert.equal(filtered.body.rows.every((row) => expectedKey(row) === modelKey), true, 'model filter excludes other models');
  assert.equal(filtered.body.facets.models.length, allFacets.body.facets.models.length, 'model facet does not shrink itself');
  assert.ok(filtered.body.facets.agents.length > 0, 'session facet still populated under a model filter');

  const workspaceKey = allFacets.body.facets.workspaces[0].cwd;
  const byWorkspace = await ledger('/api/dsh-token-meter/requests?range=all&workspace=' + encodeURIComponent(workspaceKey));
  assert.equal(byWorkspace.body.facets.workspaces.length, allFacets.body.facets.workspaces.length, 'workspace facet does not shrink itself');
}

/* ------------------------------------------------------------------ rhythm */

{
  const res = await call('/api/dsh-token-meter/stats?range=all');
  assert.equal(res.rhythm.length, 7, 'rhythm has seven weekdays');
  assert.equal(res.rhythm.every((row) => row.length === 24), true, 'rhythm has 24 hours per weekday');

  const dayWithCalls = res.days.find((day) => day.calls > 0);
  assert.ok(dayWithCalls !== undefined, 'a day with calls exists');
  assert.ok(
    Math.abs(dayWithCalls.peakCost + dayWithCalls.offCost - dayWithCalls.cost) < 1e-9,
    'peak and off-peak cost add up to the day total',
  );

  // Every token in the grid also appears in the totals.
  const gridTokens = res.rhythm.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0);
  assert.ok(Math.abs(gridTokens - res.totals.tokenTotal) < 1e-6, 'rhythm covers every token');
}

/* --------------------------------------------------------------- date range */

{
  // "Today" is the Beijing calendar day, not a rolling 24 h window.
  const today = await call('/api/dsh-token-meter/stats?range=1');
  assert.equal(today.days.length <= 1, true, 'today covers at most one calendar day');

  const week = await call('/api/dsh-token-meter/stats?range=7');
  assert.equal(week.days.length <= 7, true, 'seven days covers at most seven calendar days');
  if (week.days.length > 0 && today.days.length > 0) {
    const weekEnd = week.days[week.days.length - 1].date;
    const todayEnd = today.days[today.days.length - 1].date;
    assert.equal(weekEnd <= todayEnd, true, 'week never extends past today');
  }

  const month = await call('/api/dsh-token-meter/stats?range=30');
  assert.equal(month.days.length <= 30, true, 'thirty days covers at most thirty calendar days');

  // A narrower range can never report more than a wider one.
  assert.ok(week.totals.calls <= month.totals.calls, 'week is a subset of the month');
  assert.ok(today.totals.calls <= week.totals.calls, 'today is a subset of the week');

  // The model series follows the same window.
  if (today.modelSeries.length > 0) {
    assert.equal(today.modelSeries[0].series.length, today.days.length, 'model series tracks the ranged axis');
  }
}

/* ------------------------------------------------------------ model series */

{
  const res = await call('/api/dsh-token-meter/stats?range=all');
  assert.ok(Array.isArray(res.modelSeries), 'modelSeries is present');
  assert.ok(res.modelSeries.length > 0, 'modelSeries has entries');
  assert.ok(res.modelSeries.length <= 8, 'modelSeries is capped');

  for (const row of res.modelSeries) {
    assert.equal(row.series.length, res.days.length, 'series aligns with the day axis');
    assert.equal(row.costSeries.length, res.days.length, 'cost series aligns with the day axis');
    assert.equal(row.callsSeries.length, res.days.length, 'calls series aligns with the day axis');
    const total = row.series.reduce((sum, value) => sum + value, 0);
    assert.ok(Math.abs(total - row.tokenTotal) < 1e-6, 'series sums to the row total');
  }

  // Gateway routing prefixes collapse onto the bare model name.
  assert.equal(
    res.modelSeries.some((row) => row.key.includes(':') && !row.key.includes('/')),
    false,
    'routing prefixes are stripped from model keys',
  );
  const withVariants = res.modelSeries.find((row) => Array.isArray(row.variants) && row.variants.length > 1);
  if (withVariants !== undefined) {
    assert.ok(withVariants.variants.length >= 2, 'raw variants are kept for the tooltip');
  }
}

/* ----------------------------------------------------------------- sorting */

{
  const byCost = await ledger('/api/dsh-token-meter/requests?range=all&sort=cost&dir=desc');
  const costs = byCost.body.rows.map((row) => (row.cost === null ? -1 : row.cost));
  assert.deepEqual(costs, costs.slice().sort((left, right) => right - left), 'cost sort is descending');

  const byPrompt = await ledger('/api/dsh-token-meter/requests?range=all&sort=ctx&dir=desc');
  const prompts = byPrompt.body.rows.map((row) => row.prompt);
  assert.deepEqual(prompts, prompts.slice().sort((a, b) => b - a), 'prompt sort is descending');

  // `prompt` is the full context billed: input plus both cache movements.
  for (const row of byPrompt.body.rows) {
    assert.equal(row.prompt, row.input + row.cacheRead + row.cacheWrite, 'prompt is input + cache read + cache write');
  }
}

console.log('host.test.mjs: facet, rhythm, model-series and sort assertions passed');
process.exit(0);

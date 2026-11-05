/**
 * Host half of the DSH token-usage dashboard.
 *
 * The session log is the only source of truth: every `assistant/message` event
 * carries an authoritative `usage` block plus provider/model identity. This half
 * folds every logical session into one dataset, prices it with the official
 * DeepSeek list price table, and serves it to the Client panel over an
 * authenticated same-origin Fetch route.
 *
 * Aggregates are cached in process memory per session id and mirrored to one
 * JSON file, so a restart does not pay for a full replay of the whole corpus.
 * Persisted session logs never change; live sessions are re-read in the
 * background, and a session still live at save time is never persisted.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** Route prefix owned by this plugin on the Host connection's Fetch surface. */
const ROUTE = '/api/dsh-token-meter';
const STATS_PATH = ROUTE + '/stats';
const REQUESTS_PATH = ROUTE + '/requests';
const PACKAGE_NAME = '@local/dsh-token-meter';

/** Fold cache shared across restarts; live sessions are never written to it. */
const CACHE_VERSION = 1;
const CACHE_FILE =
  process.env.DSH_TOKEN_METER_CACHE || join(homedir(), '.dsh', 'cache', 'dsh-token-meter', 'sessions.json');
const CACHE_MAX_BYTES = 24 * 1024 * 1024;

/** Context window advertised by the current DeepSeek API models. */
const CONTEXT_WINDOW = 1_000_000;

/**
 * Official DeepSeek list prices in CNY per 1M tokens.
 * Source: https://api-docs.deepseek.com/zh-cn/quick_start/pricing
 *
 * Peak hours are Beijing time 09:00-12:00 and 14:00-18:00 on weekdays; every
 * other hour (including weekends) is off-peak at half the peak rate. Chinese
 * public holidays are off-peak for DeepSeek but are NOT modelled here, so a
 * holiday weekday is priced at peak rates: a small overestimate.
 */
const TIERS = {
  flash: {
    id: 'flash',
    label: 'deepseek-flash',
    hit: { off: 0.02, peak: 0.04 },
    miss: { off: 1, peak: 2 },
    output: { off: 4, peak: 8 },
  },
  pro: {
    id: 'pro',
    label: 'deepseek-v4-pro',
    hit: { off: 0.15, peak: 0.3 },
    miss: { off: 4.5, peak: 9 },
    output: { off: 13.5, peak: 27 },
  },
};

const BEIJING_OFFSET = 8 * 60 * 60 * 1000;

const RANGES = new Set(['all', '1', '7', '30', '90', '365']);

/** Whether a wall-clock instant falls in a DeepSeek peak pricing window. */
function isPeak(time) {
  const shifted = new Date(time + BEIJING_OFFSET);
  const weekday = shifted.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  const hour = shifted.getUTCHours();
  return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18);
}

/** Map a provider model name onto the official price tier, or null when unknown. */
function tierOf(model) {
  const name = String(model === undefined || model === null ? '' : model).toLowerCase();
  if (name === '') return null;
  if (name.includes('v4-pro') || name.includes('reasoner') || /(^|[-/])pro($|[-/])/.test(name)) return 'pro';
  if (name.includes('flash') || name.includes('chat') || name.includes('v3')) return 'flash';
  return null;
}

/** Strip gateway routing prefixes (`cn:`, `wb:cn:`, …) off a model name. */
function bareModel(model) {
  if (model === undefined || model === null) return '—';
  const text = String(model);
  const colon = text.lastIndexOf(':');
  return colon < 0 ? text : text.slice(colon + 1);
}

function pad(value) {
  return value < 10 ? '0' + value : String(value);
}

/** Beijing-calendar day key for a wall-clock instant. */
function dayKey(time) {
  const shifted = new Date(time + BEIJING_OFFSET);
  return shifted.getUTCFullYear() + '-' + pad(shifted.getUTCMonth() + 1) + '-' + pad(shifted.getUTCDate());
}

function toCount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/** First non-empty text block of a durable user message, for a session label. */
function firstUserText(data) {
  const content = data && Array.isArray(data.content) ? data.content : [];
  for (const block of content) {
    if (block && block.type === 'text' && typeof block.text === 'string') {
      const line = block.text.replace(/\s+/g, ' ').trim();
      if (line !== '') return line.length > 96 ? line.slice(0, 96) + '…' : line;
    }
  }
  return null;
}

/** Price one usage record; `cost` is null when the model has no known tier. */
function priceRecord(input, output, cacheRead, cacheWrite, model, time) {
  const tier = tierOf(model);
  if (tier === null) return { tier: null, peak: false, cost: null, saved: null };
  const table = TIERS[tier];
  const peak = isPeak(time);
  const band = peak ? 'peak' : 'off';
  const cost =
    (input * table.miss[band] + cacheWrite * table.miss[band] + cacheRead * table.hit[band] + output * table.output[band]) /
    1e6;
  const saved = (cacheRead * (table.miss[band] - table.hit[band])) / 1e6;
  return { tier, peak, cost, saved };
}

/** Fold one replayed session log into per-call usage records. */
function extractSession(snapshot, record) {
  const header = snapshot.session || (record && record.header) || {};
  const events = Array.isArray(snapshot.events) ? snapshot.events : [];
  // A seeded (forked) log replays its inherited prefix first; counting it again
  // would bill the parent's usage into the child.
  const start = Math.max(0, Number(snapshot.inheritedEventCount) || 0);
  const calls = [];
  let title = null;
  let provider = null;
  let model = null;
  for (let index = start; index < events.length; index += 1) {
    const event = events[index];
    if (!event || typeof event.type !== 'string') continue;
    if (title === null && event.type === 'user/message') {
      title = firstUserText(event.data);
      continue;
    }
    if (event.type !== 'assistant/message') continue;
    const data = event.data;
    const usage = data && data.usage;
    if (!usage) continue;
    const source = (data.message && data.message.source) || {};
    const callModel = typeof source.model === 'string' ? source.model : null;
    const callProvider = typeof source.provider === 'string' ? source.provider : null;
    if (callModel !== null) model = callModel;
    if (callProvider !== null) provider = callProvider;
    const input = toCount(usage.inputTokens);
    const output = toCount(usage.outputTokens);
    const cacheRead = toCount(usage.cacheReadTokens);
    const cacheWrite = toCount(usage.cacheWriteTokens);
    const reasoning = toCount(usage.reasoningTokens);
    const time = typeof event.time === 'number' ? event.time : header.createdAt || 0;
    const priced = priceRecord(input, output, cacheRead, cacheWrite, callModel, time);
    calls.push({
      time,
      day: dayKey(time),
      provider: callProvider,
      model: callModel,
      turn: typeof data.turn === 'number' ? data.turn : null,
      step: typeof data.step === 'number' ? data.step : null,
      interrupted: data.interrupted === true,
      input,
      output,
      cacheRead,
      cacheWrite,
      reasoning,
      tier: priced.tier,
      peak: priced.peak,
      cost: priced.cost,
      saved: priced.saved,
    });
  }
  const parentId = header.parentSession === undefined ? null : header.parentSession;
  return {
    id: String(header.id),
    header,
    live: Boolean(record && record.live),
    cwd: typeof header.cwd === 'string' ? header.cwd : null,
    createdAt: typeof header.createdAt === 'number' ? header.createdAt : 0,
    parent: parentId === null ? null : String(parentId),
    // A user fork also carries a parent; only `origin` marks a delegated child.
    subagent: header.origin === 'subagent',
    agentPreset: typeof header.agentPreset === 'string' ? header.agentPreset : null,
    title,
    provider,
    model,
    calls,
  };
}

/** Resolve one aggregate bucket, creating it on demand. */
function bucket(map, key) {
  let entry = map.get(key);
  if (entry === undefined) {
    entry = {
      key,
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      reasoning: 0,
      calls: 0,
      cost: 0,
      saved: 0,
      priced: 0,
      unpriced: 0,
      first: Infinity,
      last: 0,
    };
    map.set(key, entry);
  }
  return entry;
}

function addUsage(target, call) {
  target.input += call.input;
  target.output += call.output;
  target.cacheRead += call.cacheRead;
  target.cacheWrite += call.cacheWrite;
  target.reasoning += call.reasoning;
  target.calls += 1;
  if (call.cost === null) target.unpriced += 1;
  else {
    target.cost += call.cost;
    target.saved += call.saved === null ? 0 : call.saved;
    target.priced += 1;
  }
  if (call.time < target.first) target.first = call.time;
  if (call.time > target.last) target.last = call.time;
}

function emptyTotals() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
    calls: 0,
    cost: 0,
    saved: 0,
    priced: 0,
    unpriced: 0,
    first: 0,
    last: 0,
  };
}

/**
 * Start of the range window, as a wall-clock instant.
 *
 * `1` means today in Beijing time (from local midnight, not a rolling 24 h), and
 * `N` days back means those N calendar days including today. A rolling window
 * would make "today" straddle yesterday evening, which reads as a bug.
 */
function rangeStart(range) {
  if (range === 'all') return 0;
  const days = Math.max(1, Number(range) || 1);
  const nowShifted = new Date(Date.now() + BEIJING_OFFSET);
  const midnightShifted = Date.UTC(
    nowShifted.getUTCFullYear(),
    nowShifted.getUTCMonth(),
    nowShifted.getUTCDate(),
  );
  return midnightShifted - BEIJING_OFFSET - (days - 1) * 24 * 60 * 60 * 1000;
}

/** Beijing-calendar hour of a wall-clock instant, 0-23. */
function hourOf(time) {
  return new Date(time + BEIJING_OFFSET).getUTCHours();
}

/** Monday-first weekday index of a Beijing-calendar instant: Monday 0 … Sunday 6. */
function weekdayOf(time) {
  return (new Date(time + BEIJING_OFFSET).getUTCDay() + 6) % 7;
}

/** Compute the dashboard payload for one time range. */
function aggregate(engine, range) {
  const since = rangeStart(range);
  const totals = emptyTotals();
  const days = new Map();
  const models = new Map();
  const providers = new Map();
  const hours = new Map();
  const peaks = new Map();
  const workspaces = new Map();
  // Cost split per day, so the trend can show how much of each day was billed
  // at peak rates. Kept beside `days` instead of inside it: `addUsage` sizes the
  // shared bucket shape and these two are the only peak-specific series.
  const dayPeakCost = new Map();
  const dayOffCost = new Map();
  // Weekday × hour token totals (Monday first) for the usage-rhythm grid.
  const rhythm = Array.from({ length: 7 }, () => new Array(24).fill(0));
  // Per-day usage per model, for the multi-series model trend. Keyed by
  // `provider/model` with the same label the model ranking uses.
  const modelDays = new Map();
  const sessions = [];
  let scannedSessions = 0;
  let emptySessions = 0;
  let subagentSessions = 0;
  let firstCallAt = 0;
  let lastCallAt = 0;
  let subagentCalls = 0;
  let subagentTokens = 0;

  for (const entry of engine.cache.values()) {
    let used = 0;
    let sessionCost = 0;
    let sessionSaved = 0;
    let sessionCalls = 0;
    let sessionInput = 0;
    let sessionOutput = 0;
    let sessionCacheRead = 0;
    let sessionCacheWrite = 0;
    let lastActivity = entry.createdAt;
    const modelsOf = new Set();

    for (const call of entry.calls) {
      if (call.time < since) continue;
      used += 1;
      addUsage(totals, call);
      addUsage(bucket(days, call.day), call);
      addUsage(bucket(models, call.provider === null ? String(call.model) : call.provider + '/' + String(call.model)), call);
      addUsage(bucket(providers, call.provider === null ? '—' : call.provider), call);
      addUsage(bucket(hours, String(hourOf(call.time))), call);
      addUsage(bucket(peaks, call.peak ? 'peak' : 'off'), call);
      if (call.cost !== null) {
        const costMap = call.peak ? dayPeakCost : dayOffCost;
        costMap.set(call.day, (costMap.get(call.day) || 0) + call.cost);
      }
      rhythm[weekdayOf(call.time)][hourOf(call.time)] += call.input + call.output + call.cacheRead + call.cacheWrite;

      // Grouped by bare model name: gateways prefix the same model with routing
      // tags (`cn:`, `wb:cn:`, `global:`), so the last colon segment is the model
      // itself. The raw names and the provider split stay in the tooltip.
      const modelDayKey = bareModel(call.model);
      let modelSeries = modelDays.get(modelDayKey);
      if (modelSeries === undefined) {
        modelSeries = {
          key: modelDayKey,
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0,
          calls: 0,
          days: new Map(),
          providers: new Map(),
          variants: new Map(),
        };
        modelDays.set(modelDayKey, modelSeries);
      }
      const providerKey = call.provider === null ? '—' : call.provider;
      const rawName = String(call.model === null ? '—' : call.model);
      const variantRow = modelSeries.variants.get(rawName) || { key: rawName, calls: 0, tokens: 0 };
      variantRow.calls += 1;
      variantRow.tokens += call.input + call.output + call.cacheRead + call.cacheWrite;
      modelSeries.variants.set(rawName, variantRow);
      const providerRow = modelSeries.providers.get(providerKey) || { key: providerKey, calls: 0, tokens: 0 };
      providerRow.calls += 1;
      providerRow.tokens += call.input + call.output + call.cacheRead + call.cacheWrite;
      modelSeries.providers.set(providerKey, providerRow);
      let modelDay = modelSeries.days.get(call.day);
      if (modelDay === undefined) {
        modelDay = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, calls: 0 };
        modelSeries.days.set(call.day, modelDay);
      }
      modelDay.input += call.input;
      modelDay.output += call.output;
      modelDay.cacheRead += call.cacheRead;
      modelDay.cacheWrite += call.cacheWrite;
      modelDay.calls += 1;
      if (call.cost !== null) modelDay.cost += call.cost;
      modelSeries.input += call.input;
      modelSeries.output += call.output;
      modelSeries.cacheRead += call.cacheRead;
      modelSeries.cacheWrite += call.cacheWrite;
      modelSeries.calls += 1;
      if (call.cost !== null) modelSeries.cost += call.cost;
      if (entry.cwd !== null) addUsage(bucket(workspaces, entry.cwd), call);
      sessionCalls += 1;
      sessionInput += call.input;
      sessionOutput += call.output;
      sessionCacheRead += call.cacheRead;
      sessionCacheWrite += call.cacheWrite;
      sessionCost += call.cost === null ? 0 : call.cost;
      sessionSaved += call.saved === null ? 0 : call.saved;
      if (call.time > lastActivity) lastActivity = call.time;
      if (call.time > lastCallAt) lastCallAt = call.time;
      if (firstCallAt === 0 || call.time < firstCallAt) firstCallAt = call.time;
      if (call.model !== null) modelsOf.add(call.model);
    }

    scannedSessions += 1;
    if (entry.subagent) subagentSessions += 1;
    if (used === 0) {
      emptySessions += 1;
      continue;
    }
    if (entry.subagent) {
      subagentCalls += sessionCalls;
      subagentTokens += sessionInput + sessionOutput + sessionCacheRead + sessionCacheWrite;
    }
    sessions.push({
      id: entry.id,
      title: entry.title,
      cwd: entry.cwd,
      createdAt: entry.createdAt,
      lastActivity,
      subagent: entry.subagent,
      parent: entry.parent,
      agentPreset: entry.agentPreset,
      models: Array.from(modelsOf),
      calls: sessionCalls,
      input: sessionInput,
      output: sessionOutput,
      cacheRead: sessionCacheRead,
      cacheWrite: sessionCacheWrite,
      cost: sessionCost,
      saved: sessionSaved,
    });
  }

  sessions.sort((left, right) => right.input + right.output + right.cacheRead + right.cacheWrite - (left.input + left.output + left.cacheRead + left.cacheWrite));

  const modelRows = Array.from(models.values())
    .map((row) => ({
      key: row.key,
      calls: row.calls,
      input: row.input,
      output: row.output,
      cacheRead: row.cacheRead,
      cacheWrite: row.cacheWrite,
      cost: row.cost,
      tokenTotal: row.input + row.output + row.cacheRead + row.cacheWrite,
    }))
    .sort((left, right) => right.tokenTotal - left.tokenTotal);

  const workspaceRows = Array.from(workspaces.values())
    .map((row) => ({
      cwd: row.key,
      calls: row.calls,
      input: row.input,
      output: row.output,
      cacheRead: row.cacheRead,
      cacheWrite: row.cacheWrite,
      cost: row.cost,
      tokenTotal: row.input + row.output + row.cacheRead + row.cacheWrite,
      sessions: sessions.filter((session) => session.cwd === row.key).length,
    }))
    .sort((left, right) => right.tokenTotal - left.tokenTotal);

  const dayRows = Array.from(days.values())
    .map((row) => ({
      date: row.key,
      input: row.input,
      output: row.output,
      cacheRead: row.cacheRead,
      cacheWrite: row.cacheWrite,
      calls: row.calls,
      cost: row.cost,
      peakCost: dayPeakCost.get(row.key) || 0,
      offCost: dayOffCost.get(row.key) || 0,
      tokenTotal: row.input + row.output + row.cacheRead + row.cacheWrite,
    }))
    .sort((left, right) => (left.date < right.date ? -1 : left.date > right.date ? 1 : 0));

  // Dense per-model series aligned to `dayRows`, so the Client can plot several
  // models without re-deriving a date axis. The whole list is sent (bounded, a
  // profile cannot use hundreds of models in one range) because the panel offers
  // an explicit model picker; the chart itself defaults to the busiest few.
  const modelSeries = Array.from(modelDays.values())
    .sort((left, right) => right.input + right.output + right.cacheRead + right.cacheWrite - (left.input + left.output + left.cacheRead + left.cacheWrite))
    .slice(0, 40)
    .map((row) => ({
      key: row.key,
      calls: row.calls,
      cost: row.cost,
      tokenTotal: row.input + row.output + row.cacheRead + row.cacheWrite,
      series: dayRows.map((day) => {
        const bucketForDay = row.days.get(day.date);
        if (bucketForDay === undefined) return 0;
        return bucketForDay.input + bucketForDay.output + bucketForDay.cacheRead + bucketForDay.cacheWrite;
      }),
      costSeries: dayRows.map((day) => {
        const bucketForDay = row.days.get(day.date);
        return bucketForDay === undefined ? 0 : bucketForDay.cost;
      }),
      callsSeries: dayRows.map((day) => {
        const bucketForDay = row.days.get(day.date);
        return bucketForDay === undefined ? 0 : bucketForDay.calls;
      }),
      providers: Array.from(row.providers.values())
        .sort((left, right) => right.tokens - left.tokens)
        .slice(0, 4),
      variants: Array.from(row.variants.values())
        .sort((left, right) => right.tokens - left.tokens)
        .map((variant) => variant.key),
    }));

  const tokenTotal = totals.input + totals.output + totals.cacheRead + totals.cacheWrite;
  const promptTotal = totals.input + totals.cacheRead + totals.cacheWrite;
  const hitRate = promptTotal === 0 ? 0 : totals.cacheRead / promptTotal;

  const shape = (row) => ({
    input: row.input,
    output: row.output,
    cacheRead: row.cacheRead,
    cacheWrite: row.cacheWrite,
    calls: row.calls,
    cost: row.cost,
    saved: row.saved,
    tokenTotal: row.input + row.output + row.cacheRead + row.cacheWrite,
    hitRate: row.input + row.cacheRead + row.cacheWrite === 0 ? 0 : row.cacheRead / (row.input + row.cacheRead + row.cacheWrite),
  });

  const providerRows = Array.from(providers.values())
    .map((row) => ({ key: row.key, ...shape(row) }))
    .sort((left, right) => right.tokenTotal - left.tokenTotal);

  // Every hour of the day is present so the distribution never collapses to a
  // partial axis when the profile only used a few of them.
  const hourRows = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const row = hours.get(String(hour));
    hourRows.push({
      hour,
      ...(row === undefined
        ? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0, cost: 0, saved: 0, tokenTotal: 0, hitRate: 0 }
        : shape(row)),
    });
  }

  const peakRow = peaks.get('peak');
  const offRow = peaks.get('off');
  const peaksPayload = {
    peak: peakRow === undefined ? 0 : peakRow.input + peakRow.output + peakRow.cacheRead + peakRow.cacheWrite,
    off: offRow === undefined ? 0 : offRow.input + offRow.output + offRow.cacheRead + offRow.cacheWrite,
    peakCost: peakRow === undefined ? 0 : peakRow.cost,
    offCost: offRow === undefined ? 0 : offRow.cost,
    peakCalls: peakRow === undefined ? 0 : peakRow.calls,
    offCalls: offRow === undefined ? 0 : offRow.calls,
  };

  return {
    ok: true,
    generatedAt: Date.now(),
    phase: engine.state.phase,
    progress: {
      scanned: engine.state.scanned,
      total: engine.state.total,
      failed: engine.state.failed,
      startedAt: engine.state.startedAt,
      finishedAt: engine.state.finishedAt,
      error: engine.state.error,
    },
    range,
    totals: {
      ...totals,
      tokenTotal,
      hitRate,
      calls: totals.calls,
      subagentCalls,
      subagentTokens,
      sessions: sessions.length,
      emptySessions,
      subagentSessions,
      firstCallAt,
      lastCallAt,
    },
    days: dayRows,
    rhythm,
    modelSeries,
    models: modelRows,
    providers: providerRows,
    hours: hourRows,
    peaks: peaksPayload,
    workspaces: workspaceRows.slice(0, 40),
    sessions: sessions.slice(0, 400),
    pricing: {
      currency: 'CNY',
      contextWindow: CONTEXT_WINDOW,
      tiers: TIERS,
      peakWindow: 'weekday 09:00-12:00, 14:00-18:00 Asia/Shanghai',
    },
  };
}

/**
 * Host plugin: register the statistics routes on the connection's Fetch surface.
 * @param ctx - the plugin's Cordis context.
 */
export function apply(ctx) {
  const engine = {
    cache: new Map(),
    listing: null,
    listingAt: 0,
    scanning: null,
    liveRefreshAt: 0,
    saveTimer: null,
    state: { phase: 'idle', startedAt: 0, finishedAt: 0, scanned: 0, total: 0, failed: 0, error: null },
  };

  const saveCache = () => {
    if (engine.saveTimer !== null) {
      clearTimeout(engine.saveTimer);
      engine.saveTimer = null;
    }
    try {
      const sessions = {};
      for (const [id, entry] of engine.cache) {
        // A live session's fold is provisional; it is re-read on the next boot.
        if (entry.live) continue;
        sessions[id] = entry;
      }
      const payload = JSON.stringify({ version: CACHE_VERSION, savedAt: Date.now(), sessions: sessions });
      if (payload.length > CACHE_MAX_BYTES) return;
      mkdirSync(dirname(CACHE_FILE), { recursive: true });
      writeFileSync(CACHE_FILE, payload, 'utf8');
    } catch (error) {
      // A missing or unwritable cache only costs a slower first scan.
    }
  };

  const scheduleSave = () => {
    if (engine.saveTimer !== null) return;
    engine.saveTimer = setTimeout(() => {
      engine.saveTimer = null;
      saveCache();
    }, 5000);
  };

  const loadCache = () => {
    try {
      const data = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
      if (data.version !== CACHE_VERSION || typeof data.sessions !== 'object' || data.sessions === null) return;
      for (const id of Object.keys(data.sessions)) {
        const entry = data.sessions[id];
        if (entry === null || typeof entry !== 'object' || !Array.isArray(entry.calls)) continue;
        engine.cache.set(id, { ...entry, live: false });
      }
    } catch (error) {
      // No usable cache is the normal first-run path.
    }
  };

  loadCache();

  const query = () => {
    const service = ctx.get('sessionQuery');
    if (service === undefined || service === null) throw new Error('sessionQuery is not available in this profile');
    return service;
  };

  const scan = async (list) => {
    let cursor = 0;
    const worker = async () => {
      while (cursor < list.length) {
        const record = list[cursor];
        cursor += 1;
        const id = String(record.header.id);
        try {
          const snapshot = await query().readSession(id);
          const entry = extractSession(snapshot, record);
          engine.cache.set(id, entry);
          engine.state.scanned += 1;
        } catch (error) {
          engine.state.failed += 1;
        }
      }
    };
    const width = Math.min(5, Math.max(1, list.length));
    await Promise.all(Array.from({ length: width }, worker));
    engine.state.phase = 'ready';
    engine.state.finishedAt = Date.now();
    saveCache();
  };

  const refreshLive = async () => {
    const now = Date.now();
    if (now - engine.liveRefreshAt < 4000) return;
    engine.liveRefreshAt = now;
    const live = [];
    for (const entry of engine.cache.values()) if (entry.live) live.push(entry);
    if (live.length === 0) return;
    // Only the newest few live sessions can have new usage; re-reading every live
    // agent on each request would multiply the scan cost for no visible gain.
    live.sort((left, right) => right.createdAt - left.createdAt);
    const targets = live.slice(0, 4).map((entry) => entry.id);
    let cursor = 0;
    const worker = async () => {
      while (cursor < targets.length) {
        const id = targets[cursor];
        cursor += 1;
        try {
          const snapshot = await query().readSession(id);
          engine.cache.set(id, extractSession(snapshot, { header: snapshot.session, live: true }));
        } catch (error) {
          // A live session that vanished keeps its last fold.
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, targets.length) }, worker));
    scheduleSave();
  };

  const ensureScan = async (force) => {
    const now = Date.now();
    if (engine.scanning !== null) return engine.scanning;
    const records = await query().listSessions();
    engine.listing = records;
    engine.listingAt = now;
    const missing = force ? records.slice() : records.filter((record) => !engine.cache.has(String(record.header.id)));
    for (const record of records) {
      const id = String(record.header.id);
      const entry = engine.cache.get(id);
      if (entry !== undefined) entry.live = Boolean(record.live);
    }
    if (missing.length === 0) {
      engine.state.phase = 'ready';
      engine.state.scanned = records.length;
      engine.state.total = records.length;
      engine.state.finishedAt = engine.state.finishedAt === 0 ? now : engine.state.finishedAt;
      return;
    }
    engine.state.phase = 'scanning';
    engine.state.total = missing.length;
    engine.state.scanned = 0;
    engine.state.failed = 0;
    if (engine.state.startedAt === 0) engine.state.startedAt = now;
    engine.scanning = scan(missing).finally(() => {
      engine.scanning = null;
    });
    return engine.scanning;
  };

  const startIfNeeded = (force) => {
    if (engine.scanning !== null) return;
    const needsScan = force || engine.cache.size === 0 || engine.state.phase !== 'ready';
    if (!needsScan) {
      refreshLive().catch(() => {});
      return;
    }
    // Report the scan synchronously so the panel can show progress from its very
    // first response, even when a warm cache makes the listing the only wait.
    if (engine.state.phase !== 'scanning') {
      engine.state = {
        phase: 'scanning',
        startedAt: engine.state.startedAt === 0 ? Date.now() : engine.state.startedAt,
        finishedAt: 0,
        scanned: 0,
        total: engine.state.total === undefined ? 0 : engine.state.total,
        failed: 0,
        error: null,
      };
    }
    ensureScan(force).catch((error) => {
      engine.state.phase = 'error';
      engine.state.error = error instanceof Error ? error.message : String(error);
    });
  };

  const json = (body, status) =>
    new Response(JSON.stringify(body), {
      status: status === undefined ? 200 : status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });

  const stats = (request) => {
    const url = new URL(request.url);
    const raw = url.searchParams.get('range');
    const range = raw !== null && RANGES.has(raw) ? raw : 'all';
    const force = url.searchParams.get('force') === '1';
    startIfNeeded(force);
    try {
      return json(aggregate(engine, range));
    } catch (error) {
      return json({ ok: false, message: error instanceof Error ? error.message : String(error) }, 500);
    }
  };

  /**
   * The request ledger: one row per model call, newest first, filtered and paged
   * on the Host so the panel never ships the whole corpus to the browser.
   */
  const requests = (request) => {
    const url = new URL(request.url);
    const pick = (name) => {
      const value = url.searchParams.get(name);
      return value === null || value === '' ? null : value;
    };
    const rawRange = pick('range');
    const range = rawRange !== null && RANGES.has(rawRange) ? rawRange : 'all';
    const since = rangeStart(range);
    const status = pick('status'); // all | ok | interrupted | unpriced
    const query = (pick('q') || '').toLowerCase();
    const agent = pick('agent'); // session id
    const model = pick('model');
    const workspace = pick('workspace');
    const sort = pick('sort') || 'time';
    const dir = pick('dir') === 'asc' ? 1 : -1;
    const pageSize = Math.min(200, Math.max(10, Number(pick('size')) || 50));
    const page = Math.max(0, Number(pick('page')) || 0);

    const rows = [];
    const agents = new Map();
    const models = new Map();
    const workspaces = new Map();

    for (const entry of engine.cache.values()) {
      for (const call of entry.calls) {
        if (call.time < since) continue;
        const priced = call.cost !== null;
        const failed = call.interrupted === true;
        const modelKey = (call.provider || '') + '/' + (call.model || '');
        const matchesStatus =
          status === null || status === 'all' || (status === 'unpriced' ? !priced : status === 'interrupted' ? failed : !failed);
        const matchesSearch =
          query === '' ||
          (
            (call.model || '') +
            ' ' +
            (call.provider || '') +
            ' ' +
            (entry.title || '') +
            ' ' +
            (entry.cwd || '') +
            ' ' +
            entry.id
          )
            .toLowerCase()
            .includes(query);
        const tokens = call.input + call.output + call.cacheRead + call.cacheWrite;

        const matchesAgent = agent === null || entry.id === agent;
        const matchesModel = model === null || modelKey === model;
        const matchesWorkspace = workspace === null || entry.cwd === workspace;

        // Every facet is counted under all the *other* filters but not its own,
        // so picking a value never empties the dropdown it came from.
        if (matchesStatus && matchesSearch) {
          if (matchesModel && matchesWorkspace) {
            const seen = agents.get(entry.id) || { id: entry.id, label: entry.title || entry.id, calls: 0, tokens: 0 };
            seen.calls += 1;
            seen.tokens += tokens;
            agents.set(entry.id, seen);
          }
          if (matchesAgent && matchesWorkspace) {
            const seen = models.get(modelKey) || { key: modelKey, calls: 0, tokens: 0 };
            seen.calls += 1;
            seen.tokens += tokens;
            models.set(modelKey, seen);
          }
          if (matchesAgent && matchesModel) {
            const key = entry.cwd === null ? '' : entry.cwd;
            const seen = workspaces.get(key) || { cwd: key, calls: 0, tokens: 0 };
            seen.calls += 1;
            seen.tokens += tokens;
            workspaces.set(key, seen);
          }
        }

        if (!matchesStatus || !matchesSearch || !matchesAgent || !matchesModel || !matchesWorkspace) continue;
        rows.push({
          id: entry.id + ':' + call.time + ':' + call.turn + ':' + call.step,
          t: call.time,
          session: entry.id,
          title: entry.title,
          cwd: entry.cwd,
          subagent: entry.subagent,
          provider: call.provider,
          model: call.model,
          turn: call.turn,
          step: call.step,
          input: call.input,
          output: call.output,
          cacheRead: call.cacheRead,
          cacheWrite: call.cacheWrite,
          reasoning: call.reasoning,
          prompt: call.input + call.cacheRead + call.cacheWrite,
          total: call.input + call.output + call.cacheRead + call.cacheWrite,
          cost: call.cost,
          peak: call.peak,
          interrupted: call.interrupted,
        });
      }
    }

    const weight = (row) => {
      if (sort === 'cost') return row.cost === null ? -1 : row.cost;
      if (sort === 'tokens') return row.total;
      if (sort === 'input') return row.input;
      if (sort === 'output') return row.output;
      if (sort === 'cache') return row.cacheRead;
      if (sort === 'ctx') return row.prompt;
      if (sort === 'model') return String(row.model || '').toLowerCase();
      return row.t;
    };
    rows.sort((left, right) => {
      const a = weight(left);
      const b = weight(right);
      if (a === b) return right.t - left.t;
      return a < b ? -dir : dir;
    });

    const totals = { calls: rows.length, tokens: 0, cost: 0, unpriced: 0 };
    for (const row of rows) {
      totals.tokens += row.total;
      totals.cost += row.cost === null ? 0 : row.cost;
      if (row.cost === null) totals.unpriced += 1;
    }

    const start = page * pageSize;
    if (pick('format') === 'csv') {
      const header = [
        'time',
        'session',
        'title',
        'cwd',
        'subagent',
        'provider',
        'model',
        'input',
        'output',
        'cacheRead',
        'cacheWrite',
        'total',
        'costCny',
        'peak',
        'interrupted',
      ];
      const cell = (value) => {
        const text = value === null || value === undefined ? '' : String(value);
        return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
      };
      const lines = [header.join(',')];
      for (const row of rows) {
        lines.push(
          [
            new Date(row.t).toISOString(),
            row.session,
            row.title === null ? '' : row.title,
            row.cwd === null ? '' : row.cwd,
            row.subagent ? '1' : '0',
            row.provider === null ? '' : row.provider,
            row.model === null ? '' : row.model,
            row.input,
            row.output,
            row.cacheRead,
            row.cacheWrite,
            row.total,
            row.cost === null ? '' : row.cost.toFixed(6),
            row.peak ? '1' : '0',
            row.interrupted ? '1' : '0',
          ]
            .map(cell)
            .join(','),
        );
      }
      return new Response('\ufeff' + lines.join('\n'), {
        status: 200,
        headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    return {
      ok: true,
      phase: engine.state.phase,
      progress: {
        scanned: engine.state.scanned,
        total: engine.state.total,
        failed: engine.state.failed,
      },
      range,
      page,
      size: pageSize,
      pages: Math.max(1, Math.ceil(rows.length / pageSize)),
      totals,
      rows: rows.slice(start, start + pageSize),
      facets: {
        agents: Array.from(agents.values()).sort((left, right) => right.tokens - left.tokens).slice(0, 60),
        models: Array.from(models.values()).sort((left, right) => right.tokens - left.tokens).slice(0, 60),
        workspaces: Array.from(workspaces.values()).sort((left, right) => right.tokens - left.tokens).slice(0, 60),
      },
    };
  };

  ctx.inject(['connection'], (scope) => {
    scope.effect(() => {
      const disposers = [
        scope.connection.fetch.register({
          path: REQUESTS_PATH,
          methods: ['GET'],
          requestBody: 'buffered',
          fetch: async (request) => {
            try {
              if (engine.state.phase !== 'ready' && engine.scanning === null) startIfNeeded(false);
              const result = requests(request);
              return result instanceof Response ? result : json(result);
            } catch (error) {
              return json({ ok: false, message: error instanceof Error ? error.message : String(error) }, 500);
            }
          },
        }),
        scope.connection.fetch.register({
          path: STATS_PATH,
          methods: ['GET'],
          requestBody: 'buffered',
          fetch: async (request) => {
            try {
              return stats(request);
            } catch (error) {
              return json({ ok: false, message: error instanceof Error ? error.message : String(error) }, 500);
            }
          },
        }),
      ];
      return () => {
        for (const dispose of disposers) void dispose();
      };
    }, 'token-meter: routes');
  });

  // A bundle inserted while the app runs can miss the browser-graph activation
  // pass: the Loader marks the row dirty before its fiber exists, the flush then
  // finds nothing, and the package never enters the boot graph, so its Client
  // half would only appear after a restart. Re-marking the row dirty once the
  // fiber is live repairs that race; it is a no-op when the row is already
  // composed, and it never changes what the Host half does.
  try {
    const nudge = () => {
      try {
        const modules = ctx.get('clientModules');
        if (modules === undefined || modules === null) return;
        if (modules.dirty === undefined || typeof modules.flush !== 'function') return;
        modules.dirty.add(PACKAGE_NAME);
        modules.flush(() => {});
      } catch (error) {
        // A different module system simply skips this repair.
      }
    };
    const first = setTimeout(nudge, 600);
    const second = setTimeout(nudge, 4000);
    ctx.effect(() => () => {
      clearTimeout(first);
      clearTimeout(second);
    });
  } catch (error) {
    // Never let the repair affect activation.
  }

  ctx.effect(() => () => saveCache());
}

/** Static declaration so the plugin waits for the connection Fetch surface. */
export const inject = ['connection'];

export const name = 'token-meter';

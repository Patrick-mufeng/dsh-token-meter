/**
 * Client half of the DSH token-usage dashboard.
 *
 * Two registrations, nothing else in the conversation:
 *  - `sidebar.panellist` icon: the left-column entry that selects the panel.
 *  - `main` panel keyed by that id: the analytics page.
 *
 * Layout, top to bottom: a sticky toolbar (range + actions), four headline
 * figures, a two-column band (daily cost split / cost ranking), then the request
 * ledger — one row per model call, filtered, sorted and paged on the Host so the
 * browser only ever holds one page. Everything is folded on the Host and fetched
 * over a same-origin route; the panel never reads session events itself.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-token-meter',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'token-meter';
    const PANEL_ID = 'token-meter';
    const STATS_PATH = '/api/dsh-token-meter/stats';

    const zh = {
      'meta.title': '统计看板',
      'meta.description': '在左侧边栏打开整个 DSH 的统计看板：花费与峰谷拆分、Tokens 构成、缓存命中、按天趋势、使用节奏、花费排行，以及可筛选分页的请求账本。',
      'panel.label': '统计看板',
      'loading': '正在读取统计…',
      'page.title': '统计看板',
      'page.subtitle': '整个 DSH 的调用账本与花费分析',
      'range.all': '全部',
      'range.today': '今天',
      'range.d7': '7 天',
      'range.d30': '30 天',
      'range.d90': '90 天',
      'action.refresh': '刷新',
      'action.exportCsv': '导出 CSV',
      'scan.scanning': '正在扫描会话日志',
      'scan.ready': '统计完成',
      'scan.failed': '失败',
      'kpi.cost': '预估花费',
      'kpi.mix': 'Tokens 构成',
      'kpi.hit': '缓存命中率',
      'kpi.calls': '调用次数',
      'kpi.saved': '缓存省下',
      'kpi.savedTimes': '倍',
      'kpi.unpriced': '次无价格',
      'kpi.avgCost': '均摊',
      'kpi.noCalls': '这段时间没有调用',
      'kpi.sessions': '个会话',
      'kpi.sessionsUnit': '会话',
      'kpi.subagents': '子代理',
      'kpi.speed': '输出速度',
      'kpi.speedUnit': 'tokens / 秒',
      'kpi.speedSamples': '可测样本',
      'mix.input': '输入',
      'mix.cache': '缓存读',
      'mix.output': '输出',
      'chart.title': '每日花费',
      'chart.titleTokens': '每日 Tokens',
      'chart.sub': '高峰 / 空闲拆分',
      'chart.subTokens': '输入 / 缓存 / 输出',
      'chart.cost': '花费',
      'chart.tokens': 'Tokens',
      'chart.avg': '日均',
      'chart.total': '合计',
      'chart.days': '天',
      'chart.share': '占比',
      'chart.shareOfDay': '当天用量占比',
      'chart.empty': '这段时间没有调用。',
      'chart.hourlyTitle': '今日分时花费',
      'chart.hourlyTitleTokens': '今日分时 Tokens',
      'chart.hourlySub': '按小时 · 高峰 / 空闲拆分',
      'chart.hourlyAvg': '时均',
      'chart.peak': '高峰',
      'chart.off': '空闲',
      'rhythm.title': '使用节奏',
      'rhythm.sub': '周一–周日 × 24 小时 · 累计 tokens',
      'rhythm.mon': '周一',
      'rhythm.tue': '周二',
      'rhythm.wed': '周三',
      'rhythm.thu': '周四',
      'rhythm.fri': '周五',
      'rhythm.sat': '周六',
      'rhythm.sun': '周日',
      'rhythm.peak': '琥珀为高峰时段（工作日 9–12、14–18）',
      'rhythm.share': '占当天',
      'rhythm.peakYes': '高峰价',
      'rhythm.peakNo': '空闲价',
      'model.title': '模型用量',
      'model.sub': '按天 · 跟随顶部区间 · 点图例可隐藏曲线',
      'model.total': '合计',
      'model.pick': '模型',
      'perf.title': '运行性能',
      'perf.sub': '按每次模型往返统计',
      'perf.latency': '平均延迟',
      'perf.latencyDetail': '最慢',
      'perf.tps': '输出速度',
      'perf.tpsDetail': 'tokens / 秒',
      'perf.reasoning': '推理 token 占比',
      'perf.tokens': 'tokens',
      'perf.interrupted': '中断调用',
      'perf.ofCalls': '占全部调用',
      'perf.samples': '可测样本',
      'perf.noTiming': '日志里没有 step 起始时间，无法测量延迟。',
      'tools.title': '工具使用',
      'tools.sub': '调用次数 / 平均耗时 / 出错率',
      'tools.calls': '次调用',
      'tools.avgDuration': '平均耗时',
      'tools.errorRate': '出错率',
      'tools.coverage': '含工具调用的请求占比',
      'tools.empty': '这段时间没有工具调用。',
      'model.all': '全选',
      'model.none': '只看一个',
      'rank.share': '花费占比',
      'rank.other': '其他',
      'rank.models': '模型数',
      'rank.totalCost': '总花费',
      'rank.key': '标识',
      'rhythm.scale': '单格最大',
      'rank.title': '花费排行',
      'rank.model': '模型',
      'rank.provider': '服务商',
      'rank.session': '会话',
      'rank.workspace': '目录',
      'rank.empty': '这段时间没有调用。',
      'peaks.title': '峰谷占比',
      'peaks.sub': '高峰单价 ×2',
      'peaks.peak': '高峰',
      'peaks.off': '空闲',
      'peaks.calls': '次',
      'peaks.insight': '高峰 token 占 {a}%，却贡献了 {b}% 花费。',
      'peaks.advice': '把批处理与长任务挪到空闲时段，这部分能省一半。',
      'col.time': '时间',
      'col.session': '会话',
      'col.model': '模型',
      'col.ctx': '提示',
      'col.in': '输入',
      'col.out': '输出',
      'col.cache': '缓存读',
      'col.total': '合计',
      'col.cost': '花费',
      'col.status': '状态',
      'row.subagent': '子代理',
      'row.ok': '成功',
      'row.interrupted': '中断',
      'row.unpriced': '无价格',
      'row.peak': '高峰',
      'feed.open': '打开该会话',
      'error.title': '读取失败',
      'error.retry': '重试',
      'error.restart': '刚安装或刚更新过插件时，Host 半的代码要等 DSH 重启后才会加载；重启一次即可。',
      'note.pricing': '价格取自 DeepSeek 官方「模型 & 价格」：deepseek-flash 与 deepseek-v4-pro 的命中 / 未命中 / 输出单价，人民币每百万 tokens。高峰时段为北京时间工作日 9:00–12:00、14:00–18:00，其余时段五折；中国法定节假日按繁忙计价，因此花费是轻微高估。',
      'note.scope': '统计整个 profile 的全部会话，含子代理与工作流；fork 继承的历史前缀不重复计费。',
    };

    const en = {
      'meta.title': 'Usage Dashboard',
      'meta.description': 'A whole-DSH usage dashboard behind a left-sidebar entry: cost with peak/off-peak split, token composition, cache hit rate, daily trend, usage rhythm, cost rankings, and a filterable request ledger.',
      'panel.label': 'Usage Dashboard',
      'loading': 'Loading statistics…',
      'page.title': 'Usage Dashboard',
      'page.subtitle': 'The call ledger and cost profile of this whole DSH',
      'range.all': 'All',
      'range.today': 'Today',
      'range.d7': '7 days',
      'range.d30': '30 days',
      'range.d90': '90 days',
      'action.refresh': 'Refresh',
      'action.exportCsv': 'Export CSV',
      'scan.scanning': 'Scanning session logs',
      'scan.ready': 'Scan complete',
      'scan.failed': 'failed',
      'kpi.cost': 'Estimated cost',
      'kpi.mix': 'Token composition',
      'kpi.hit': 'Cache hit rate',
      'kpi.calls': 'Calls',
      'kpi.saved': 'saved by cache',
      'kpi.savedTimes': '×',
      'kpi.unpriced': 'unpriced calls',
      'kpi.avgCost': 'avg',
      'kpi.noCalls': 'No calls in this range',
      'kpi.sessions': 'sessions',
      'kpi.sessionsUnit': 'sessions',
      'kpi.subagents': 'subagent',
      'kpi.speed': 'Output speed',
      'kpi.speedUnit': 'tokens / second',
      'kpi.speedSamples': 'measured samples',
      'mix.input': 'Input',
      'mix.cache': 'Cache read',
      'mix.output': 'Output',
      'chart.title': 'Daily cost',
      'chart.titleTokens': 'Daily tokens',
      'chart.sub': 'peak / off-peak split',
      'chart.subTokens': 'input / cache / output',
      'chart.cost': 'Cost',
      'chart.tokens': 'Tokens',
      'chart.avg': 'Daily average',
      'chart.total': 'Total',
      'chart.days': 'days',
      'chart.share': 'Share',
      'chart.shareOfDay': 'share of the day',
      'chart.empty': 'No calls in this range.',
      'chart.hourlyTitle': 'Today by hour',
      'chart.hourlyTitleTokens': 'Today by hour',
      'chart.hourlySub': 'hourly · peak / off-peak split',
      'chart.hourlyAvg': 'Hourly average',
      'chart.peak': 'Peak',
      'chart.off': 'Off-peak',
      'rhythm.title': 'Usage rhythm',
      'rhythm.sub': 'Mon–Sun × 24 hours · total tokens',
      'rhythm.mon': 'Mon',
      'rhythm.tue': 'Tue',
      'rhythm.wed': 'Wed',
      'rhythm.thu': 'Thu',
      'rhythm.fri': 'Fri',
      'rhythm.sat': 'Sat',
      'rhythm.sun': 'Sun',
      'rhythm.peak': 'Amber marks peak hours (weekdays 9–12, 14–18)',
      'rhythm.share': 'of the day',
      'rhythm.peakYes': 'peak price',
      'rhythm.peakNo': 'off-peak price',
      'model.title': 'Model usage',
      'model.sub': 'per day · follows the range above · click a legend entry to hide its line',
      'model.total': 'Total',
      'model.pick': 'Models',
      'perf.title': 'Runtime performance',
      'perf.sub': 'per model round-trip',
      'perf.latency': 'Average latency',
      'perf.latencyDetail': 'slowest',
      'perf.tps': 'Output speed',
      'perf.tpsDetail': 'tokens / second',
      'perf.reasoning': 'Reasoning share',
      'perf.tokens': 'tokens',
      'perf.interrupted': 'Interrupted calls',
      'perf.ofCalls': 'of all calls',
      'perf.samples': 'Measured samples',
      'perf.noTiming': 'The log has no step start times, so latency cannot be measured.',
      'tools.title': 'Tool usage',
      'tools.sub': 'calls / average duration / error rate',
      'tools.calls': 'calls',
      'tools.avgDuration': 'average',
      'tools.errorRate': 'error rate',
      'tools.coverage': 'Requests that used a tool',
      'tools.empty': 'No tool calls in this range.',
      'model.all': 'Select all',
      'model.none': 'Reset to one',
      'rank.share': 'share of cost',
      'rank.other': 'Other',
      'rank.models': 'models',
      'rank.totalCost': 'total',
      'rank.key': 'key',
      'rhythm.scale': 'Busiest cell',
      'rank.title': 'Cost ranking',
      'rank.model': 'Model',
      'rank.provider': 'Provider',
      'rank.session': 'Session',
      'rank.workspace': 'Directory',
      'rank.empty': 'No calls in this range.',
      'peaks.title': 'Peak split',
      'peaks.sub': 'peak price ×2',
      'peaks.peak': 'Peak',
      'peaks.off': 'Off-peak',
      'peaks.calls': 'calls',
      'peaks.insight': 'Peak hours carry {a}% of tokens but {b}% of the bill.',
      'peaks.advice': 'Moving batch work off-peak halves what those calls cost.',
      'col.time': 'Time',
      'col.session': 'Session',
      'col.model': 'Model',
      'col.ctx': 'Prompt',
      'col.in': 'In',
      'col.out': 'Out',
      'col.cache': 'Cache',
      'col.total': 'Total',
      'col.cost': 'Cost',
      'col.status': 'Status',
      'row.subagent': 'subagent',
      'row.ok': 'ok',
      'row.interrupted': 'interrupted',
      'row.unpriced': 'unpriced',
      'row.peak': 'peak',
      'feed.open': 'Open this session',
      'error.title': 'Read failed',
      'error.retry': 'Retry',
      'error.restart': 'The Host half of a freshly installed or updated plugin only loads after DSH restarts; restart once and reopen this panel.',
      'note.pricing': 'Prices come from DeepSeek’s official Models & Pricing page: cache-hit, cache-miss, and output rates for deepseek-flash and deepseek-v4-pro, in CNY per million tokens. Peak hours are 09:00–12:00 and 14:00–18:00 Beijing time on weekdays with the rest at half price; Chinese public holidays are priced as peak here, so the estimate runs slightly high.',
      'note.scope': 'Covers every session in this profile, subagents and workflows included; a fork’s inherited prefix is never billed twice.',
    };

    let translate = (key) => key;
    /** The Client context captured in `apply`, for actions outside the slot props. */
    let clientCtx = null;

    /* ---------------------------------------------------------------- format */

    function formatTokens(value) {
      const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
      if (n < 1000) return String(Math.round(n));
      if (n < 1e6) return trim(n / 1e3) + 'K';
      if (n < 1e9) return trim(n / 1e6) + 'M';
      return trim(n / 1e9) + 'B';
    }

    function trim(n) {
      if (n >= 100) return String(Math.round(n));
      if (n >= 10) return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '');
      return (Math.round(n * 100) / 100).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    }

    function formatInt(value) {
      const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
      return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /** Money. Below one yuan three decimals keep per-call figures from reading ¥0.00. */
    function formatCny(value) {
      const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
      if (n === 0) return '¥0';
      if (n < 1) return '¥' + n.toFixed(3).replace(/0$/, '');
      if (n < 100) return '¥' + n.toFixed(2);
      return '¥' + formatInt(n);
    }

    function pad2(value) {
      return value < 10 ? '0' + value : String(value);
    }

    function formatClock(ms) {
      if (!ms) return '';
      const d = new Date(ms);
      return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }

    function formatStamp(ms) {
      if (!ms) return '';
      const d = new Date(ms);
      return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + formatClock(ms);
    }

    function formatDay(ms) {
      if (!ms) return '';
      const d = new Date(ms);
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }

    function baseName(path) {
      if (typeof path !== 'string' || path === '') return '';
      const parts = path.split(/[\\/]+/).filter(Boolean);
      if (parts.length === 0) return path;
      return parts.slice(-2).join('/');
    }

    /** Interpolate `{a}` / `{b}` placeholders in a translated string. */
    function fill(template, values) {
      let out = template;
      for (const key of Object.keys(values)) out = out.split('{' + key + '}').join(values[key]);
      return out;
    }

    /* ----------------------------------------------------------------- fetch */

    function buildUrl(path, params) {
      const url = new URL(path, document.baseURI);
      if (params !== undefined) {
        for (const key of Object.keys(params)) {
          const value = params[key];
          if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
        }
      }
      return url.toString();
    }

    async function getJson(path, params) {
      const response = await fetch(buildUrl(path, params), { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.json();
    }

    /* ----------------------------------------------------------------- hooks */

    const RANGES = [
      { id: 'all', label: 'range.all' },
      { id: '1', label: 'range.today' },
      { id: '7', label: 'range.d7' },
      { id: '30', label: 'range.d30' },
      { id: '90', label: 'range.d90' },
    ];

    function useStats(range, ticket) {
      const [state, setState] = React.useState({ status: 'loading', data: null, error: null });
      React.useEffect(() => {
        let disposed = false;
        let timer = null;
        const load = async () => {
          try {
            const data = await getJson(STATS_PATH, { range });
            if (disposed) return;
            setState({ status: 'ready', data, error: null });
            timer = setTimeout(load, data.phase === 'scanning' ? 900 : 20000);
          } catch (error) {
            if (disposed) return;
            setState({ status: 'error', data: null, error: error instanceof Error ? error.message : String(error) });
            timer = setTimeout(load, 4000);
          }
        };
        load();
        return () => {
          disposed = true;
          if (timer !== null) clearTimeout(timer);
        };
      }, [range, ticket]);
      return state;
    }

    /* ---------------------------------------------------------------- pieces */

    function Icon({ size, active }) {
      const edge = typeof size === 'number' ? size : 20;
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: edge,
          height: edge,
          fill: 'none',
          'aria-hidden': true,
          focusable: 'false',
          style: { display: 'block', opacity: active ? 1 : 0.9 },
        },
        h('rect', { x: 3.2, y: 11.4, width: 4.1, height: 9.4, rx: 1.1, fill: 'currentColor', opacity: 0.55 }),
        h('rect', { x: 9.95, y: 6.6, width: 4.1, height: 14.2, rx: 1.1, fill: 'currentColor', opacity: 0.8 }),
        h('rect', { x: 16.7, y: 2.6, width: 4.1, height: 18.2, rx: 1.1, fill: 'currentColor' }),
        h('path', { d: 'M2.6 21.6h18.8', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', opacity: 0.45 }),
      );
    }

    function Segmented({ value, onChange, options, t, compact }) {
      return h(
        'div',
        { className: 'dstm-segs' + (compact === true ? ' is-compact' : ''), role: 'group' },
        options.map((option) =>
          h(
            'button',
            {
              key: option.id,
              type: 'button',
              className: 'dstm-seg' + (option.id === value ? ' is-active' : ''),
              'aria-pressed': option.id === value,
              onClick: () => onChange(option.id),
            },
            t(option.label),
          ),
        ),
      );
    }

    function Card({ title, subtitle, actions, children, bodyStyle, className }) {
      return h(
        'section',
        { className: 'dstm-card' + (className === undefined ? '' : ' ' + className) },
        title === undefined
          ? null
          : h(
              'div',
              { className: 'dstm-cardHead' },
              h(
                'div',
                { className: 'dstm-cardHeadText' },
                h('h2', { className: 'dstm-cardTitle' }, title),
                subtitle === undefined ? null : h('span', { className: 'dstm-cardSub' }, subtitle),
              ),
              actions === undefined ? null : h('div', { className: 'dstm-cardActions' }, actions),
            ),
        h('div', { className: 'dstm-cardBody', style: bodyStyle }, children),
      );
    }

    function Legend({ items }) {
      return h(
        'span',
        { className: 'dstm-legend' },
        items.map((item) =>
          h(
            'span',
            { key: item.label, className: 'dstm-legendItem' },
            h('i', { className: 'dstm-dot', style: { background: item.color } }),
            item.label,
          ),
        ),
      );
    }

    function Skeleton() {
      return h(
        'div',
        { className: 'dstm-skeleton', 'aria-hidden': true },
        h('div', { className: 'dstm-skelRow' },
          h('div', { className: 'dstm-skelKpi' }),
          h('div', { className: 'dstm-skelKpi' }),
          h('div', { className: 'dstm-skelKpi' }),
          h('div', { className: 'dstm-skelKpi' }),
        ),
        h('div', { className: 'dstm-skelRow' },
          h('div', { className: 'dstm-skelCard' }),
          h('div', { className: 'dstm-skelCard' }),
        ),
      );
    }

    /* ---------------------------------------------------------------- tooltip */

    /**
     * One floating readout shared by every chart. It is positioned from the
     * pointer, flipped to the other side near the viewport edge, and rendered
     * through a fixed layer so scrolling containers never clip it.
     */
    function useTooltip() {
      const [tip, setTip] = React.useState(null);
      /** `content` omitted on mousemove keeps the current readout, only repositions it. */
      const show = React.useCallback((event, content) => {
        if (event === undefined || event === null) return;
        setTip((previous) => ({
          x: event.clientX,
          y: event.clientY,
          content: content === undefined && previous !== null ? previous.content : content,
        }));
      }, []);
      const hide = React.useCallback(() => setTip(null), []);
      return { tip, show, hide };
    }

    function TooltipLayer({ tip }) {
      if (tip === null) return null;
      const width = 232;
      const flipX = typeof window !== 'undefined' && tip.x + width + 18 > window.innerWidth;
      const flipY = typeof window !== 'undefined' && tip.y > window.innerHeight - 190;
      return h(
        'div',
        {
          className: 'dstm-tip',
          role: 'tooltip',
          style: {
            left: (flipX ? tip.x - width - 14 : tip.x + 14) + 'px',
            top: (flipY ? tip.y - 14 : tip.y + 14) + 'px',
            transform: flipY ? 'translateY(-100%)' : 'none',
            width: width + 'px',
          },
        },
        tip.content,
      );
    }

    function TipTitle({ children }) {
      return h('div', { className: 'dstm-tipTitle' }, children);
    }

    function TipRow({ label, value, color, muted, strong }) {
      return h(
        'div',
        { className: 'dstm-tipRow' + (muted === true ? ' is-muted' : '') },
        h(
          'span',
          { className: 'dstm-tipKey' },
          color === undefined ? null : h('i', { className: 'dstm-tipDot', style: { background: color } }),
          label,
        ),
        h('span', { className: 'dstm-tipVal' + (strong === true ? ' is-strong' : '') }, value),
      );
    }

    function TipRule() {
      return h('div', { className: 'dstm-tipRule' });
    }

    /** Bucket daily rows into at most ~120 bars, aggregating by month when long. */
    function seriesOf(days) {
      if (days.length <= 120) return days.slice();
      const months = new Map();
      for (const day of days) {
        const key = day.date.slice(0, 7);
        let row = months.get(key);
        if (row === undefined) {
          row = {
            date: key,
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            cost: 0,
            peakCost: 0,
            offCost: 0,
            calls: 0,
            tokenTotal: 0,
          };
          months.set(key, row);
        }
        row.input += day.input;
        row.output += day.output;
        row.cacheRead += day.cacheRead;
        row.cacheWrite += day.cacheWrite;
        row.cost += day.cost;
        row.peakCost += day.peakCost === undefined ? 0 : day.peakCost;
        row.offCost += day.offCost === undefined ? 0 : day.offCost;
        row.calls += day.calls;
        row.tokenTotal += day.tokenTotal;
      }
      return Array.from(months.values()).sort((left, right) => (left.date < right.date ? -1 : 1));
    }

    /**
     * Daily trend. Cost mode stacks the peak and off-peak halves of each day so
     * the expensive band is visible at a glance; token mode stacks input, cache
     * and output. The y axis is labelled, and the daily average is drawn in.
     */
    /**
     * Trend chart. Normally one bar per calendar day; when the range covers a
     * single day there is only one bar to draw, so the axis switches to hours of
     * that day — otherwise the card would be a single lonely column.
     */
    function TrendChart({ days, hours, metric, t, tip }) {
      const daySeries = seriesOf(Array.isArray(days) ? days : []);
      const hourly = daySeries.length === 1 && Array.isArray(hours) && hours.length > 0;
      const series = hourly
        ? hours.map((row) => ({
            date: pad2(row.hour) + ':00',
            input: row.input,
            output: row.output,
            cacheRead: row.cacheRead,
            cacheWrite: row.cacheWrite,
            cost: row.cost,
            peakCost: row.peakCost,
            offCost: row.offCost,
            calls: row.calls,
            tokenTotal: row.tokenTotal,
          }))
        : daySeries;
      if (series.length === 0) return h('div', { className: 'dstm-empty' }, t('chart.empty'));

      const cost = metric === 'cost';
      const valueOf = (row) => (cost ? row.cost : row.tokenTotal);
      let max = 0;
      let sum = 0;
      for (const row of series) {
        const value = valueOf(row);
        if (value > max) max = value;
        sum += value;
      }
      if (max <= 0) max = 1;
      const average = sum / series.length;
      const fmt = (value) => (cost ? formatCny(value) : formatTokens(value));

      const tickCount = 4;
      const ticks = [];
      for (let index = 0; index <= tickCount; index += 1) {
        const value = (max / tickCount) * index;
        ticks.push({ value, ratio: index / tickCount });
      }

      // Only a handful of x labels, spread over the whole span: the last bar can
      // no longer collide with its neighbour.
      const labelIndexes = new Set([0]);
      const step = Math.max(1, Math.ceil(series.length / 6));
      let lastLabel = 0;
      for (let index = step; index < series.length - 1; index += step) {
        labelIndexes.add(index);
        lastLabel = index;
      }
      // The final bar keeps its label only when it is not crowding the previous
      // one; otherwise the two would overlap at the right edge.
      if (series.length > 1 && series.length - 1 - lastLabel >= Math.max(2, Math.round(step / 2))) {
        labelIndexes.add(series.length - 1);
      }

      const segmentsOf = (row) =>
        cost
          ? [
              { color: 'var(--dstm-off)', value: row.offCost === undefined ? 0 : row.offCost },
              { color: 'var(--dstm-peak)', value: row.peakCost === undefined ? 0 : row.peakCost },
            ]
          : [
              { color: 'var(--dstm-input)', value: row.input },
              { color: 'var(--dstm-cache)', value: row.cacheRead },
              { color: 'var(--dstm-output)', value: row.output },
            ];

      return h(
        'div',
        { className: 'dstm-chart' },
        h(
          'div',
          { className: 'dstm-chartMeta' },
          h(
            'span',
            { className: 'dstm-avg' },
            (hourly ? t('chart.hourlyAvg') : t('chart.avg')) + ' ' + fmt(average) + ' · ' + t('chart.total') + ' ' + fmt(sum),
          ),
          h(Legend, {
            items: cost
              ? [
                  { label: t('chart.peak'), color: 'var(--dstm-peak)' },
                  { label: t('chart.off'), color: 'var(--dstm-off)' },
                ]
              : [
                  { label: t('mix.input'), color: 'var(--dstm-input)' },
                  { label: t('mix.cache'), color: 'var(--dstm-cache)' },
                  { label: t('mix.output'), color: 'var(--dstm-output)' },
                ],
          }),
        ),
        h(
          'div',
          { className: 'dstm-plotWrap' },
          h(
            'div',
            { className: 'dstm-yAxis' },
            ticks.map((tick) =>
              h(
                'span',
                { key: tick.ratio, className: 'dstm-yTick', style: { bottom: tick.ratio * 100 + '%' } },
                tick.ratio === 0 ? '0' : fmt(tick.value),
              ),
            ),
          ),
          h(
            'div',
            { className: 'dstm-plot' },
            average > 0 ? h('div', { className: 'dstm-plotAvg', style: { bottom: (average / max) * 100 + '%' } }) : null,
            series.map((row) =>
              h(
                'div',
                {
                  key: row.date,
                  className: 'dstm-bar',
                  onMouseEnter: (event) =>
                    tip.show(
                      event,
                      h(
                        React.Fragment,
                        null,
                        h(TipTitle, null, hourly ? daySeries[0].date + ' ' + row.date : row.date),
                        h(TipRow, { label: t('chart.cost'), value: formatCny(row.cost), color: 'var(--dstm-peak)', strong: true }),
                        h(TipRow, { label: t('chart.peak'), value: formatCny(row.peakCost === undefined ? 0 : row.peakCost), color: 'var(--dstm-peak)' }),
                        h(TipRow, { label: t('chart.off'), value: formatCny(row.offCost === undefined ? 0 : row.offCost), color: 'var(--dstm-off)' }),
                        h(TipRule),
                        h(TipRow, { label: t('mix.input'), value: formatTokens(row.input), color: 'var(--dstm-input)' }),
                        h(TipRow, { label: t('mix.cache'), value: formatTokens(row.cacheRead), color: 'var(--dstm-cache)' }),
                        h(TipRow, { label: t('mix.output'), value: formatTokens(row.output), color: 'var(--dstm-output)' }),
                        h(TipRule),
                        h(TipRow, { label: t('col.total'), value: formatTokens(row.tokenTotal), strong: true }),
                        h(TipRow, { label: t('kpi.calls'), value: formatInt(row.calls), muted: true }),
                      ),
                    ),
                  onMouseMove: (event) => tip.show(event, undefined),
                  onMouseLeave: tip.hide,
                },
                h(
                  'div',
                  { className: 'dstm-barStack' },
                  segmentsOf(row).map((segment, index) =>
                    h('i', {
                      key: index,
                      className: 'dstm-barSeg',
                      style: {
                        height: (segment.value / max) * 100 + '%',
                        background: segment.color,
                      },
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
        h(
          'div',
          { className: 'dstm-axis' },
          series.map((row, index) =>
            h(
              'span',
              {
                key: row.date,
                className:
                  'dstm-axisLabel' +
                  (labelIndexes.has(index) ? ' is-shown' : '') +
                  (index === 0 ? ' is-first' : index === series.length - 1 ? ' is-last' : ''),
              },
              labelIndexes.has(index) ? (hourly || row.date.length === 7 ? row.date : row.date.slice(5)) : '',
            ),
          ),
        ),
      );
    }

    /**
     * Model usage over time: one line per provider/model, all sharing a date
     * axis. The legend doubles as a toggle so a crowded chart can be reduced to
     * the two models the reader actually cares about. Hovering anywhere in a
     * column reads out every visible series for that day.
     */
    /**
     * Model selector for the trend chart: a button that opens a checkbox list.
     * The chart defaults to the busiest few, and this is where the reader says
     * exactly which models they want to compare.
     */
    function ModelPicker({ rows, selected, onChange, t }) {
      const [open, setOpen] = React.useState(false);
      const boxRef = React.useRef(null);

      React.useEffect(() => {
        if (!open) return undefined;
        const onDown = (event) => {
          if (boxRef.current !== null && !boxRef.current.contains(event.target)) setOpen(false);
        };
        const onKey = (event) => {
          if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
          document.removeEventListener('mousedown', onDown);
          document.removeEventListener('keydown', onKey);
        };
      }, [open]);

      const chosen = selected === null ? rows.slice(0, 3).map((row) => row.key) : selected;
      const toggleAll = () => {
        if (chosen.length === rows.length) onChange([rows[0].key]);
        else onChange(rows.map((row) => row.key));
      };

      return h(
        'div',
        { className: 'dstm-picker', ref: boxRef },
        h(
          'button',
          {
            type: 'button',
            className: 'dstm-pickerButton' + (open ? ' is-open' : ''),
            onClick: () => setOpen(!open),
            'aria-expanded': open,
            'aria-haspopup': 'listbox',
          },
          h('span', null, t('model.pick') + ' ' + chosen.length + '/' + rows.length),
          h('i', { className: 'dstm-pickerCaret', 'aria-hidden': true }),
        ),
        open
          ? h(
              'div',
              { className: 'dstm-pickerMenu', role: 'listbox', 'aria-multiselectable': true },
              h(
                'button',
                { type: 'button', className: 'dstm-pickerAll', onClick: toggleAll },
                chosen.length === rows.length ? t('model.none') : t('model.all'),
              ),
              rows.map((row) =>
                h(
                  'label',
                  { key: row.key, className: 'dstm-pickerRow', title: row.key },
                  h('input', {
                    type: 'checkbox',
                    checked: chosen.indexOf(row.key) >= 0,
                    onChange: () => {
                      const current = chosen.slice();
                      const at = current.indexOf(row.key);
                      if (at >= 0) {
                        if (current.length === 1) return;
                        current.splice(at, 1);
                      } else {
                        current.push(row.key);
                      }
                      onChange(current);
                    },
                  }),
                  h('span', { className: 'dstm-pickerName' }, row.key),
                  h('span', { className: 'dstm-pickerMeta' }, formatTokens(row.tokenTotal)),
                ),
              ),
            )
          : null,
      );
    }

    function ModelTrend({ days, models, metric, selected, onSelectionChange, t, tip }) {
      const dates = Array.isArray(days) ? days.map((day) => day.date) : [];
      const rows = Array.isArray(models) ? models : [];
      const [hover, setHover] = React.useState(-1);
      // A chart with twenty lines where sixteen are flat is a chart of one line,
      // so the parent picks a few by default and this grid lets the reader change
      // that set explicitly instead of toggling invisible legend entries.
      const chosen = selected === null ? rows.slice(0, 3).map((row) => row.key) : selected;
      const shown = rows.filter((row) => chosen.indexOf(row.key) >= 0);

      if (dates.length === 0 || rows.length === 0) return h('div', { className: 'dstm-empty' }, t('chart.empty'));

      const cost = metric === 'cost';
      const shareMode = metric === 'share';
      const palette = [
        'var(--dstm-line-1)',
        'var(--dstm-line-2)',
        'var(--dstm-line-3)',
        'var(--dstm-line-4)',
        'var(--dstm-line-5)',
        'var(--dstm-line-6)',
        'var(--dstm-line-7)',
        'var(--dstm-line-8)',
      ];
      const visible = shown.map((row) => ({ row, index: rows.indexOf(row) }));

      /** Value of one series on one day, in the chart's current unit. */
      const rawAt = (row, index) => (cost ? row.costSeries : row.series)[index] || 0;
      const seriesValueOf = (item, index) => {
        const raw = rawAt(item.row, index);
        if (!shareMode) return raw;
        let dayTotal = 0;
        for (const other of visible) dayTotal += rawAt(other.row, index);
        return dayTotal > 0 ? (raw / dayTotal) * 100 : 0;
      };

      let max = 0;
      if (shareMode) max = 100;
      else {
        for (const item of visible) {
          const values = cost ? item.row.costSeries : item.row.series;
          if (!Array.isArray(values)) continue;
          for (const value of values) if (value > max) max = value;
        }
      }
      if (max <= 0) max = 1;
      // Keep the busiest point off the top border; a line that touches the frame
      // reads as clipped rather than as a maximum.
      const ceiling = shareMode ? 104 : max * 1.06;
      const fmt = (value) => (cost ? formatCny(value) : shareMode ? value.toFixed(1) + '%' : formatTokens(value));

      // Share mode is a fixed 0–100 scale with nothing above it, so the ticks are
      // labelled with the round percentages; the other modes scale to the ceiling.
      const tickCount = 4;
      const ticks = [];
      for (let index = 0; index <= tickCount; index += 1) {
        const ratio = (index / tickCount) * 100;
        const value = shareMode ? index * 25 : (ceiling / tickCount) * index;
        ticks.push({ value, ratio });
      }

      const labelIndexes = new Set([0]);
      const step = Math.max(1, Math.ceil(dates.length / 6));
      let lastLabel = 0;
      for (let index = step; index < dates.length - 1; index += step) {
        labelIndexes.add(index);
        lastLabel = index;
      }
      if (dates.length > 1 && dates.length - 1 - lastLabel >= Math.max(2, Math.round(step / 2))) {
        labelIndexes.add(dates.length - 1);
      }

      // Monotone-free straight polyline in a 0..100 × 0..100 box; the SVG is
      // stretched over the plot area so the points follow the real bar widths.
      // A model that was not used on a day has no point there; breaking the line
      // avoids a misleading dive to zero (and back).
      /**
       * Smooth path through one series.
       *
       * Uses monotone cubic interpolation (Fritsch–Carlson): the curve passes
       * through every data point and never overshoots between them, so a quiet
       * day cannot be smoothed into a peak that never happened.
       *
       * A day with no calls is a real zero and is connected like any other point;
       * only days outside the plotted window break the line. A gap in the middle
       * of a series used to look like missing data, which is misleading when the
       * axis is a calendar.
       */
      const pathOf = (item) => {
        const points = [];
        dates.forEach((date, index) => {
          const value = seriesValueOf(item, index);
          if (value === null || value === undefined) {
            points.push(null);
            return;
          }
          points.push({
            x: dates.length === 1 ? 50 : (index / (dates.length - 1)) * 100,
            y: 100 - (value / ceiling) * 100,
          });
        });

        const runs = [];
        let run = [];
        for (const point of points) {
          if (point === null) {
            if (run.length > 0) runs.push(run);
            run = [];
          } else {
            run.push(point);
          }
        }
        if (run.length > 0) runs.push(run);

        const segments = runs.map((pointsOfRun) => {
          const first = pointsOfRun[0];
          // A single day has no curve to draw; a zero-length stroke with a round
          // cap renders as a dot, which is the honest shape for one sample.
          if (pointsOfRun.length === 1) return 'M ' + first.x.toFixed(3) + ' ' + first.y.toFixed(3) + ' l 0.01 0';

          const count = pointsOfRun.length;
          const deltas = [];
          for (let index = 0; index < count - 1; index += 1) {
            const dx = pointsOfRun[index + 1].x - pointsOfRun[index].x;
            deltas.push(dx === 0 ? 0 : (pointsOfRun[index + 1].y - pointsOfRun[index].y) / dx);
          }
          const slopes = new Array(count);
          slopes[0] = deltas[0];
          slopes[count - 1] = deltas[count - 2];
          for (let index = 1; index < count - 1; index += 1) {
            const before = deltas[index - 1];
            const after = deltas[index];
            // A local extremum gets a flat tangent so the curve does not bulge.
            slopes[index] = before * after <= 0 ? 0 : (before + after) / 2;
          }
          // Fritsch–Carlson limiter: keep the interpolant monotone on every span.
          for (let index = 0; index < count - 1; index += 1) {
            const delta = deltas[index];
            if (delta === 0) {
              slopes[index] = 0;
              slopes[index + 1] = 0;
              continue;
            }
            const alpha = slopes[index] / delta;
            const beta = slopes[index + 1] / delta;
            const magnitude = alpha * alpha + beta * beta;
            if (magnitude > 9) {
              const tau = 3 / Math.sqrt(magnitude);
              slopes[index] = tau * alpha * delta;
              slopes[index + 1] = tau * beta * delta;
            }
          }

          let path = 'M ' + first.x.toFixed(3) + ' ' + first.y.toFixed(3);
          for (let index = 0; index < count - 1; index += 1) {
            const from = pointsOfRun[index];
            const to = pointsOfRun[index + 1];
            const dx = (to.x - from.x) / 3;
            const c1x = from.x + dx;
            const c1y = from.y + slopes[index] * dx;
            const c2x = to.x - dx;
            const c2y = to.y - slopes[index + 1] * dx;
            path +=
              ' C ' +
              c1x.toFixed(3) + ' ' + c1y.toFixed(3) + ', ' +
              c2x.toFixed(3) + ' ' + c2y.toFixed(3) + ', ' +
              to.x.toFixed(3) + ' ' + to.y.toFixed(3);
          }
          return path;
        });

        return segments.join(' ');
      };

      const labels = rows.map((row) => modelNameOf(row.key));
      const labelOf = (key) => modelNameOf(key);

      const toggle = (key) => {
        const current = chosen.slice();
        const at = current.indexOf(key);
        if (at >= 0) {
          // Keep at least one series on screen; an empty chart is never useful.
          if (current.length === 1) return;
          current.splice(at, 1);
        } else {
          current.push(key);
        }
        onSelectionChange(current);
      };

      return h(
        'div',
        { className: 'dstm-chart dstm-lineChart' },
        h(
          'div',
          { className: 'dstm-chartMeta' },
          h(
            'div',
            { className: 'dstm-lineLegend' },
            rows.map((row, index) =>
              h(
                'button',
                {
                  key: row.key,
                  type: 'button',
                  className: 'dstm-lineKey' + (chosen.indexOf(row.key) < 0 ? ' is-off' : ''),
                  onClick: () => toggle(row.key),
                  'aria-pressed': chosen.indexOf(row.key) >= 0,
                  title: row.key,
                },
                h('i', { className: 'dstm-lineSwatch', style: { background: palette[index % palette.length] } }),
                h('span', { className: 'dstm-lineKeyText' }, labels[index]),
              ),
            ),
          ),
          h('span', { className: 'dstm-avg' }, shareMode ? t('chart.shareOfDay') : t('chart.peak') + ' ' + fmt(max)),
        ),
        h(
          'div',
          { className: 'dstm-plotWrap' },
          h(
            'div',
            { className: 'dstm-yAxis' },
            ticks.map((tick) =>
              h(
                'span',
                { key: tick.ratio, className: 'dstm-yTick', style: { bottom: tick.ratio + '%' } },
                tick.ratio === 0 ? '0' : fmt(tick.value),
              ),
            ),
          ),
          h(
            'div',
            {
              className: 'dstm-linePlot',
              onMouseLeave: () => {
                setHover(-1);
                tip.hide();
              },
              onMouseMove: (event) => {
                const box = event.currentTarget.getBoundingClientRect();
                if (box.width <= 0) return;
                const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
                const index = Math.round(ratio * (dates.length - 1));
                if (index !== hover) {
                  setHover(index);
                  tip.show(
                    event,
                    h(
                      React.Fragment,
                      null,
                      h(TipTitle, null, dates[index]),
                      // Only models that actually ran that day; a wall of zero rows
                      // hides the one series the reader is looking at.
                      visible
                        .map((item) => ({ item, value: seriesValueOf(item, index) }))
                        .filter((entry) => entry.value > 0)
                        .sort((left, right) => right.value - left.value)
                        .map((entry) =>
                          h(TipRow, {
                            key: entry.item.row.key,
                            label: labelOf(entry.item.row.key),
                            color: palette[entry.item.index % palette.length],
                            value: fmt(entry.value),
                          }),
                        ),
                      h(TipRule),
                      h(TipRow, {
                        label: t('model.total'),
                        value: shareMode ? '100%' : fmt(visible.reduce((sum, item) => sum + rawAt(item.row, index), 0)),
                        strong: true,
                      }),
                    ),
                  );
                } else {
                  tip.show(event, undefined);
                }
              },
            },
            hover >= 0
              ? h('div', { className: 'dstm-lineCursor', style: { left: (dates.length === 1 ? 50 : (hover / (dates.length - 1)) * 100) + '%' } })
              : null,
            h(
              'svg',
              { className: 'dstm-lineSvg', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': true },
              visible.map((item) => {
                const values = cost ? item.row.costSeries : item.row.series;
                if (!Array.isArray(values) || values.length !== dates.length) return null;
                return h('path', {
                  key: item.row.key,
                  d: pathOf(item),
                  fill: 'none',
                  stroke: palette[item.index % palette.length],
                  strokeWidth: 1.9,
                  strokeLinejoin: 'round',
                  strokeLinecap: 'round',
                  vectorEffect: 'non-scaling-stroke',
                  opacity: 0.95,
                });
              }),
            ),
            hover >= 0
              ? visible.map((item) => {
                  const values = cost ? item.row.costSeries : item.row.series;
                  if (!Array.isArray(values)) return null;
                  const x = dates.length === 1 ? 50 : (hover / (dates.length - 1)) * 100;
                  const y = 100 - (seriesValueOf(item, hover) / ceiling) * 100;
                  return h('i', {
                    key: item.row.key,
                    className: 'dstm-lineDot',
                    style: {
                      left: x + '%',
                      top: y + '%',
                      background: palette[item.index % palette.length],
                    },
                  });
                })
              : null,
          ),
        ),
        h(
          'div',
          { className: 'dstm-axis' },
          dates.map((date, index) =>
            h(
              'span',
              {
                key: date,
                className:
                  'dstm-axisLabel' +
                  (labelIndexes.has(index) ? ' is-shown' : '') +
                  (index === 0 ? ' is-first' : index === dates.length - 1 ? ' is-last' : ''),
              },
              labelIndexes.has(index) ? (date.length === 7 ? date : date.slice(5)) : '',
            ),
          ),
        ),
      );
    }

    /** The Host already folds gateway prefixes away, so the key is display-ready. */
    function modelNameOf(key) {
      return typeof key === 'string' ? key : '';
    }

    /**
     * Weekday × hour grid. Amber marks the hours that are actually billed at peak
     * rates — weekends stay blue even inside the peak clock window, because the
     * price table halves them.
     */
    function RhythmGrid({ rhythm, t, tip }) {
      const rows = Array.isArray(rhythm) ? rhythm : [];
      const names = [t('rhythm.mon'), t('rhythm.tue'), t('rhythm.wed'), t('rhythm.thu'), t('rhythm.fri'), t('rhythm.sat'), t('rhythm.sun')];
      let max = 1;
      for (const row of rows) for (const value of row) if (value > max) max = value;
      const level = (value) => {
        if (value <= 0) return 0;
        const ratio = value / max;
        if (ratio > 0.55) return 4;
        if (ratio > 0.25) return 3;
        if (ratio > 0.08) return 2;
        return 1;
      };
      const isPeakAt = (weekday, hour) => weekday < 5 && ((hour >= 9 && hour < 12) || (hour >= 14 && hour < 18));

      const cells = [];
      // Header row: one label column plus an hour label every three columns.
      cells.push(h('span', { key: 'corner', className: 'dstm-rhythmCorner' }));
      for (let hour = 0; hour < 24; hour += 1) {
        cells.push(
          h('span', { key: 'h' + hour, className: 'dstm-rhythmHour' }, hour % 3 === 0 ? pad2(hour) : ''),
        );
      }
      rows.forEach((row, weekday) => {
        const dayTotal = row.reduce((sum, cell) => sum + cell, 0);
        cells.push(h('span', { key: 'd' + weekday, className: 'dstm-rhythmLabel' }, names[weekday]));
        for (let hour = 0; hour < 24; hour += 1) {
          const value = row[hour] === undefined ? 0 : row[hour];
          const peak = isPeakAt(weekday, hour);
          cells.push(
            h('i', {
              key: weekday + ':' + hour,
              className: 'dstm-rhythmCell' + (peak ? ' is-peak' : '') + ' lv' + level(value),
              onMouseEnter: (event) =>
                tip.show(
                  event,
                  h(
                    React.Fragment,
                    null,
                    h(TipTitle, null, names[weekday] + ' ' + pad2(hour) + ':00'),
                    h(TipRow, { label: t('col.total'), value: formatTokens(value), strong: true }),
                    h(TipRow, {
                      label: t('rhythm.share'),
                      value: dayTotal > 0 ? ((value / dayTotal) * 100).toFixed(1) + '%' : '0%',
                      muted: true,
                    }),
                    h(TipRule),
                    h(TipRow, {
                      label: t('chart.peak'),
                      value: peak ? t('rhythm.peakYes') : t('rhythm.peakNo'),
                      color: peak ? 'var(--dstm-peak)' : 'var(--dstm-off)',
                    }),
                  ),
                ),
              onMouseMove: (event) => tip.show(event, undefined),
              onMouseLeave: tip.hide,
            }),
          );
        }
      });

      return h(
        'div',
        { className: 'dstm-rhythm' },
        cells,
        h(
          'div',
          { className: 'dstm-rhythmFoot' },
          h('span', null, t('rhythm.peak')),
          h(
            'span',
            { className: 'dstm-rhythmScale' },
            h('span', { className: 'dstm-rhythmScaleLabel' }, t('rhythm.scale') + ' ' + formatTokens(max)),
            [0, 1, 2, 3, 4].map((lv) => h('i', { key: lv, className: 'dstm-rhythmCell lv' + lv })),
          ),
        ),
      );
    }

    /**
     * Cost share as a donut, with the ranking beside it.
     *
     * A pie answers "how concentrated is the bill" at a glance, which the list
     * could not: one slice covering two thirds of the ring is immediate. Slices
     * past the top few are folded into an "other" wedge so the legend stays legible.
     */
    function RankDonut({ rows, nameOf, titleOf, totalCost, empty, t, tip }) {
      if (!Array.isArray(rows) || rows.length === 0) return h('div', { className: 'dstm-empty' }, empty);
      const sorted = rows
        .filter((row) => (row.cost || 0) > 0)
        .sort((left, right) => (right.cost || 0) - (left.cost || 0));
      if (sorted.length === 0) return h('div', { className: 'dstm-empty' }, empty);

      const palette = [
        'var(--dstm-line-1)',
        'var(--dstm-line-2)',
        'var(--dstm-line-3)',
        'var(--dstm-line-4)',
        'var(--dstm-line-5)',
        'var(--dstm-line-6)',
        'var(--dstm-line-7)',
        'var(--dstm-line-8)',
      ];

      // Slices below one percent are a sliver of a sliver; folding them into the
      // "other" wedge keeps the legend readable without hiding any cost.
      const totalAll = sorted.reduce((sum, row) => sum + (row.cost || 0), 0) || 1;
      const keep = sorted.filter((row, index) => index < 6 && (row.cost || 0) / totalAll >= 0.01);
      const visible = keep.length > 0 ? keep : sorted.slice(0, 1);
      const kept = new Set(visible.map((row) => titleOf(row)));
      const rest = sorted.filter((row) => !kept.has(titleOf(row)));
      const restCost = rest.reduce((sum, row) => sum + (row.cost || 0), 0);
      const slices = visible.map((row, index) => ({
        key: titleOf(row),
        label: nameOf(row),
        value: row.cost || 0,
        color: palette[index % palette.length],
        row,
      }));
      if (restCost > 0) {
        slices.push({ key: '__other', label: t('rank.other'), value: restCost, color: palette[7], row: null, count: rest.length });
      }

      const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;

      // Donut geometry: r=15.9155 makes the circumference exactly 100, so each
      // slice's dash length is its percentage — no trigonometry needed.
      const radius = 15.9155;
      const circumference = 100;
      let offset = 25; // start at twelve o'clock
      const circles = slices.map((slice) => {
        const share = (slice.value / total) * 100;
        const circle = h('circle', {
          key: slice.key,
          cx: 21,
          cy: 21,
          r: radius,
          fill: 'none',
          stroke: slice.color,
          strokeWidth: 7,
          strokeDasharray: share + ' ' + (circumference - share),
          strokeDashoffset: offset,
          onMouseEnter: (event) =>
            tip.show(
              event,
              h(
                React.Fragment,
                null,
                h(TipTitle, null, slice.label),
                h(TipRow, { label: t('col.cost'), value: formatCny(slice.value), color: slice.color, strong: true }),
                h(TipRow, { label: t('rank.share'), value: share.toFixed(1) + '%', muted: true }),
                slice.row === null
                  ? h(TipRow, { label: t('rank.models'), value: formatInt(slice.count), muted: true })
                  : h(TipRow, { label: t('kpi.calls'), value: formatInt(slice.row.calls || 0), muted: true }),
              ),
            ),
          onMouseMove: (event) => tip.show(event, undefined),
          onMouseLeave: tip.hide,
        });
        offset -= share;
        return circle;
      });

      return h(
        'div',
        { className: 'dstm-donut' },
        h(
          'div',
          { className: 'dstm-donutPlot' },
          h(
            'svg',
            { viewBox: '0 0 42 42', className: 'dstm-donutSvg', role: 'img' },
            h('circle', { cx: 21, cy: 21, r: radius, fill: 'none', stroke: 'var(--dsw-alias-bg-layer-2)', strokeWidth: 7 }),
            circles,
          ),
          h(
            'div',
            { className: 'dstm-donutCenter' },
            h('b', null, formatCny(totalCost > 0 ? totalCost : total)),
            h('span', null, t('rank.totalCost')),
          ),
        ),
        h(
          'div',
          { className: 'dstm-donutLegend' },
          slices.map((slice) =>
            h(
              'div',
              {
                key: slice.key,
                className: 'dstm-donutRow',
                onMouseEnter: (event) =>
                  tip.show(
                    event,
                    h(
                      React.Fragment,
                      null,
                      h(TipTitle, null, slice.label),
                      h(TipRow, { label: t('col.cost'), value: formatCny(slice.value), color: slice.color, strong: true }),
                      h(TipRow, { label: t('rank.share'), value: ((slice.value / total) * 100).toFixed(1) + '%', muted: true }),
                    ),
                  ),
                onMouseMove: (event) => tip.show(event, undefined),
                onMouseLeave: tip.hide,
              },
              h('i', { className: 'dstm-donutSwatch', style: { background: slice.color } }),
              h('span', { className: 'dstm-donutName', title: slice.label }, slice.label),
              h('span', { className: 'dstm-donutShare' }, ((slice.value / total) * 100).toFixed(1) + '%'),
              h('span', { className: 'dstm-donutValue' }, formatCny(slice.value)),
            ),
          ),
        ),
      );
    }

    function PeakSplit({ peaks, totals, t, tip }) {
      const tokens = peaks.peak + peaks.off || 1;
      const costs = peaks.peakCost + peaks.offCost || 1;
      const tokenShare = (peaks.peak / tokens) * 100;
      const costShare = (peaks.peakCost / costs) * 100;
      return h(
        'div',
        { className: 'dstm-peaks' },
        h(
          'div',
          {
            className: 'dstm-peakBar',
            onMouseEnter: (event) =>
              tip.show(
                event,
                h(
                  React.Fragment,
                  null,
                  h(TipTitle, null, t('peaks.title')),
                  h(TipRow, { label: t('peaks.peak') + ' · ' + t('col.cost'), value: formatCny(peaks.peakCost), color: 'var(--dstm-peak)', strong: true }),
                  h(TipRow, { label: t('peaks.peak') + ' · ' + t('col.total'), value: formatTokens(peaks.peak) }),
                  h(TipRow, { label: t('peaks.peak') + ' · ' + t('kpi.calls'), value: formatInt(peaks.peakCalls), muted: true }),
                  h(TipRule),
                  h(TipRow, { label: t('peaks.off') + ' · ' + t('col.cost'), value: formatCny(peaks.offCost), color: 'var(--dstm-off)', strong: true }),
                  h(TipRow, { label: t('peaks.off') + ' · ' + t('col.total'), value: formatTokens(peaks.off) }),
                  h(TipRow, { label: t('peaks.off') + ' · ' + t('kpi.calls'), value: formatInt(peaks.offCalls), muted: true }),
                ),
              ),
            onMouseMove: (event) => tip.show(event, undefined),
            onMouseLeave: tip.hide,
          },
          h('span', { className: 'dstm-peakSeg is-peak', style: { width: costShare + '%' } }),
          h('span', { className: 'dstm-peakSeg is-off', style: { width: 100 - costShare + '%' } }),
        ),
        h(
          'div',
          { className: 'dstm-peakRows' },
          h(
            'div',
            { className: 'dstm-peakRow' },
            h('span', { className: 'dstm-peakKey' }, h('i', { className: 'dstm-dot dstm-dot-peak' }), t('peaks.peak')),
            h('b', null, tokenShare.toFixed(1) + '%'),
            h('span', { className: 'dstm-peakMeta' }, formatCny(peaks.peakCost) + ' · ' + formatInt(peaks.peakCalls) + ' ' + t('peaks.calls')),
          ),
          h(
            'div',
            { className: 'dstm-peakRow' },
            h('span', { className: 'dstm-peakKey' }, h('i', { className: 'dstm-dot dstm-dot-off' }), t('peaks.off')),
            h('b', null, (100 - tokenShare).toFixed(1) + '%'),
            h('span', { className: 'dstm-peakMeta' }, formatCny(peaks.offCost) + ' · ' + formatInt(peaks.offCalls) + ' ' + t('peaks.calls')),
          ),
        ),
        h(
          'p',
          { className: 'dstm-insight' },
          fill(t('peaks.insight'), { a: tokenShare.toFixed(0), b: costShare.toFixed(0) }),
        ),
        h('p', { className: 'dstm-hint' }, t('peaks.advice')),
      );
    }

    function openSession(id) {
      try {
        const context = clientCtx;
        if (context === null) return;
        const workspace = context.get('uiWorkspace');
        if (workspace !== undefined && workspace !== null && typeof workspace.openSession === 'function') {
          workspace.openSession(id);
          return;
        }
        const layout = context.get('layout');
        if (layout !== undefined && layout !== null && typeof layout.selectPanel === 'function') layout.selectPanel('conversation');
      } catch (error) {
        // Opening another Session is a convenience; the dashboard stays readable.
      }
    }

    /* ----------------------------------------------------------------- ledger */

    /* ------------------------------------------------------------------- css */

    const CSS = `
      .dstm-page {
        box-sizing: border-box; height: 100%; min-height: 0; overflow-y: auto; overflow-x: hidden;
        background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
        font-family: var(--dsw-font-family);
        --dstm-peak: var(--dsw-static-amber-500);
        --dstm-off: color-mix(in oklab, var(--dsw-static-blue-500) 62%, var(--dsw-alias-bg-layer-2));
        --dstm-input: var(--dsw-static-blue-500);
        --dstm-cache: color-mix(in oklab, var(--dsw-static-blue-500) 40%, var(--dsw-alias-bg-layer-2));
        --dstm-output: var(--dsw-static-amber-500);
        --dstm-accent: var(--dsw-static-blue-500);
        /* Eight categorical hues. Chosen so neighbouring entries stay apart in
           both themes: alternating warm/cool avoids two blues reading as one. */
        --dstm-line-1: #3b82f6;
        --dstm-line-2: #f59e0b;
        --dstm-line-3: #22c55e;
        --dstm-line-4: #a855f7;
        --dstm-line-5: #ef4444;
        --dstm-line-6: #06b6d4;
        --dstm-line-7: #84cc16;
        --dstm-line-8: #ec4899;
      }
      /* The toolbar and this container are siblings, so the flex gap inside it
         never separates them: the content needs its own top padding or the
         first row sits flush against the toolbar. */
      .dstm-inner { box-sizing: border-box; width: 100%; max-width: 1240px; margin: 0 auto; padding: 18px 26px 40px; display: flex; flex-direction: column; gap: 14px; }

      /* sticky toolbar keeps the range and actions reachable on a long page */
      .dstm-sticky {
        position: sticky; top: 0; z-index: 6;
        background: color-mix(in oklab, var(--dsw-alias-bg-base) 92%, transparent);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--dsw-alias-border-l1);
      }
      .dstm-stickyInner {
        box-sizing: border-box; width: 100%; max-width: 1240px; margin: 0 auto;
        padding: calc(14px + var(--dsh-frame-top-clearance, 0px)) 26px 12px max(26px, var(--dsh-frame-leading-clearance, 0px));
        display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
      }
      .dstm-headText { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .dstm-headIcon { width: 33px; height: 33px; flex: none; display: flex; align-items: center; justify-content: center; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); }
      .dstm-titleWrap { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .dstm-title { margin: 0; font-size: 18px; line-height: 1.25; font-weight: 650; letter-spacing: -0.01em; }
      .dstm-subtitle { margin: 0; font-size: 12px; line-height: 1.35; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dstm-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

      .dstm-button { box-sizing: border-box; height: 30px; padding: 0 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 12.5px; line-height: 1; cursor: pointer; white-space: nowrap; }
      .dstm-button:hover { background: var(--dsw-alias-interactive-bg-hover); }
      .dstm-button:focus-visible { outline: 2px solid var(--dstm-accent); outline-offset: 1px; }
      .dstm-button.is-ghost { border-color: transparent; color: var(--dsw-alias-label-secondary); }

      .dstm-segs { display: inline-flex; padding: 2px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-2); }
      .dstm-seg { box-sizing: border-box; height: 25px; padding: 0 11px; border: 0; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; line-height: 1; cursor: pointer; white-space: nowrap; }
      .dstm-seg:hover { color: var(--dsw-alias-label-primary); }
      .dstm-seg.is-active { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); box-shadow: var(--dsw-shadow-lv1); }
      .dstm-segs.is-compact .dstm-seg { height: 22px; padding: 0 9px; font-size: 11.5px; }

      .dstm-status { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 0 0 12px; padding: 8px 13px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); font-size: 12.5px; color: var(--dsw-alias-label-secondary); }
      .dstm-statusDot { width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-state-success-primary); flex: none; }
      .dstm-statusDot.is-busy { background: var(--dsw-alias-state-warn-primary); animation: dstm-pulse 1.1s ease-in-out infinite; }
      @keyframes dstm-pulse { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
      .dstm-progress { position: relative; flex: 0 1 180px; height: 3px; overflow: hidden; border-radius: 2px; background: var(--dsw-alias-bg-layer-2); }
      .dstm-progressFill { position: absolute; inset: 0 auto 0 0; background: var(--dsw-alias-state-warn-primary); }

      /* headline figures: one bordered band, five aligned columns */
      .dstm-kpis { display: grid; grid-template-columns: 1.15fr 1.35fr 0.95fr 1fr 0.95fr; border: 1px solid var(--dsw-alias-border-l1); border-radius: 16px; background: var(--dsw-alias-bg-layer-1); overflow: hidden; }
      .dstm-kpi { padding: 15px 18px; border-left: 1px solid var(--dsw-alias-border-l1); min-width: 0; display: flex; flex-direction: column; gap: 3px; justify-content: center; }
      .dstm-kpi:first-child { border-left: 0; }
      .dstm-kpiLabel { font-size: 11.5px; line-height: 15px; color: var(--dsw-alias-label-secondary); }
      .dstm-kpiValue { font-size: 25px; line-height: 1.12; font-weight: 650; letter-spacing: -0.015em; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dstm-kpiValue small { font-size: 13px; font-weight: 550; color: var(--dsw-alias-label-secondary); margin-left: 2px; }
      .dstm-kpiDetail { font-size: 11.5px; line-height: 15px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dstm-kpiDetail b { font-weight: 600; color: var(--dsw-alias-state-success-primary); }
      .dstm-mix { display: flex; height: 6px; margin-top: 6px; border-radius: 3px; overflow: hidden; background: var(--dsw-alias-bg-layer-2); gap: 1px; }
      .dstm-mixSeg { display: block; height: 100%; min-width: 2px; }
      .dstm-mixKey { display: flex; gap: 11px; margin-top: 6px; font-size: 10.5px; color: var(--dsw-alias-label-secondary); flex-wrap: wrap; }
      .dstm-mixKey span { display: inline-flex; align-items: center; gap: 5px; font-variant-numeric: tabular-nums; }

      .dstm-dot { width: 8px; height: 8px; border-radius: 2px; flex: none; }
      .dstm-dot-peak { background: var(--dstm-peak); }
      .dstm-dot-off { background: var(--dstm-off); }

      .dstm-split { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 14px; align-items: start; }
      .dstm-col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }

      .dstm-card { box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l1); border-radius: 16px; background: var(--dsw-alias-bg-layer-1); min-width: 0; display: flex; flex-direction: column; }
      .dstm-cardHead { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 16px 0; }
      .dstm-cardHeadText { display: flex; align-items: baseline; gap: 8px; min-width: 0; flex-wrap: wrap; }
      .dstm-cardTitle { margin: 0; font-size: 13.5px; line-height: 19px; font-weight: 600; }
      .dstm-cardSub { font-size: 11.5px; line-height: 16px; color: var(--dsw-alias-label-secondary); }
      .dstm-cardActions { flex: none; display: flex; align-items: center; gap: 8px; }
      .dstm-cardBody { padding: 12px 16px 16px; flex: 1 1 auto; min-height: 0; }

      .dstm-chart { display: flex; flex-direction: column; gap: 8px; height: 100%; }
      .dstm-chartMeta { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 11.5px; color: var(--dsw-alias-label-secondary); flex-wrap: wrap; padding-bottom: 2px; }
      .dstm-avg { font-variant-numeric: tabular-nums; }
      .dstm-legend { display: inline-flex; gap: 12px; flex-wrap: wrap; }
      .dstm-legendItem { display: inline-flex; align-items: center; gap: 5px; }
      .dstm-plotWrap { display: flex; gap: 8px; padding-top: 6px; }
      .dstm-yAxis { position: relative; flex: none; width: 42px; height: 170px; }
      .dstm-yTick { position: absolute; right: 0; transform: translateY(50%); font-size: 9.5px; line-height: 1; color: var(--dsw-alias-label-secondary); white-space: nowrap; font-variant-numeric: tabular-nums; }
      .dstm-plot { position: relative; flex: 1 1 auto; min-width: 0; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 3px; height: 170px; align-items: end; border-bottom: 1px solid var(--dsw-alias-border-l1); }
      .dstm-plotAvg { position: absolute; left: 0; right: 0; height: 0; border-top: 1px dashed var(--dsw-alias-border-l3); pointer-events: none; }
      .dstm-plotAvgTag { position: absolute; right: 0; transform: translateY(-100%); font-size: 9.5px; line-height: 1; padding: 1px 0 2px 5px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-1); }
      .dstm-bar { height: 100%; display: flex; align-items: flex-end; min-width: 0; }
      .dstm-barStack { display: flex; flex-direction: column-reverse; width: 100%; height: 100%; overflow: hidden; border-radius: 3px 3px 0 0; opacity: .9; transition: opacity .12s ease; }
      .dstm-bar:hover .dstm-barStack { opacity: 1; }
      .dstm-barSeg { display: block; width: 100%; flex: none; min-height: 0; }
      .dstm-axis { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 3px; margin-left: 50px; }
      .dstm-axisLabel { font-size: 10px; line-height: 12px; white-space: nowrap; color: var(--dsw-alias-label-secondary); justify-self: center; opacity: 0; }
      .dstm-axisLabel.is-shown { opacity: .9; }
      .dstm-axisLabel.is-first { justify-self: start; }
      .dstm-axisLabel.is-last { justify-self: end; }

      /* Weekday × hour rhythm. Cells are squares: each one takes its height from
         its own width, so the block grows with the panel instead of collapsing to
         a thin band of 15px rows. */
      .dstm-rhythm {
        display: grid;
        grid-template-columns: 34px repeat(24, minmax(0, 1fr));
        grid-template-rows: 16px repeat(7, minmax(30px, 1fr));
        gap: 4px;
        min-height: 300px;
      }
      .dstm-rhythmLabel { display: flex; align-items: center; font-size: 10.5px; line-height: 1; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
      .dstm-rhythmHour { font-size: 9.5px; line-height: 14px; text-align: center; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
      .dstm-rhythmCell { border-radius: 3px; background: var(--dsw-alias-bg-layer-2); display: block; min-height: 22px; }
      .dstm-rhythmCell.lv1 { background: color-mix(in oklab, var(--dstm-accent) 22%, var(--dsw-alias-bg-layer-2)); }
      .dstm-rhythmCell.lv2 { background: color-mix(in oklab, var(--dstm-accent) 44%, var(--dsw-alias-bg-layer-2)); }
      .dstm-rhythmCell.lv3 { background: color-mix(in oklab, var(--dstm-accent) 68%, var(--dsw-alias-bg-layer-2)); }
      .dstm-rhythmCell.lv4 { background: var(--dstm-accent); }
      .dstm-rhythmCell.is-peak.lv1 { background: color-mix(in oklab, var(--dstm-peak) 22%, var(--dsw-alias-bg-layer-2)); }
      .dstm-rhythmCell.is-peak.lv2 { background: color-mix(in oklab, var(--dstm-peak) 44%, var(--dsw-alias-bg-layer-2)); }
      .dstm-rhythmCell.is-peak.lv3 { background: color-mix(in oklab, var(--dstm-peak) 68%, var(--dsw-alias-bg-layer-2)); }
      .dstm-rhythmCell.is-peak.lv4 { background: var(--dstm-peak); }
      .dstm-rhythmCorner { grid-column: 1; }
      .dstm-rhythmFoot { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 5px; font-size: 10.5px; color: var(--dsw-alias-label-secondary); flex-wrap: wrap; }
      .dstm-rhythmScale { display: inline-flex; align-items: center; gap: 4px; }
      .dstm-rhythmScaleLabel { margin-right: 2px; }
      .dstm-rhythmScale .dstm-rhythmCell { width: 10px; height: 10px; border-radius: 2px; }

      /* cost donut */
      .dstm-donut { display: flex; flex-direction: column; gap: 14px; }
      .dstm-donutPlot { position: relative; width: 100%; max-width: 172px; aspect-ratio: 1; margin: 0 auto; flex: none; }
      .dstm-donutSvg { width: 100%; height: 100%; display: block; transform: rotate(-90deg); }
      .dstm-donutSvg circle { transition: opacity .12s ease; }
      .dstm-donutSvg circle:hover { opacity: .82; }
      .dstm-donutCenter { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; pointer-events: none; }
      .dstm-donutCenter b { font-size: 15px; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
      .dstm-donutCenter span { font-size: 9.5px; color: var(--dsw-alias-label-secondary); }
      .dstm-donutLegend { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .dstm-donutRow { display: grid; grid-template-columns: 8px minmax(0, 1fr) 40px 56px; align-items: center; gap: 8px; padding: 3px 4px; font-size: 11.5px; border-radius: 4px; cursor: default; }
      .dstm-donutRow:hover { background: var(--dsw-alias-interactive-bg-hover); }
      .dstm-donutSwatch { width: 8px; height: 8px; border-radius: 2px; }
      .dstm-donutName { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dstm-donutShare { font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary); font-size: 10.5px; text-align: right; }
      .dstm-donutValue { font-variant-numeric: tabular-nums; font-weight: 600; text-align: right; }

      .dstm-rank { display: flex; flex-direction: column; }
      .dstm-rankRow { padding: 7px 0; border-bottom: 1px solid var(--dsw-alias-border-l1); }
      .dstm-rankRow:last-child { border-bottom: 0; }
      .dstm-rankLine { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
      .dstm-rankName { font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
      .dstm-rankValue { flex: none; font-size: 12.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
      .dstm-rankShare { margin-left: 6px; font-size: 10.5px; font-weight: 500; color: var(--dsw-alias-label-secondary); }
      .dstm-rankTrack { height: 4px; margin-top: 4px; border-radius: 2px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
      .dstm-rankFill { display: block; height: 100%; border-radius: 2px; background: var(--dstm-peak); }

      .dstm-peaks { display: flex; flex-direction: column; gap: 11px; }
      .dstm-peakBar { display: flex; height: 10px; overflow: hidden; border-radius: 3px; background: var(--dsw-alias-bg-layer-2); gap: 1px; }
      .dstm-peakSeg { height: 100%; }
      .dstm-peakSeg.is-peak { background: var(--dstm-peak); }
      .dstm-peakSeg.is-off { background: var(--dstm-off); }
      .dstm-peakRows { display: flex; flex-direction: column; gap: 7px; }
      .dstm-peakRow { display: grid; grid-template-columns: auto auto 1fr; align-items: baseline; gap: 10px; font-size: 12.5px; }
      .dstm-peakKey { display: inline-flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-secondary); }
      .dstm-peakRow b { font-variant-numeric: tabular-nums; font-weight: 650; }
      .dstm-peakMeta { text-align: right; font-size: 11.5px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
      .dstm-insight { margin: 0; font-size: 11.5px; line-height: 1.6; color: var(--dsw-alias-label-primary); }
      .dstm-hint { margin: 0; font-size: 11.5px; line-height: 1.55; color: var(--dsw-alias-label-secondary); }

      /* ledger */
      .dstm-ledger .dstm-cardHead { padding-bottom: 0; }
      .dstm-filters { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; padding: 11px 16px; }
      .dstm-search { position: relative; display: flex; align-items: center; }
      .dstm-searchIcon { position: absolute; left: 9px; font-size: 14px; color: var(--dsw-alias-label-secondary); pointer-events: none; }
      .dstm-input { box-sizing: border-box; height: 30px; width: 236px; padding: 0 26px 0 25px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 12.5px; }
      .dstm-input::placeholder { color: var(--dsw-alias-label-secondary); opacity: .8; }
      .dstm-input:focus { outline: none; border-color: var(--dstm-accent); }
      .dstm-inputClear { position: absolute; right: 6px; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border: 0; border-radius: 4px; background: transparent; color: var(--dsw-alias-label-secondary); font-size: 14px; line-height: 1; cursor: pointer; }
      .dstm-inputClear:hover { background: var(--dsw-alias-interactive-bg-hover); }
      .dstm-selectWrap { position: relative; display: inline-flex; }
      .dstm-select { box-sizing: border-box; height: 30px; max-width: 210px; padding: 0 24px 0 9px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12.5px; appearance: none; cursor: pointer; text-overflow: ellipsis; }
      .dstm-select:hover { color: var(--dsw-alias-label-primary); }
      .dstm-select:focus { outline: none; border-color: var(--dstm-accent); }
      .dstm-selectCaret { position: absolute; right: 9px; top: 50%; width: 0; height: 0; margin-top: -2px; border-left: 3.5px solid transparent; border-right: 3.5px solid transparent; border-top: 4.5px solid currentColor; color: var(--dsw-alias-label-secondary); pointer-events: none; }
      .dstm-filterCount { margin-left: auto; font-size: 11.5px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }

      .dstm-tableWrap { overflow-x: auto; border-top: 1px solid var(--dsw-alias-border-l1); }
      .dstm-table { width: 100%; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
      .dstm-table th { padding: 0; background: var(--dsw-alias-bg-layer-1); border-bottom: 1px solid var(--dsw-alias-border-l1); font-size: 10.5px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); text-align: left; white-space: nowrap; }
      .dstm-table th.dstm-num { text-align: right; }
      .dstm-thButton { width: 100%; padding: 9px 10px; border: 0; background: transparent; color: inherit; font: inherit; text-transform: inherit; letter-spacing: inherit; text-align: inherit; cursor: pointer; white-space: nowrap; }
      .dstm-thButton:hover { color: var(--dsw-alias-label-primary); }
      .dstm-sortMark { margin-left: 3px; font-style: normal; font-size: 10px; color: var(--dstm-accent); }
      .dstm-table td { padding: 8px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1); vertical-align: middle; white-space: nowrap; }
      .dstm-table tbody tr:last-child td { border-bottom: 0; }
      .dstm-table .dstm-num { text-align: right; }
      .dstm-row { cursor: pointer; }
      .dstm-row:hover td { background: var(--dsw-alias-interactive-bg-hover); }
      .dstm-dim { color: var(--dsw-alias-label-secondary); }
      .dstm-modelCell { max-width: 250px; overflow: hidden; text-overflow: ellipsis; }
      .dstm-modelName { font-size: 12px; }
      .dstm-provider { margin-left: 6px; font-size: 10.5px; color: var(--dsw-alias-label-secondary); }
      .dstm-sessionCell { min-width: 150px; max-width: 300px; }
      .dstm-sessionTitle { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .dstm-sessionName { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 270px; }
      .dstm-badge { flex: none; padding: 1px 5px; border-radius: 3px; background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-label-secondary); font-size: 9.5px; line-height: 13px; font-weight: 600; }
      .dstm-peakTag { margin-left: 4px; font-style: normal; font-size: 9px; color: var(--dstm-peak); vertical-align: super; }
      .dstm-tag { padding: 1px 6px; border-radius: 4px; font-size: 10.5px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); }
      .dstm-tag.is-bad { background: color-mix(in oklab, var(--dsw-alias-state-error-primary) 14%, transparent); color: var(--dsw-alias-state-error-primary); }

      .dstm-pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; border-top: 1px solid var(--dsw-alias-border-l1); font-size: 11.5px; color: var(--dsw-alias-label-secondary); flex-wrap: wrap; }
      .dstm-pagerInfo { font-variant-numeric: tabular-nums; }
      .dstm-pages { display: flex; align-items: center; gap: 4px; }
      .dstm-pageBtn { box-sizing: border-box; min-width: 26px; height: 26px; padding: 0 7px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; cursor: pointer; font-variant-numeric: tabular-nums; }
      .dstm-pageBtn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
      .dstm-pageBtn.is-active { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-weight: 600; }
      .dstm-pageBtn:disabled { opacity: .35; cursor: default; }
      .dstm-pagerGap { padding: 0 3px; }

      .dstm-empty { padding: 30px 0; text-align: center; font-size: 12.5px; color: var(--dsw-alias-label-secondary); }
      .dstm-error { display: flex; flex-direction: column; align-items: center; gap: 9px; padding: 34px 16px; text-align: center; }
      .dstm-errorTitle { font-size: 14.5px; font-weight: 600; }
      .dstm-errorText { font-size: 12.5px; line-height: 1.6; color: var(--dsw-alias-label-secondary); max-width: 560px; word-break: break-word; }

      .dstm-skeleton { display: flex; flex-direction: column; gap: 14px; }
      .dstm-skelRow { display: grid; grid-template-columns: 1.15fr 1.35fr .95fr 1fr; gap: 14px; }
      .dstm-skelRow:nth-child(2) { grid-template-columns: 1.6fr 1fr; }
      .dstm-skelKpi, .dstm-skelCard { border-radius: 16px; background: var(--dsw-alias-bg-skeleton); animation: dstm-shimmer 1.4s ease-in-out infinite; }
      .dstm-skelKpi { height: 92px; }
      .dstm-skelCard { height: 260px; }
      @keyframes dstm-shimmer { 0%,100% { opacity: .55; } 50% { opacity: 1; } }

      /* floating readout, one layer for every chart */
      .dstm-tip {
        position: fixed; z-index: 40; pointer-events: none;
        padding: 9px 11px; border-radius: 10px;
        border: 1px solid var(--dsw-alias-border-l2);
        background: color-mix(in oklab, var(--dsw-alias-bg-layer-3) 96%, transparent);
        box-shadow: 0 8px 24px rgba(0,0,0,.22);
        color: var(--dsw-alias-label-primary);
        font-size: 11.5px; line-height: 1.45;
        backdrop-filter: blur(6px);
      }
      .dstm-tipTitle { font-size: 11.5px; font-weight: 600; margin-bottom: 5px; letter-spacing: .01em; }
      .dstm-tipRow { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 1px 0; }
      .dstm-tipRow.is-muted { color: var(--dsw-alias-label-secondary); }
      .dstm-tipKey { display: inline-flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-secondary); }
      .dstm-tipRow.is-muted .dstm-tipKey { color: inherit; }
      .dstm-tipDot { width: 7px; height: 7px; border-radius: 2px; flex: none; }
      .dstm-tipVal { flex: none; font-variant-numeric: tabular-nums; }
      .dstm-tipVal.is-strong { font-weight: 650; }
      .dstm-tipRule { height: 1px; margin: 5px 0; background: var(--dsw-alias-border-l1); }

      /* multi-series model trend */
      .dstm-modelCard .dstm-cardBody { padding-top: 8px; }
      .dstm-modelActions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }

      /* model picker */
      .dstm-picker { position: relative; }
      .dstm-pickerButton { box-sizing: border-box; height: 26px; padding: 0 10px; display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 7px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11.5px; line-height: 1; cursor: pointer; white-space: nowrap; }
      .dstm-pickerButton:hover, .dstm-pickerButton.is-open { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
      .dstm-pickerButton:focus-visible { outline: 2px solid var(--dstm-accent); outline-offset: 1px; }
      .dstm-pickerCaret { width: 0; height: 0; border-left: 3.5px solid transparent; border-right: 3.5px solid transparent; border-top: 4.5px solid currentColor; }
      .dstm-pickerMenu { position: absolute; top: calc(100% + 5px); right: 0; z-index: 20; width: 268px; max-height: 296px; overflow-y: auto; padding: 5px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; background: var(--dsw-alias-bg-layer-3); box-shadow: 0 10px 28px rgba(0,0,0,.24); }
      .dstm-pickerAll { width: 100%; height: 26px; margin-bottom: 3px; padding: 0 8px; border: 0; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11.5px; text-align: left; cursor: pointer; }
      .dstm-pickerAll:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
      .dstm-pickerRow { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 6px; font-size: 11.5px; cursor: pointer; }
      .dstm-pickerRow:hover { background: var(--dsw-alias-interactive-bg-hover); }
      .dstm-pickerRow input { flex: none; width: 13px; height: 13px; margin: 0; accent-color: var(--dstm-accent); cursor: pointer; }
      .dstm-pickerName { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dstm-pickerMeta { flex: none; font-size: 10.5px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
      .dstm-lineChart .dstm-chartMeta { align-items: flex-start; }
      .dstm-lineLegend { display: flex; flex-wrap: wrap; gap: 4px 6px; min-width: 0; }
      .dstm-lineKey { display: inline-flex; align-items: center; gap: 5px; max-width: 190px; padding: 2px 6px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11px; line-height: 1.3; cursor: pointer; }
      .dstm-lineKey:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
      .dstm-lineKey.is-off { opacity: .38; text-decoration: line-through; }
      .dstm-lineKeyText { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dstm-lineSwatch { width: 8px; height: 8px; border-radius: 2px; flex: none; }
      .dstm-linePlot { position: relative; flex: 1 1 auto; min-width: 0; height: 170px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
      .dstm-lineCursor { transition: left .1s ease-out; }
      .dstm-lineDot { transition: left .1s ease-out, top .1s ease-out; }
      .dstm-lineSvg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
      .dstm-lineSvg path { transition: opacity .18s ease; }
      .dstm-lineCursor { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--dsw-alias-border-l3); pointer-events: none; }
      .dstm-lineDot { position: absolute; width: 7px; height: 7px; margin: -3.5px 0 0 -3.5px; border-radius: 50%; box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-1); pointer-events: none; }

      .dstm-footer { display: flex; flex-direction: column; gap: 4px; padding-top: 2px; }
      .dstm-note { margin: 0; font-size: 11px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }

      @media (max-width: 1180px) {
        /* Five figures stop fitting on one row, so the band folds to three and
           then two; the borders follow the new column count. */
        .dstm-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .dstm-kpi:nth-child(3n + 1) { border-left: 0; }
        .dstm-kpi:nth-child(n + 4) { border-top: 1px solid var(--dsw-alias-border-l1); }
      }
      @media (max-width: 1080px) {
        .dstm-split { grid-template-columns: minmax(0, 1fr); }
        .dstm-skelRow { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 900px) {
        .dstm-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .dstm-kpi:nth-child(odd) { border-left: 0; }
        .dstm-kpi:nth-child(even) { border-left: 1px solid var(--dsw-alias-border-l1); }
        .dstm-kpi:nth-child(n + 3) { border-top: 1px solid var(--dsw-alias-border-l1); }
      }
      @media (max-width: 700px) {
        .dstm-inner, .dstm-stickyInner { padding-left: 14px; padding-right: 14px; }
        .dstm-inner { padding-bottom: 30px; }
        .dstm-title { font-size: 16px; }
        .dstm-kpiValue { font-size: 21px; }
        .dstm-kpis { grid-template-columns: minmax(0, 1fr); }
        .dstm-kpi { border-left: 0; border-top: 1px solid var(--dsw-alias-border-l1); }
        .dstm-kpi:first-child { border-top: 0; }
        .dstm-input { width: 100%; }
        .dstm-search { flex: 1 1 100%; }
        .dstm-filterCount { margin-left: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .dstm-statusDot.is-busy, .dstm-skelKpi, .dstm-skelCard { animation: none; }
        .dstm-barStack { transition: none; }
        .dstm-lineCursor, .dstm-lineDot, .dstm-lineSvg path { transition: none; }
      }
    `;

    /* ----------------------------------------------------------------- panel */

    function TokenPanel(props) {
      const t = typeof props.t === 'function' ? props.t : translate;
      const [range, setRange] = React.useState('all');
      const [metric, setMetric] = React.useState('cost');
      const [modelMetric, setModelMetric] = React.useState('tokens');
      // null means "the default top three"; an array is an explicit choice.
      const [modelPicked, setModelPicked] = React.useState(null);
      const [rankTab, setRankTab] = React.useState('provider');
      const [ticket, setTicket] = React.useState(0);
      const tip = useTooltip();

      const statsState = useStats(range, ticket);
      const data = statsState.status === 'ready' && statsState.data !== null && statsState.data.ok !== false ? statsState.data : null;
      const scanning = data !== null && data.phase === 'scanning';
      const progress = data === null ? null : data.progress;

      const refresh = () => setTicket(ticket + 1);

      // A different range can change which models exist, so an explicit selection
      // is dropped rather than left pointing at series that no longer ship.
      React.useEffect(() => {
        setModelPicked(null);
      }, [range]);

      const rankRows =
        data === null
          ? []
          : rankTab === 'provider'
            ? data.providers
            : rankTab === 'model'
              ? data.models
              : rankTab === 'session'
                ? data.sessions.map((row) => ({
                    key: row.id,
                    label: row.title,
                    cwd: row.cwd,
                    cost: row.cost,
                    calls: row.calls,
                  }))
                : data.workspaces;

      const rankName = (row) =>
        rankTab === 'session'
          ? row.label === null || row.label === undefined
            ? row.key.slice(0, 22)
            : row.label
          : rankTab === 'workspace'
            ? baseName(row.cwd) || '—'
            : row.key;
      const rankTitle = (row) => (rankTab === 'session' ? row.key : rankTab === 'workspace' ? row.cwd : row.key);
      const totalCost = data === null ? 0 : data.totals.cost;

      // A range that resolves to one calendar day gets an hourly axis.
      const singleDay = data !== null && Array.isArray(data.days) && data.days.length === 1;
      const totals = data === null ? null : data.totals;
      const tokenTotal = totals === null ? 0 : totals.tokenTotal;
      const share = (value) => (tokenTotal > 0 ? (value / tokenTotal) * 100 : 0);
      // Output speed survives the performance card inside the headline row, so
      // it is read from the same fold the card used to print.
      const perf = data === null || data.performance === null || data.performance === undefined ? {} : data.performance;
      const speedValue = typeof perf.tokensPerSecondAvg === 'number' && perf.tokensPerSecondAvg > 0 ? perf.tokensPerSecondAvg : null;
      const span =
        totals === null || !totals.firstCallAt
          ? ''
          : formatDay(totals.firstCallAt) + ' → ' + formatDay(totals.lastCallAt);

      return h(
        'div',
        { className: 'dstm-page' },
        h('style', null, CSS),
        h(
          'div',
          { className: 'dstm-sticky' },
          h(
            'div',
            { className: 'dstm-stickyInner' },
            h(
              'div',
              { className: 'dstm-headText' },
              h('div', { className: 'dstm-headIcon' }, h(Icon, { size: 17 })),
              h(
                'div',
                { className: 'dstm-titleWrap' },
                h('h1', { className: 'dstm-title' }, t('page.title')),
                h(
                  'p',
                  { className: 'dstm-subtitle' },
                  span === ''
                    ? t('page.subtitle')
                    : span + ' · ' + formatInt(totals.sessions) + ' ' + t('kpi.sessions'),
                ),
              ),
            ),
            h(
              'div',
              { className: 'dstm-actions' },
              h(Segmented, { value: range, onChange: setRange, options: RANGES, t }),
              h('button', { type: 'button', className: 'dstm-button', onClick: refresh }, t('action.refresh')),
            ),
          ),
        ),

        h(
          'div',
          { className: 'dstm-inner' },
          scanning && progress !== null
            ? h(
                'div',
                { className: 'dstm-status' },
                h('span', { className: 'dstm-statusDot is-busy' }),
                h('span', null, t('scan.scanning')),
                h('span', null, formatInt(progress.scanned) + ' / ' + formatInt(progress.total)),
                h(
                  'div',
                  { className: 'dstm-progress' },
                  h('div', {
                    className: 'dstm-progressFill',
                    style: { width: (progress.total === 0 ? 4 : Math.min(100, (progress.scanned / progress.total) * 100)) + '%' },
                  }),
                ),
                progress.failed > 0 ? h('span', null, t('scan.failed') + ' ' + formatInt(progress.failed)) : null,
              )
            : null,

          statsState.status === 'error'
            ? h(
                'div',
                { className: 'dstm-error' },
                h('div', { className: 'dstm-errorTitle' }, t('error.title')),
                h('div', { className: 'dstm-errorText' }, statsState.error),
                String(statsState.error).includes('404') ? h('div', { className: 'dstm-errorText' }, t('error.restart')) : null,
                h('button', { type: 'button', className: 'dstm-button', onClick: refresh }, t('error.retry')),
              )
            : null,

          data === null && statsState.status !== 'error' ? h(Skeleton) : null,

          data !== null
            ? h(
                'section',
                { className: 'dstm-kpis' },
                h(
                  'div',
                  { className: 'dstm-kpi' },
                  h('div', { className: 'dstm-kpiLabel' }, t('kpi.cost')),
                  h('div', { className: 'dstm-kpiValue' }, formatCny(totals.cost)),
                  h(
                    'div',
                    { className: 'dstm-kpiDetail' },
                    totals.saved > 0
                      ? h(React.Fragment, null,
                          h('b', null, t('kpi.saved') + ' ' + formatCny(totals.saved)),
                          totals.cost > 0 ? ' · ' + trim(totals.saved / totals.cost) + ' ' + t('kpi.savedTimes') : '',
                        )
                      : h('span', null, t('kpi.noCalls')),
                    totals.unpriced > 0 ? ' · ' + formatInt(totals.unpriced) + ' ' + t('kpi.unpriced') : '',
                  ),
                ),
                h(
                  'div',
                  { className: 'dstm-kpi' },
                  h('div', { className: 'dstm-kpiLabel' }, t('kpi.mix')),
                  h('div', { className: 'dstm-kpiValue' }, formatTokens(tokenTotal)),
                  h(
                    'div',
                    { className: 'dstm-mix' },
                    h('i', { className: 'dstm-mixSeg', style: { width: Math.max(0.5, share(totals.input)) + '%', background: 'var(--dstm-input)' } }),
                    h('i', { className: 'dstm-mixSeg', style: { width: Math.max(0.5, share(totals.cacheRead)) + '%', background: 'var(--dstm-cache)' } }),
                    h('i', { className: 'dstm-mixSeg', style: { width: Math.max(0.5, share(totals.output)) + '%', background: 'var(--dstm-output)' } }),
                  ),
                  h(
                    'div',
                    { className: 'dstm-mixKey' },
                    h('span', null, h('i', { className: 'dstm-dot', style: { background: 'var(--dstm-input)' } }), t('mix.input') + ' ' + formatTokens(totals.input)),
                    h('span', null, h('i', { className: 'dstm-dot', style: { background: 'var(--dstm-cache)' } }), t('mix.cache') + ' ' + formatTokens(totals.cacheRead)),
                    h('span', null, h('i', { className: 'dstm-dot', style: { background: 'var(--dstm-output)' } }), t('mix.output') + ' ' + formatTokens(totals.output)),
                  ),
                ),
                h(
                  'div',
                  { className: 'dstm-kpi' },
                  h('div', { className: 'dstm-kpiLabel' }, t('kpi.hit')),
                  h('div', { className: 'dstm-kpiValue' }, (totals.hitRate * 100).toFixed(1), h('small', null, '%')),
                  h(
                    'div',
                    { className: 'dstm-kpiDetail' },
                    formatTokens(totals.cacheRead) + ' / ' + formatTokens(totals.input + totals.cacheRead + totals.cacheWrite),
                  ),
                ),
                h(
                  'div',
                  { className: 'dstm-kpi' },
                  h('div', { className: 'dstm-kpiLabel' }, t('kpi.calls')),
                  h('div', { className: 'dstm-kpiValue' }, formatInt(totals.calls)),
                  h(
                    'div',
                    { className: 'dstm-kpiDetail' },
                    formatInt(totals.sessions) + ' ' + t('kpi.sessions') +
                      (totals.subagentSessions > 0 ? ' · ' + formatInt(totals.subagentSessions) + ' ' + t('kpi.subagents') : '') +
                      ' · ' + t('kpi.avgCost') + ' ' + formatCny(totals.calls > 0 ? totals.cost / totals.calls : 0),
                  ),
                ),
                h(
                  'div',
                  { className: 'dstm-kpi' },
                  h('div', { className: 'dstm-kpiLabel' }, t('kpi.speed')),
                  h(
                    'div',
                    { className: 'dstm-kpiValue' },
                    speedValue === null ? '—' : speedValue.toFixed(1),
                    speedValue === null ? null : h('small', null, ' t/s'),
                  ),
                  h(
                    'div',
                    { className: 'dstm-kpiDetail' },
                    speedValue === null
                      ? t('perf.noTiming')
                      : t('kpi.speedUnit') + ' · ' + t('kpi.speedSamples') + ' ' + formatInt(perf.latencySamples || 0),
                  ),
                ),
              )
            : null,

          data !== null
            ? h(
                'div',
                { className: 'dstm-split' },
                h(
                  'div',
                  { className: 'dstm-col' },
                  h(
                    Card,
                    {
                      title: singleDay
                        ? (metric === 'cost' ? t('chart.hourlyTitle') : t('chart.hourlyTitleTokens'))
                        : (metric === 'cost' ? t('chart.title') : t('chart.titleTokens')),
                      subtitle: singleDay
                        ? t('chart.hourlySub')
                        : (metric === 'cost' ? t('chart.sub') : t('chart.subTokens')),
                      actions: h(Segmented, {
                        value: metric,
                        onChange: setMetric,
                        t,
                        compact: true,
                        options: [
                          { id: 'cost', label: 'chart.cost' },
                          { id: 'tokens', label: 'chart.tokens' },
                        ],
                      }),
                    },
                    h(TrendChart, { days: data.days, hours: data.hours, metric, t, tip }),
                  ),
                  h(Card, { title: t('rhythm.title'), subtitle: t('rhythm.sub') }, h(RhythmGrid, { rhythm: data.rhythm, t, tip })),
                ),
                h(
                  'div',
                  { className: 'dstm-col' },
                  h(
                    Card,
                    {
                      title: t('rank.title'),
                      actions: h(Segmented, {
                        value: rankTab,
                        onChange: setRankTab,
                        t,
                        compact: true,
                        options: [
                          { id: 'provider', label: 'rank.provider' },
                          { id: 'model', label: 'rank.model' },
                          { id: 'session', label: 'rank.session' },
                          { id: 'workspace', label: 'rank.workspace' },
                        ],
                      }),
                    },
                    h(RankDonut, {
                      rows: rankRows,
                      nameOf: rankName,
                      titleOf: rankTitle,
                      totalCost,
                      empty: t('rank.empty'),
                      t,
                      tip,
                    }),
                  ),
                  h(
                    Card,
                    { title: t('peaks.title'), subtitle: t('peaks.sub') },
                    h(PeakSplit, { peaks: data.peaks, totals, t, tip }),
                  ),

                ),
              )
            : null,


          data !== null
            ? h(
                Card,
                {
                  title: t('model.title'),
                  subtitle: t('model.sub'),
                  className: 'dstm-modelCard',
                  actions: h(
                    'div',
                    { className: 'dstm-modelActions' },
                    h(ModelPicker, {
                      rows: data.modelSeries,
                      selected: modelPicked,
                      onChange: setModelPicked,
                      t,
                    }),
                    h(Segmented, {
                      value: modelMetric,
                      onChange: setModelMetric,
                      t,
                      compact: true,
                      options: [
                        { id: 'tokens', label: 'chart.tokens' },
                        { id: 'share', label: 'chart.share' },
                        { id: 'cost', label: 'chart.cost' },
                      ],
                    }),
                  ),
                },
                h(ModelTrend, {
                  days: data.days,
                  models: data.modelSeries,
                  metric: modelMetric,
                  selected: modelPicked,
                  onSelectionChange: setModelPicked,
                  t,
                  tip,
                }),
              )
            : null,

          h(
            'footer',
            { className: 'dstm-footer' },
            h('p', { className: 'dstm-note' }, t('note.scope')),
            h('p', { className: 'dstm-note' }, t('note.pricing')),
          ),
          h(TooltipLayer, { tip: tip.tip }),
        ),
      );
    }

    /* ----------------------------------------------------------------- apply */

    function apply(ctx) {
      clientCtx = ctx;
      try {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'token-meter: dictionaries');
        translate = ctx.locale.bind(NS);
      } catch (error) {
        console.error('token-meter: dictionary registration failed', error);
      }

      const register = (slot, options, component) => {
        try {
          ctx.slots.inject(slot, () => ctx.slots.register(options, component));
        } catch (error) {
          // One unavailable slot must not take the rest of the plugin down.
          console.error('token-meter: could not register into ' + slot, error);
        }
      };

      register(
        'sidebar.panellist',
        {
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 45,
          label: () => translate('panel.label'),
        },
        Icon,
      );

      register(
        'main',
        {
          name: 'main',
          key: PANEL_ID,
          inject: () => ({ t: translate }),
        },
        TokenPanel,
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply,
    };
  },
});

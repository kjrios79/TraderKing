import { DerivConnection } from './deriv.js?v=3.1.67';
import { ChartManager } from './chart.js?v=3.1.67';
import { Indicators } from './indicators.js?v=3.1.67';

const V = "3.1.98";

// -- Device Identity Optimization V3.1.72 --
let instanceId = localStorage.getItem('tk_instance_id') || ('TK-' + Math.random().toString(36).substr(2, 9).toUpperCase());
localStorage.setItem('tk_instance_id', instanceId);
let deviceName = localStorage.getItem('tk_device_name') || 'Main PC';
localStorage.setItem('tk_device_name', deviceName);

const formatCurrency = (val) => {
  // Robust currency formatter: strip any existing $ and parse the number safely
  if (typeof val === 'string') val = val.replace(/[$,]/g, '');
  return `$${parseFloat(val || 0).toFixed(2)}`;
};
const num = (v) => parseFloat(v || 0).toFixed(2);
let latestAIAnalysis = `<div style="margin-top:5px; border-top:1px solid #333; padding-top:5px;">AI: <span style="color:#848e9c">Scanning...</span></div>`;

// -- UI Selectors --
const logsPanel = document.getElementById('logs-panel');
const historyBody = document.getElementById('history-body');
const marketSelect = document.getElementById('market-select');
const oracleRecEl = document.getElementById('oracle-recommendation');
const tickEl = document.getElementById('current-tick-overlay');
const candleCountdownEl = document.getElementById('candle-countdown');
const balanceEl = document.getElementById('balance');
const accIdEl = document.getElementById('acc-id');
const tradeTimerEl = document.getElementById('trade-timer-overlay');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnConnect = document.getElementById('btn-connect');
const pulseIndicator = document.getElementById('system-pulse');

// Strategy Toggles
const checkEmas = document.getElementById('strat-emas');
const checkGiraffa = document.getElementById('strat-giraffa');
const checkSafari = document.getElementById('strat-safari');
const checkXFast = document.getElementById('strat-xfast');
const checkSniper = document.getElementById('strat-sniper');
const checkOlymp = document.getElementById('strat-olymp');
const checkAutoScale = document.getElementById('strat-autoscale');
const checkRequireAll = document.getElementById('strat-require-all');
const checkManualMode = document.getElementById('manual-mode-enabled');
const btnManualCall = document.getElementById('btn-manual-call');
const btnManualPut = document.getElementById('btn-manual-put');
const checkSequential = document.getElementById('sequential-mode');
const checkSafetyCircuit = document.getElementById('safety-circuit-enabled');
const inputMaxLosses = document.getElementById('max-losses');
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.querySelector('aside');

// -- Global State --
let connection = null;
let botRunning = false;
let tradeInProgress = false;
let lastTradeStartTime = 0; // V3.1.95: For Freeze Protection
let isAuthorized = false;
let currentStake = 1.0;
// SAFETY: Force clean numeric initialization
if (typeof currentStake !== 'number' || isNaN(currentStake)) {
  currentStake = 1.0;
  console.warn('TraderKing: currentStake was corrupted, reset to 1.0');
}
let currentLevel = 1;
let chartManager = null;
let tickCount = 0;
let lastCandleTime = 0;
let lastTradeCandleTime = 0;
let currentBalance = 0;
let consecutiveLosses = 0;
let pauseUntil = 0; // Safety Circuit Timestamp
let activeTradeEndTime = 0;
let tradeTimerInterval = null;
let pendingRowsQueue = []; // V3.1.60: FIFO Queue for race-free row linking
const myLocalContractIds = new Set(); // V3.1.60: Strictly local tracking
const mySyncedContractIds = new Set(); // V3.1.60: Universal tracking

// -- Pending Trade Tracking (V3.1.57 Restoration) --
let lastPendingTradeRow = null;
let tradeStartTime = 0; // Track trade start for timeout protection

// -- Sniper Patience Module -- 🐢 OWL
let sniperCooldown = 0;
let sniperNeedsPullback = false;
let sniperLastTradeDir = null;

// -- Sniper Cognition (AI Learning) -- 🧠
let dynamicSelectivity = 1.0; // 1.0 = Normal, 1.2+ = High Precision
class SniperCognition {
  constructor() {
    this.winKey = 'tk_sniper_wins';
    this.lossKey = 'tk_sniper_losses';
    this.wins = this.load(this.winKey);
    this.losses = this.load(this.lossKey);
  }

  load(key) {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  }

  save() {
    localStorage.setItem(this.winKey, JSON.stringify(this.wins));
    localStorage.setItem(this.lossKey, JSON.stringify(this.losses));
  }

  recordWin(snapshot) {
    this.wins.unshift(snapshot);
    if (this.wins.length > 50) this.wins.pop();
    this.save();
    log(`AI: Victory Pattern Indexed (${this.wins.length}) 🧠`, 'success');
  }

  recordLoss(snapshot) {
    this.losses.unshift(snapshot);
    if (this.losses.length > 30) this.losses.pop();
    this.save();
    log(`AI: Caution Pattern Indexed (${this.losses.length}) ⚠️`, 'warning');
  }

  calculateSimilarity(current, category = 'wins') {
    const patterns = category === 'wins' ? this.wins : this.losses;
    if (patterns.length === 0) return 0;
    let maxScore = 0;
    patterns.forEach(p => {
      const rsiDiff = Math.abs(current.rsi - p.rsi);
      const adxDiff = Math.abs(current.adx - p.adx);
      const gapDiff = Math.abs(current.gap - p.gap);
      const rsiScore = Math.max(0, 100 - (rsiDiff * 4));
      const adxScore = Math.max(0, 100 - (adxDiff * 4));
      const gapScore = Math.max(0, 100 - (gapDiff * 1000));
      const total = (rsiScore * 0.3) + (adxScore * 0.3) + (gapScore * 0.4);
      if (total > maxScore && current.type === p.type) maxScore = total;
    });
    return maxScore;
  }
}

const AI_Library = new SniperCognition();

// -- PERSISTENCE MODULE V3.1.84 --
const configKeys = [
  'market-select', 'stake', 'compound-enabled', 'compound-levels', 'duration', 'duration-unit',
  'max-losses', 'strat-emas', 'strat-giraffa', 'strat-safari', 'strat-xfast', 'strat-sniper',
  'strat-olymp', 'strat-autoscale', 'strat-require-all', 'sequential-mode', 'safety-circuit-enabled',
  'device-name-input', 'app-id', 'api-token'
];

function saveSettings() {
  const config = {};
  configKeys.forEach(id => {
    const el = document.getElementById(id);
    if (el) config[id] = el.type === 'checkbox' ? el.checked : el.value;
  });

  // V3.1.84: Sync state with UI immediately
  const stakeInput = document.getElementById('stake');
  if (stakeInput && currentLevel === 1) currentStake = parseFloat(stakeInput.value) || 1.0;

  const dNameInput = document.getElementById('device-name-input');
  if (dNameInput) {
    deviceName = dNameInput.value || 'Main PC';
    localStorage.setItem('tk_device_name', deviceName);
  }

  localStorage.setItem('tk_config', JSON.stringify(config));
  if (typeof updateSummaryPanel === 'function') updateSummaryPanel();
}

function loadSettings() {
  const saved = localStorage.getItem('tk_config');
  if (!saved) return;
  try {
    const config = JSON.parse(saved);
    configKeys.forEach(id => {
      const el = document.getElementById(id);
      if (el && config[id] !== undefined) {
        if (el.type === 'checkbox') el.checked = config[id];
        else el.value = config[id];
      }
    });

    // V3.1.86: Sync Initial State + UI Refresh
    const stakeInput = document.getElementById('stake');
    if (stakeInput) {
      const sVal = parseFloat(stakeInput.value.replace(',', '.')) || 1.0;
      if (currentLevel === 1) currentStake = sVal;
    }

    // Trigger UI updates for dependent fields
    const compoundTog = document.getElementById('compound-enabled');
    if (compoundTog) {
      const lvInput = document.getElementById('compound-levels');
      if (lvInput) lvInput.disabled = !compoundTog.checked;
    }

    const dNameInput = document.getElementById('device-name-input');
    if (dNameInput && config['device-name-input']) {
      deviceName = config['device-name-input'];
      localStorage.setItem('tk_device_name', deviceName);
    }

    log('Configuration Restored from Storage. 🛡️', 'success');
  } catch (e) { console.error("Config Load Error", e); }
}

let lastSnapshot = null;
let botStartTime = Date.now();
let lastBalanceUpdate = Date.now();

// -- Core Helpers --
function log(msg, type = 'info') {
  if (!logsPanel) return;
  const time = new Date().toLocaleTimeString([], { hour12: false });
  if (msg.includes('Master Pulse')) {
    const oldPulses = Array.from(logsPanel.childNodes).filter(node => node.textContent && node.textContent.includes('Master Pulse'));
    oldPulses.forEach(node => logsPanel.removeChild(node));
  }
  const div = document.createElement('div');
  div.className = `log-entry log-${type}`;
  div.innerHTML = `<span class="log-time">[${time}]</span> ${msg}`;
  logsPanel.appendChild(div);
  logsPanel.scrollTop = logsPanel.scrollHeight;
  if (logsPanel.children.length > 400) logsPanel.removeChild(logsPanel.firstChild);
}

function updateBotUI() {
  if (botRunning) {
    btnStart.style.display = 'none';
    btnStop.style.display = 'block';
    if (pulseIndicator) pulseIndicator.style.display = 'inline';
    let activeModes = [];
    if (checkEmas.checked) activeModes.push("EMA");
    if (checkGiraffa.checked) activeModes.push("Giraffa");
    if (checkSafari.checked) activeModes.push("Safari");
    if (checkXFast.checked) activeModes.push("X-FAST");
    if (checkSniper.checked) activeModes.push("Sniper");
    if (checkOlymp.checked) activeModes.push("Olymp");
    const modeList = activeModes.length > 0 ? activeModes.join(' + ') : 'Standby';
    log(`Final-Evo v${V} Active. Engine: [${modeList}] 💓`, 'info');
  } else {
    btnStart.style.display = 'block';
    btnStop.style.display = 'none';
    if (pulseIndicator) pulseIndicator.style.display = 'none';
    log('Bot Engine Paused.', 'info');
  }
}

function resetConnectionState() {
  isAuthorized = false;
  botRunning = false;
  updateBotUI();
  btnConnect.textContent = 'Connect';
  btnConnect.disabled = false;
  btnConnect.style.background = '#f0b90b';
  btnConnect.style.color = '#1e2329';
  if (accIdEl) accIdEl.textContent = '...';
  if (balanceEl) balanceEl.textContent = '...';
  if (chartManager) chartManager.clear();
  log('Gateway Terminated.', 'info');
}

// -- Initialization & Event Listeners --
const backdrop = document.getElementById('mobile-backdrop');
if (menuToggle && sidebar) {
  menuToggle.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('active');
      if (backdrop) backdrop.classList.toggle('active');
    } else {
      sidebar.classList.toggle('collapsed');
      setTimeout(() => {
        if (chartManager && chartManager.chart) {
          chartManager.chart.applyOptions({
            width: chartManager.container.clientWidth - 50,
            height: chartManager.container.clientHeight,
          });
        }
      }, 320);
    }
  });
}

if (backdrop) {
  backdrop.addEventListener('click', () => {
    sidebar.classList.remove('active');
    backdrop.classList.remove('active');
  });
}

btnConnect.addEventListener('click', async () => {
  if (isAuthorized) {
    if (connection) connection.disconnect();
    resetConnectionState();
    return;
  }
  const appId = document.getElementById('app-id').value;
  const token = document.getElementById('api-token').value;
  if (!token) return log('API Token Required.', 'error');
  btnConnect.textContent = 'Master Auth...';
  btnConnect.disabled = true;
  log(`Initializing High-Speed Protocol...`, 'info');
  connection = new DerivConnection(appId, token);
  const formData = new FormData();
  formData.append('app_id', appId);
  formData.append('token', token);
  fetch('/api/user_config.php', { method: 'POST', body: formData });
  await connection.connect();
  connection.on('open', () => {
    log('Protocol Open. Authenticating...', 'success');
    connection.authorize(token);
  });
  connection.on('authorize', (data) => {
    log(`Identity Recognized: ${data.loginid}`, 'success');
    isAuthorized = true;
    btnConnect.disabled = false;
    btnConnect.textContent = 'Disconnect';
    btnConnect.style.background = '#f6465d';
    btnConnect.style.color = 'white';
    if (balanceEl) balanceEl.textContent = `${data.currency} ${num(data.balance)}`;
    currentBalance = parseFloat(data.balance);
    if (accIdEl) accIdEl.textContent = data.loginid;
    setTimeout(() => {
      if (connection && isAuthorized) {
        connection.subscribeBalance();
        connection.subscribeContracts();
        connection.getHistory(marketSelect.value);
        connection.subscribeTicks(marketSelect.value);
        updateMarketOracle(); // Initial recommendation
        log('Strategic Market Sync Established.', 'success');
      }
    }, 700);
  });
  connection.on('balance', (data) => {
    if (balanceEl) balanceEl.textContent = `${data.currency} ${num(data.balance)}`;
    currentBalance = parseFloat(data.balance);
    lastBalanceUpdate = Date.now(); // Watchdog Heartbeat
    updateSummaryPanel();
  });
  connection.on('contract', (data) => {
    handleContractResult(data);
  });
  connection.on('history', (data) => {
    // V3.1.69: Smart History Handling
    // Only wipe/reset chart if we receive a substantial amount of data (full sync)
    // Small updates (like the 15-candle heartbeat) won't trigger a chart reset to avoid "spikes".
    if (data.length > 50) {
      if (chartManager) chartManager.setHistory(data);
      log(`History Restored: ${data.length} candles indexed.`, 'success');
    } else {
      // For small heartbeat syncs, we just log it. (Data is already updated via ticks)
      if (tickCount % 20 === 0) log(`Heartbeat Sync: ${data.length} candles verified.`, 'info');
    }
    setTimeout(() => analyzeMarket(), 1000);
  });
  connection.on('error', (err) => {
    if (err.message && err.message.includes('already subscribed')) return; // Silenced V3.1.95
    log(`Master Alert: ${err.message}`, 'error');

    // RECOVERY LOGIC V3.1.61: Handle Rate Limits or Rejections
    if (tradeInProgress) {
      log(`RECOVERY TRIGGERED: Resetting state after disruption. 🛡️`, 'warning');
      tradeInProgress = false;
      currentSequenceContractId = null;

      if (tradeTimeout) { clearTimeout(tradeTimeout); tradeTimeout = null; }
      if (tradeTimerInterval) { clearInterval(tradeTimerInterval); tradeTimerInterval = null; }
      if (tradeTimerEl) tradeTimerEl.style.display = 'none';

      // Settle the oldest pending row in queue as REJECTED
      let row = pendingRowsQueue.shift();
      if (!row) row = historyBody.querySelector('tr.trade-pending'); // Fallback to oldest pending in DOM

      if (row) {
        log(`RECOVERY: Settling row as REJECTED. 🛡️`, 'warning');
        const cell = row.cells[5];
        if (cell) cell.innerHTML = `<span class="res-rejected" style="color: #ff9800; font-weight: bold;">REJECTED / ERROR</span>`;
        row.classList.remove('trade-pending');
        saveTradeToDB({
          contract_id: 'ERR_' + Date.now(),
          strategy: row.cells[0].textContent,
          market: row.cells[2].textContent,
          type: row.cells[3].textContent,
          stake: parseFloat(row.cells[4].textContent.replace('$', '')),
          status: 'REJECTED'
        });
      }
    }

    if (!isAuthorized) {
      btnConnect.disabled = false;
      btnConnect.textContent = 'Connect';
    }
  });
  connection.on('tick', (tick) => {
    const quote = parseFloat(tick.quote);
    if (tickEl) tickEl.textContent = quote.toFixed(2);
    if (chartManager) chartManager.onTick(tick);

    // Sync local time with server epoch for the smooth global timer
    lastServerTime = tick.epoch;
    lastTickLocalTime = Date.now();

    const isSequentialReq = document.getElementById('sequential-mode').checked;

    // V3.1.95: Life Circuit (Freeze Protection)
    // If a trade is stuck for more than 120 seconds, we release the lock.
    if (tradeInProgress && lastTradeStartTime > 0 && (Date.now() - lastTradeStartTime > 120000)) {
      log('LIFE CIRCUIT: Trade timeout detected. Releasing lock... 🛠️🔓', 'warning');
      tradeInProgress = false;
      lastTradeStartTime = 0;
    }

    // V3.1.82: Unified Global Sync Gate
    // V3.1.98: Precision Entry Window (0.5s to 4.0s)
    // We give the candle a few seconds to "show its strength" before committing.
    const candleSeconds = (lastServerTime % 60);
    const isStartOfCandle = candleSeconds >= 0.5 && candleSeconds <= 4.0;

    if (botRunning && isAuthorized) {
      tickCount++;

      const data = chartManager.getLatestIndicators();
      if (!data) return;

      // V3.1.97: Global Momentum Calculation
      const last10Bodies = chartManager.allCandles.slice(-11, -1).map(c => Math.abs(c.close - c.open));
      const avgBodySize = last10Bodies.length > 0 ? (last10Bodies.reduce((a, b) => a + b, 0) / last10Bodies.length) : 0;
      const currentPush = (parseFloat(data.lastPrice) - parseFloat(data.lastCandle.open));
      const MIN_PUSH_THRESHOLD = avgBodySize * 0.08; // Reduced V3.1.98 (8% of avg candle)

      if (tickCount % 30 === 0 && (Date.now() - lastBalanceUpdate > 60000)) {
        log('WATCHDOG: Balance stale. Re-syncing... 🔄', 'warning');
        connection.send({ balance: 1, subscribe: 1 });
        lastBalanceUpdate = Date.now();
      }

      if (isSequentialReq ? !tradeInProgress : true) {
        const isEmaActive = checkEmas && checkEmas.checked;
        const isGiraffaActive = checkGiraffa && checkGiraffa.checked;
        const isSafariActive = checkSafari && checkSafari.checked;
        const isXFastActive = checkXFast && checkXFast.checked;
        const isSniperActive = checkSniper && checkSniper.checked;
        const isOlympActive = checkOlymp && checkOlymp.checked;
        const requireAll = checkRequireAll && checkRequireAll.checked;
        const signals = [];

        const recentlyTraded = lastTradeCandleTime !== 0 && (lastServerTime < lastTradeCandleTime + 60);
        const levelBoost = (currentLevel > 1) ? (currentLevel - 1) * 0.35 : 0;
        const totalSelectivity = dynamicSelectivity + levelBoost;

        // V3.1.97: Momentum Pulse Validation
        const isBullishPush = (currentPush > MIN_PUSH_THRESHOLD);
        const isBearishPush = (currentPush < -MIN_PUSH_THRESHOLD);

        if (tickCount % 15 === 0) {
          log(`Master Pulse 💓 RSI: ${data.rsi.toFixed(1)} | ZS: ${data.zScore.toFixed(1)} | Push: ${(currentPush * 1000).toFixed(2)}`, 'info');
        }

        // --- Safety Circuit Pause ---
        if (checkSafetyCircuit.checked && Date.now() < pauseUntil) return;

        // 1. SNIPER
        if (isSniperActive && isStartOfCandle && !recentlyTraded) {
          const isCall = (data.lastPrice < data.bollinger.lower && data.rsi < (30 / totalSelectivity) && data.smc === "Alcista");
          const isPut = (data.lastPrice > data.bollinger.upper && data.rsi > (70 * totalSelectivity) && data.smc === "Bajista");
          if (isCall && isBullishPush) signals.push({ type: 'CALL', source: 'SNIPER' });
          else if (isPut && isBearishPush) signals.push({ type: 'PUT', source: 'SNIPER' });
        }

        // 2. OLYMP / WYSETRADE
        if (isOlympActive && isStartOfCandle && !recentlyTraded) {
          const olympSignal = Indicators.detectOlympRejection(chartManager.allCandles, data.ema36, data.ema51, data.sma20, data.bollinger, data.rsi);
          if (olympSignal && olympSignal !== "NONE") {
            const type = olympSignal.includes("CALL") ? 'CALL' : 'PUT';
            if ((type === 'CALL' && isBullishPush) || (type === 'PUT' && isBearishPush)) signals.push({ type, source: 'WYSETRADE' });
          }
        }

        // 3. EMA/SMA
        if (isEmaActive && data.crossover && isStartOfCandle) {
          if (data.crossover === "UP" && isBullishPush) signals.push({ type: 'CALL', source: 'EMA/SMA' });
          else if (data.crossover === "DOWN" && isBearishPush) signals.push({ type: 'PUT', source: 'EMA/SMA' });
        }

        // 4. GIRAFFA 2.0
        if (isGiraffaActive && data.fibo && isStartOfCandle) {
          if (data.adx > 20 && data.emaProximity) {
            if (data.fibo === 'CALL' && isBullishPush) signals.push({ type: 'CALL', source: 'GIRAFFA' });
            else if (data.fibo === 'PUT' && isBearishPush) signals.push({ type: 'PUT', source: 'GIRAFFA' });
          }
        }

        // 5. SAFARI
        if (isSafariActive && isStartOfCandle) {
          const gap = (totalSelectivity - 1.0) * 8;
          if (data.safariTrend === "Alcista" && data.smc === "Alcista" && data.rsiLaguerre > (70 + gap) && isBullishPush) signals.push({ type: 'CALL', source: 'SAFARI' });
          else if (data.safariTrend === "Bajista" && data.smc === "Bajista" && data.rsiLaguerre < (30 - gap) && isBearishPush) signals.push({ type: 'PUT', source: 'SAFARI' });
        }

        // 6. X-FAST
        if (isXFastActive && data.bollinger && isStartOfCandle) {
          const Z_THRESHOLD = 0.8 + ((totalSelectivity - 1.0) * 0.4);
          const rsi7 = Indicators.calculateRSI(chartManager.getCloses(), 7);
          if (data.zScore > Z_THRESHOLD && rsi7 > 60 && isBullishPush) signals.push({ type: 'CALL', source: 'X-FAST' });
          else if (data.zScore < -Z_THRESHOLD && rsi7 < 40 && isBearishPush) signals.push({ type: 'PUT', source: 'X-FAST' });
        }

        // --- DISPATCH ---
        if (signals.length > 0) {
          if (requireAll) {
            const activeCount = (isEmaActive ? 1 : 0) + (isGiraffaActive ? 1 : 0) + (isSafariActive ? 1 : 0) + (isXFastActive ? 1 : 0) + (isSniperActive ? 1 : 0) + (isOlympActive ? 1 : 0);
            if (signals.length === activeCount && signals.every(s => s.type === signals[0].type)) {
              handleTrade(signals[0].type, signals.map(s => s.source).join('+'));
            }
          } else {
            handleTrade(signals[0].type, signals[0].source);
          }
        }
      }
    }
  });
});

btnStart.addEventListener('click', () => {
  if (connection && isAuthorized) { botRunning = true; updateBotUI(); }
  else log('Security Protocol Denied.', 'error');
});

btnStop.addEventListener('click', () => { botRunning = false; updateBotUI(); });

marketSelect.addEventListener('change', () => {
  if (connection && isAuthorized) {
    chartManager.clear();
    connection.forgetAll('ticks');
    setTimeout(() => {
      connection.getHistory(marketSelect.value);
      connection.subscribeTicks(marketSelect.value);
      log(`Market Target Updated: ${marketSelect.value}`, 'info');
    }, 500);
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'compound-enabled') document.getElementById('compound-levels').disabled = !e.target.checked;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') saveSettings();
});

// -- Trade Logic --
let currentSequenceContractId = null;
const myContractIds = new Set();
let tradeTimeout = null;

function getDynamicBaseStake() {
  const stakeEl = document.getElementById('stake');
  if (!stakeEl) return 1.0;
  // Robust parsing for comma/dot separators
  let stakeVal = parseFloat(stakeEl.value.replace(',', '.')) || 1.0;

  if (checkAutoScale && checkAutoScale.checked && currentBalance >= 100) {
    const scaledStake = Math.floor(currentBalance / 100) * 10;
    if (scaledStake > stakeVal) stakeVal = scaledStake;
  }
  return stakeVal;
}

function handleTrade(type, source = "Manual", isManual = false) {
  if (tradeTimeout) clearTimeout(tradeTimeout);

  // Mark this candle as traded to enforce cooldown
  lastTradeCandleTime = Math.floor(lastServerTime / 60) * 60;

  const baseStake = getDynamicBaseStake();

  if (currentLevel === 1) currentStake = baseStake;
  if (!document.getElementById('compound-enabled').checked) {
    currentStake = baseStake;
    currentLevel = 1;
  }
  const market = marketSelect.value;
  tradeInProgress = true;

  // Chart Sync V3.1.98: Anchor to end on trade
  if (chartManager && chartManager.chart) {
    chartManager.chart.timeScale().scrollToPosition(0, true);
  }
  lastTradeStartTime = Date.now(); // V3.1.95
  currentSequenceContractId = 'PENDING';
  log(`DISPATCHING ORDER: ${type} @ $${currentStake.toFixed(2)} (${source})`, 'success');
  const data = chartManager.getLatestIndicators();
  const adx = Indicators.calculateADX(chartManager.allCandles.map(c => c.high), chartManager.allCandles.map(c => c.low), chartManager.allCandles.map(c => c.close), 14);

  // V3.1.96: Full Telemetry Snapshot
  const snapshot = data ? {
    rsi: data.rsi,
    adx: adx,
    zScore: data.zScore,
    fibo: data.fibo618,
    emaGap: Math.abs(data.ema - data.sma) / data.lastPrice,
    trend: data.trend,
    time: new Date().toISOString()
  } : null;
  lastSnapshot = snapshot;

  let duration = parseInt(document.getElementById('duration').value) || 1;
  let durationUnit = document.getElementById('duration-unit').value || 't';

  // Sniper & Olymp Global Duration Sync (1 Minute Force)
  // If not manual, we ALWAYS force 1 minute for all automatic strategies
  if (!isManual) {
    duration = 1;
    durationUnit = 'm';
    log(`STRATEGY SYNC: [${source}] Forced to 1 Minute Duration. ⏳`, 'info');
  } else {
    log(`MANUAL TRADE: Using UI Settings (${duration}${durationUnit}). 🖐️`, 'info');
  }

  // Active Trade Timer Setup
  if (durationUnit !== 't' && tradeTimerEl) {
    const seconds = durationUnit === 'm' ? duration * 60 : duration;
    activeTradeEndTime = Date.now() + (seconds * 1000);
    if (tradeTimerEl) {
      tradeTimerEl.style.display = 'block';
      tradeTimerEl.style.zIndex = '9999'; // Ensure visibility
      if (tradeTimerInterval) clearInterval(tradeTimerInterval);
      tradeTimerInterval = setInterval(() => {
        const remaining = Math.max(0, Math.round((activeTradeEndTime - Date.now()) / 1000));
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        tradeTimerEl.textContent = `TRADE: ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        if (remaining <= 0) {
          clearInterval(tradeTimerInterval);
          tradeTimerEl.style.display = 'none';
        }
      }, 1000);
    }
  } else if (tradeTimerEl) {
    tradeTimerEl.style.display = 'none';
  }

  log(`BUY DISPATCH: ${market} | ${duration}${durationUnit} | ${formatCurrency(currentStake)}`, 'info');
  connection.buy({ amount: currentStake.toFixed(2), contract_type: type, symbol: market, duration, duration_unit: durationUnit });
  const row = addHistoryRow(source, market, type, currentStake);
  if (snapshot) row.dataset.indicators = JSON.stringify(snapshot); // Attach telemetry to row V3.1.96
  lastPendingTradeRow = row; // Track for recovery
  tradeStartTime = Date.now(); // Track start time for timeout protection
  pendingRowsQueue.push(row);

  // REMOVED: saveTradeToDB with PENDING_... temp ID to avoid duplicates.
  // The real contract_id will be saved by handleContractResult as soon as 'buy' or 'proposal_open_contract' returns it.

  // V3.1.75: Protected Execution Latch
  const activeContractId = currentSequenceContractId;
  const lockReleaseMs = (durationUnit === 'm' ? duration * 60 : duration) * 1000 + 45000;
  setTimeout(() => {
    // V3.1.80: Panic Reset Logic
    if (tradeInProgress && (currentSequenceContractId === activeContractId || currentSequenceContractId === 'PENDING')) {
      log(`LATCH: Execution lock released (Panic Reset). Precision Buffed. 🛡️`, 'error');
      tradeInProgress = false;
      currentSequenceContractId = null; // FORCE CLEAR for next entries
      dynamicSelectivity = Math.min(1.2, dynamicSelectivity + 0.05);
      updateSummaryPanel();

      // Cleanup UI if still pending
      if (row && row.classList.contains('trade-pending')) {
        const cell = row.cells[5];
        if (cell) cell.innerHTML = `<span style="color:#848e9c; font-size:0.65rem;">TIMEOUT / SYNC LOSS</span>`;
        row.classList.remove('trade-pending');
      }
    }
  }, lockReleaseMs);

  // Safety cleanup for UI (5 mins)
  const timeoutMs = (durationUnit === 'm' ? duration * 60 : duration) * 1000 + 300000;
  setTimeout(() => {
    if (row && row.classList.contains('trade-pending')) {
      const cell = row.cells[5];
      if (cell) cell.innerHTML = `<span style="color:#848e9c; font-size:0.65rem;">Check Hist (Timeout)</span>`;
      row.classList.remove('trade-pending');
      // If the lock was STILL held by THIS specific trade, release it
      if (tradeInProgress && currentSequenceContractId === activeContractId) {
        tradeInProgress = false;
        currentSequenceContractId = null;
      }
    }
  }, timeoutMs);
}

function handleContractResult(data) {
  const contractId = data.contract_id ? String(data.contract_id) : null;
  if (!contractId) return;

  // 1. Identification (V3.1.60: Differentiate Local vs Outer)
  const isPreviouslyTracked = mySyncedContractIds.has(contractId);
  if (!isPreviouslyTracked) {
    mySyncedContractIds.add(contractId);
    if (connection && connection.subscribeSpecificContract) {
      connection.subscribeSpecificContract(contractId);
      log(`SPECIFIC SYNC: Contract ${contractId} subscribed. 📡`, 'info');
    }
  }

  // 2. Row Linking (V3.1.60: Strict FIFO for Local Trades)
  let row = document.querySelector(`tr[data-contract-id="${contractId}"]`);

  if (!row) {
    // If it's a new ID and we have a local pending row, assume it's ours if it comes from a 'buy' or initial status
    if (pendingRowsQueue.length > 0 && !isPreviouslyTracked) {
      row = pendingRowsQueue.shift(); // Take first in queue
      row.dataset.contractId = contractId;
      myLocalContractIds.add(contractId);
      log(`LINK SUCCESS: Row identified as LOCAL ${contractId}. 🔗`, 'info');
    } else if (!isPreviouslyTracked) {
      // V3.1.72: Respect Multi-Device Isolation
      // Only track if it belongs to us. Hide "EXTERNAL SYNC" to avoid clumping metrics.
      log(`SYNC: External trade detected (${contractId}). Isolated. 🛡️`, 'info');
      return;
    }
  }

  // Update current sequence ID if it matches
  if (currentSequenceContractId === 'PENDING' && myLocalContractIds.has(contractId)) {
    currentSequenceContractId = contractId;
  }

  // 3. Status Handling & Persistence
  if (!row) return;

  // PERSISTENCE V3.1.60: Save PENDING state ONLY ONCE to avoid DB lag
  if (myLocalContractIds.has(contractId) && !row.dataset.dbPendingSaved) {
    row.dataset.dbPendingSaved = 'true';
    saveTradeToDB({
      contract_id: contractId,
      strategy: row.cells[0].textContent,
      market: row.cells[2].textContent,
      type: row.cells[3].textContent,
      stake: parseFloat(row.cells[4].textContent.replace('$', '')),
      status: 'PENDING',
      indicators_json: row.dataset.indicators // Persist telemetry V3.1.96
    });
  }

  // ROBUST SETTLEMENT V3.1.65: Aggressive Inference
  let status = (data.status || '').toLowerCase();
  const isSold = !!data.is_sold || status === 'won' || status === 'lost' || status === 'sold' || status === 'expired' || !!data.sell_price;

  if (isSold && status !== 'won' && status !== 'lost') {
    const p = parseFloat(data.profit || 0);
    const sell = parseFloat(data.sell_price || 0);
    const buy = parseFloat(data.buy_price || 0);
    const actualProfit = p || (sell - buy);
    status = (actualProfit >= 0.01) ? 'won' : 'lost';
    log(`SYNC: Final settlement inferred (${status}) [P:${actualProfit.toFixed(2)}]. ⚡`, 'info');
  }

  // Final Guard: Must be won or lost to proceed to full logic
  if (status !== 'won' && status !== 'lost') {
    if (isSold) {
      log(`SYNC: Contract ${contractId} finished with ambiguous status. Releasing lock. 🛡️`, 'warning');
      if (currentSequenceContractId === contractId) {
        tradeInProgress = false;
        currentSequenceContractId = null;
      }
      row.classList.remove('trade-pending');
      if (row.cells[5]) row.cells[5].innerHTML = `<span style="color:#848e9c">Finalizing...</span>`;
    }
    return;
  }

  // CRITICAL guard: only process settlement once (V3.1.69: Allow late settlement after timeout)
  if (row.dataset.settled === 'true') return;

  if (status === 'won' || status === 'lost') {
    if (tradeTimeout) { clearTimeout(tradeTimeout); tradeTimeout = null; }
    if (tradeTimerInterval) { clearInterval(tradeTimerInterval); tradeTimerInterval = null; }
    if (tradeTimerEl) tradeTimerEl.style.display = 'none';
    const isWin = status === 'won';
    const profit = parseFloat(data.profit || 0);
    log(`TICKET SETTLED: ${isWin ? 'WIN' : 'LOSS'} (${formatCurrency(profit)})`, isWin ? 'success' : 'error');
    if (lastSnapshot) {
      if (isWin) AI_Library.recordWin(lastSnapshot);
      else AI_Library.recordLoss(lastSnapshot);
    }
    lastSnapshot = null;

    // --- UNIVERSAL PRECISION ENGINE V3.1.52 ---
    if (isWin) {
      dynamicSelectivity = 1.0;
      log(`PRECISION: Reset to 1.0x (Market Win). 🛡️`, 'info');
    } else {
      dynamicSelectivity = Math.min(1.3, dynamicSelectivity + 0.1);
      log(`PRECISION: Increased to ${dynamicSelectivity.toFixed(1)}x (Market Pressure). 🏹`, 'warning');
    }

    // -- Sniper Specific Patience --
    if (checkSniper.checked && isWin) {
      sniperCooldown = 15;
      sniperNeedsPullback = true;
      log(`SNIPER: Waiting EMA pullback for safety. 🐢`, 'info');
    }

    updateHistoryResult(row, isWin, profit);
    row.dataset.settled = 'true';
    row.classList.remove('trade-pending');

    saveTradeToDB({
      contract_id: contractId,
      strategy: row.cells[0].textContent,
      market: row.cells[2].textContent,
      type: row.cells[3].textContent,
      stake: parseFloat(row.cells[4].textContent.replace('$', '')),
      profit: profit,
      status: isWin ? 'WON' : 'LOST',
      indicators_json: row.dataset.indicators // Persist telemetry V3.1.96
    });

    const isOurTrade = myLocalContractIds.has(contractId);
    myLocalContractIds.delete(contractId);
    mySyncedContractIds.delete(contractId);

    const isManualCompound = document.getElementById('compound-enabled').checked;
    const isSniperActive = checkSniper.checked;
    const baseStake = getDynamicBaseStake();

    // SORO LOGIC V3.1.32: Isolation & Respect User Levels
    if (isManualCompound || isSniperActive) {
      // Respect the user's max levels from the UI (Capped at 5)
      const inputLevelVal = parseInt(document.getElementById('compound-levels').value) || 3;
      const maxLevels = Math.min(5, inputLevelVal);

      if (isWin) {
        consecutiveLosses = 0; // Safety Circuit Reset
        // Only level up if THIS PC opened the trade to avoid the "Double Level" bug
        if (isOurTrade) {
          if (currentLevel < maxLevels) {
            currentStake = parseFloat(currentStake) + parseFloat(profit);
            currentLevel++;
            log(`SORO LVL UP: Lvl ${currentLevel} active (Our Win). 🚀`, 'info');
          } else {
            currentStake = parseFloat(baseStake);
            currentLevel = 1;
            log('SORO CYCLE COMPLETE! 🎯 Resetting to base.', 'success');
          }
        } else {
          log(`SYNC: External Win detected (${contractId}). Level maintained. 🛡️`, 'info');
        }
      } else {
        // ON ANY LOSS (even from other PC): Reset for safety as balance dropped
        consecutiveLosses++;
        const maxLosses = parseInt(inputMaxLosses.value) || 2;

        if (checkSafetyCircuit.checked && consecutiveLosses >= maxLosses) {
          const pauseMinutes = 5; // Reduced V3.1.97 to avoid "dead bot" feeling
          pauseUntil = Date.now() + (pauseMinutes * 60 * 1000);
          log(`SAFETY CIRCUIT ENGAGED! ${consecutiveLosses} consecutive losses. Pausing for ${pauseMinutes}m. 🛡️🐕`, 'error');
          consecutiveLosses = 0;
          dynamicSelectivity = 1.0; // Reset precision after the "walk in the park"
        }

        currentStake = parseFloat(baseStake);
        currentLevel = 1;
        log('SORO RESET: Loss detected. Back to Level 1. ⚠️', 'warning');
      }
    } else {
      currentStake = parseFloat(baseStake);
      currentLevel = 1;
    }

    // V3.1.71: Only release global lock if this is actually the current active trade
    if (currentSequenceContractId === contractId) {
      tradeInProgress = false;
      currentSequenceContractId = null;
    }

    lastPendingTradeRow = null;
    tradeStartTime = 0;

    updateSummaryPanel(); // URGENT: Sync Soro Level in UI 🚀
  }
}

function addHistoryRow(strategy, market, type, stake, existingStatus = null, existingProfit = null, existingTime = null) {
  const time = existingTime || new Date().toLocaleTimeString([], { hour12: false });
  const row = document.createElement('tr');

  let resultHtml = `<span class="res-pending">Pending...</span>`;
  if (existingStatus === 'WON' || existingStatus === 'LOST') {
    const isWin = existingStatus === 'WON';
    const profVal = parseFloat(existingProfit);
    const profitText = isWin ? `(+${formatCurrency(profVal)})` : `(${formatCurrency(profVal)})`;
    resultHtml = `<span class="${isWin ? 'res-win' : 'res-loss'}">${isWin ? 'WIN' : 'LOSS'} ${profitText}</span>`;
  } else if (existingStatus === 'REJECTED') {
    resultHtml = `<span class="res-rejected">REJECTED</span>`;
  } else if (existingStatus === 'TIMEOUT') {
    resultHtml = `<span style="color: #ff9800; font-weight: bold;">TIMEOUT</span>`;
  } else {
    row.className = 'trade-pending';
    row.dataset.createTime = Date.now(); // V3.1.62: Settlement Guard
  }

  row.innerHTML = `<td style="color:var(--accent);font-weight:700;font-size:0.65rem;">${strategy}</td><td>${time}</td><td>${market}</td><td style="color:${type === 'CALL' ? '#00ff88' : '#ff3344'};font-weight:bold;">${type}</td><td>${formatCurrency(stake)}</td><td>${resultHtml}</td>`;
  historyBody.insertBefore(row, historyBody.firstChild);
  return row;
}

function updateHistoryResult(row, isWin, profit) {
  const cell = row.cells[5];
  if (cell) {
    const profitText = isWin ? `(+${formatCurrency(profit)})` : `(${formatCurrency(profit)})`;
    cell.innerHTML = `<span class="${isWin ? 'res-win' : 'res-loss'}">${isWin ? 'WIN' : 'LOSS'} ${profitText}</span>`;
  }
}

function saveTradeToDB(tradeData) {
  const formData = new FormData();
  for (const key in tradeData) formData.append(key, tradeData[key]);
  // Add Identity
  formData.append('instance_id', instanceId);
  formData.append('device_name', deviceName);

  fetch('/api/trades.php?action=save', { method: 'POST', body: formData })
    .catch(err => console.error("DB Save Error:", err));
}

function fetchHistoricalTrades() {
  fetch(`/api/trades.php?action=fetch&instance_id=${instanceId}`)
    .then(r => r.json())
    .then(trades => {
      if (Array.isArray(trades)) {
        // Clear initial table to avoid duplicates if needed, but here we just append if empty
        if (historyBody.children.length === 0) {
          trades.reverse().forEach(t => {
            const time = new Date(t.timestamp).toLocaleTimeString([], { hour12: false });
            const row = addHistoryRow(t.strategy, t.market, t.type, t.stake, t.status, t.profit, time);
            row.dataset.contractId = t.contract_id;
            // V3.1.67: Only remove pending flag if actually settled
            if (t.status === 'WON' || t.status === 'LOST' || t.status === 'REJECTED' || t.status === 'TIMEOUT') {
              row.classList.remove('trade-pending');
            }
          });
          log(`DB: ${trades.length} historical trades restored. 💾`, 'success');
        }
      }
    })
    .catch(err => console.error("DB Fetch Error:", err));
}

// [V3.1.84: DUPLICATE REMOVED]

function updateSummaryPanel() {
  const summaryEl = document.getElementById('summary-content');
  if (!summaryEl) return;
  const market = marketSelect.options[marketSelect.selectedIndex].text;
  const stakeInput = document.getElementById('stake');
  const stakeValue = stakeInput ? parseFloat(stakeInput.value.replace(',', '.')) || 1.0 : 1.0;
  const duration = document.getElementById('duration').value;
  const compound = document.getElementById('compound-enabled').checked;
  const compLevels = document.getElementById('compound-levels').value;
  const sequential = checkSequential.checked;
  let strats = [];
  if (checkEmas.checked) strats.push("EMA/SMA");
  if (checkGiraffa.checked) strats.push("Giraffa");
  if (checkSafari.checked) strats.push("Safari");
  if (checkXFast.checked) strats.push("X-FAST");
  if (checkSniper.checked) strats.push("SNIPER 🎯");
  if (checkOlymp.checked) strats.push("OLYMP 🔱");
  let modeHtml = sequential ? '<span style="color:#03a9f4">SEQUENTIAL</span>' : '<span style="color:#2ebd85">PARALLEL</span>';
  if (checkRequireAll.checked) modeHtml = '<span style="color:#f6465d">MATCH ALL</span>';
  let durationDisplay = checkSniper.checked ? `<span style="color:#03a9f4">Auto (AI)</span>` : `${duration}${document.getElementById('duration-unit').value}`;
  let compoundDisplay = (checkSniper.checked || compound) ? `<span style="color:#2ebd85">ON (Lv ${currentLevel}/${compLevels})</span>` : `<span style="color:#848e9c">OFF</span>`;

  // Sniper Patience Status
  let patienceStatus = '';
  if (checkSniper.checked) {
    if (sniperCooldown > 0) patienceStatus = `<div style="color:#f0b90b; font-size:0.75rem;">⏳ Cooldown: ${sniperCooldown}s</div>`;
    else if (sniperNeedsPullback) patienceStatus = `<div style="color:#03a9f4; font-size:0.75rem;">🐢 Waiting: EMA Pullback</div>`;
    else patienceStatus = `<div style="color:#2ebd85; font-size:0.75rem;">🎯 Sniper: Locked On</div>`;
  }

  // Olymp Trend Status
  let olympStatus = '';
  if (checkOlymp.checked) {
    const data = chartManager.getLatestIndicators();
    if (data && data.ema36 && data.ema51) {
      const isBull = data.ema36 > data.ema51;
      const histCount = Indicators.scanPatternHistory(chartManager.allCandles, 100);
      olympStatus = `<div style="color:${isBull ? '#2ebd85' : '#f6465d'}; font-size:0.75rem;">🔱 Olymp: ${isBull ? 'Bullish' : 'Bearish'} (Hist: ${histCount})</div>`;
    }
  }

  // Safety Circuit Status
  let safetyStatus = '';
  if (checkSafetyCircuit.checked) {
    if (Date.now() < pauseUntil) {
      const rem = Math.ceil((pauseUntil - Date.now()) / 1000);
      const m = Math.floor(rem / 60);
      const s = rem % 60;
      safetyStatus = `<div style="background:rgba(246,70,93,0.1); color:#f6465d; padding:5px; border-radius:4px; margin-top:8px; font-weight:bold; border:1px solid #f6465d; text-align:center; font-family:'Roboto Mono',monospace;">🛡️ PAUSA DE SEGURIDAD: ${m}:${s.toString().padStart(2, '0')}</div>`;
    } else {
      safetyStatus = `<div style="color:#2ebd85; font-size:0.75rem; margin-top:5px; border-top:1px solid rgba(255,255,255,0.05); padding-top:3px;">🛡️ Circuito Activo: ${consecutiveLosses}/${inputMaxLosses.value} Pérdidas</div>`;
    }
  }


  summaryEl.innerHTML = `
    <div style="font-size:0.65rem; color:#f0b90b; margin-bottom:5px; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid rgba(240,185,11,0.2); padding-bottom:2px;">
      Device: <span style="color:white; font-weight:bold;">${deviceName}</span> 💻
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;">
        <div>Market: <strong style="color:white">${market}</strong></div>
        <div>Active Stake: <strong style="color:#f0b90b">${formatCurrency(parseFloat(currentStake) || 0)}</strong></div>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px;">
        <div>Mode: <strong>${modeHtml}</strong></div>
        <div>Time: <strong style="color:#f0b90b">${durationDisplay}</strong></div>
    </div>
    <div style="margin-top:5px; display:flex; justify-content:space-between; align-items:center;">
        <div>Soro: ${compoundDisplay}</div>
        <div style="color:${(dynamicSelectivity + ((currentLevel > 1) ? (currentLevel - 1) * 0.35 : 0)) > 1.0 ? '#f0b90b' : '#2ebd85'}; font-size:0.75rem; font-weight:bold;">
          Precision: ${(dynamicSelectivity + ((currentLevel > 1) ? (currentLevel - 1) * 0.35 : 0)).toFixed(2)}x
        </div>
    </div>
    <div style="margin-top:2px;">
        ${patienceStatus || olympStatus}
    </div>
    <div style="margin-top:5px; font-size:0.8rem;">Active: <span style="color:white">${strats.join(', ') || 'NONE'}</span></div>
    ${safetyStatus}
    <div style="margin-top:5px; font-size:0.7rem; color:#848e9c; border-top:1px dashed #444; padding-top:2px;">
      AI Cognition: <span style="color:#2ebd85">${AI_Library.wins.length} Wins</span> | <span style="color:#f6465d">${AI_Library.losses.length} Losses</span> 🧠
    </div>
    ${latestAIAnalysis}
  `;
}

function updateMarketOracle() {
  if (!oracleRecEl || !marketSelect) return;
  const market = marketSelect.value;
  let rec = "Safari / EMA"; // Default

  const mapping = {
    'R_100': 'X-FAST, Safari, EMA',
    'R_75': 'EMA/SMA, Sniper, Safari',
    'R_50': 'EMA/SMA, Giraffa',
    'R_25': 'Safari, Sniper',
    'R_10': 'EMA, Olymp',
    '1HZ100V': 'X-FAST, Sniper',
    '1HZ75V': 'Olymp, Safari',
    '1HZ50V': 'EMA, Giraffa',
    '1HZ25V': 'Safari, X-Fast',
    '1HZ10V': 'Sniper, Olymp',
    'JD10': 'Safari, Giraffa',
    'JD100': 'Giraffa, X-Fast',
    'BOOM1000': 'Safari (Trend Only)',
    'CRASH1000': 'Safari (Trend Only)'
  };

  rec = mapping[market] || "Safari / EMA";
  oracleRecEl.textContent = rec;
  oracleRecEl.style.color = '#f0b90b';
}

marketSelect.addEventListener('change', () => {
  if (connection && isAuthorized) {
    connection.forgetAll('ticks');
    connection.getHistory(marketSelect.value);
    connection.subscribeTicks(marketSelect.value);
    log(`Strategic Pivot: Now targeting ${marketSelect.value}.`, 'info');
  }
  updateMarketOracle();
});

// [V3.1.84: DUPLICATE REMOVED]
updateSummaryPanel();

function analyzeMarket() {
  if (!chartManager || !chartManager.allCandles || chartManager.allCandles.length < 100) return;
  const lookback = 100;
  const candles = chartManager.allCandles.slice(-lookback);
  const data = chartManager.getLatestIndicators();
  const startPrice = candles[0].close;
  const endPrice = candles[candles.length - 1].close;
  const priceChangePct = ((endPrice - startPrice) / startPrice) * 100;
  let totalVol = 0;
  for (let i = 1; i < candles.length; i++) totalVol += Math.abs(candles[i].close - candles[i].open);
  const avgVol = totalVol / lookback;
  const volatilityContext = (avgVol / endPrice) * 10000;
  let sentiment = "NEUTRAL", strategy = "NONE", color = "#fff", recDuration = "5";
  if (priceChangePct > 0.02) { sentiment = "STRONG BULLISH 🐂"; strategy = "SAFARI or X-FAST"; color = "#2ebd85"; recDuration = "3-4"; }
  else if (priceChangePct < -0.02) { sentiment = "STRONG BEARISH 🐻"; strategy = "SAFARI or X-FAST"; color = "#f6465d"; recDuration = "3-4"; }
  else { sentiment = "RANGING 🦀"; strategy = "GIRAFFA or EMA"; color = "#f0b90b"; recDuration = "5-7"; }
  if (volatilityContext > 100) { recDuration = "1-2"; sentiment += " (VOLATILE)"; }
  latestAIAnalysis = `
    <div style="margin-top:5px; border-top:1px solid #333; padding-top:5px; font-size:0.85rem;">
        <div style="color:${color}; font-weight:bold;">${sentiment}</div>
        <div>Rec: <span style="color:${color}">${strategy}</span> | Time: <strong style="color:#f0b90b">${recDuration} Ticks</strong></div>
    </div>
  `;
  updateSummaryPanel();
}

// -- Global Precise Timer (Smooth UI) -- ⏱️
let lastServerTime = 0;
let lastTickLocalTime = 0;

setInterval(() => {
  tickCount++;
  // 1. Candle Countdown (Smooth 1s)
  if (candleCountdownEl && lastServerTime > 0) {
    const elapsedSinceLastTick = Math.floor((Date.now() - lastTickLocalTime) / 1000);
    const estimatedEpoch = lastServerTime + elapsedSinceLastTick;
    const remainingSeconds = 60 - (estimatedEpoch % 60);
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    candleCountdownEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // 2. Sniper Cooldown (Smooth 1s)
  if (sniperCooldown > 0) {
    sniperCooldown--;
    if (sniperCooldown % 3 === 0) updateSummaryPanel(); // Update UI periodically
  }

  // 3. Trade Settlement Guard (V3.1.62)
  if (Date.now() % 5000 < 1000) { // Every ~5s
    const now = Date.now();
    const pendingRows = document.querySelectorAll('tr.trade-pending');
    pendingRows.forEach(r => {
      const createTime = parseInt(r.dataset.createTime) || tradeStartTime;
      if (createTime > 0 && (now - createTime) > 300000) { // 5 Minutes (V3.1.69)
        log(`LATCH FAILSAFE: Auto-settled timed-out trade ${r.dataset.contractId}. 🛡️`, 'warning');
        const cell = r.cells[5];
        const cid = r.dataset.contractId || 'TIMEOUT_' + now;
        if (cell) cell.innerHTML = `<span style="color: #ff9800; font-weight: bold;">TIMEOUT</span>`;
        r.classList.remove('trade-pending');

        // V3.1.71: Automatic Precision Increase on Timeout (User Request)
        dynamicSelectivity = Math.min(1.3, dynamicSelectivity + 0.1);
        log(`TIMEOUT: Increasing Precision to ${dynamicSelectivity.toFixed(2)}x for next entry. 🎯`, 'warning');

        if (currentSequenceContractId === r.dataset.contractId) {
          tradeInProgress = false; // RELEASE LOCK if it's the current one
          currentSequenceContractId = null;
        }
        // V3.1.70: Keep in queue so we can still link the ID if it arrives late
        // pendingRowsQueue = pendingRowsQueue.filter(pr => pr !== r); 


        // V3.1.66: Persist timeout to DB to avoid "Pending" on refresh
        saveTradeToDB({
          contract_id: cid,
          strategy: r.cells[0].textContent,
          market: r.cells[2].textContent,
          status: 'TIMEOUT'
        });
      }
    });
  }

  // V3.1.74: AGGRESSIVE CONTRACT POLLING (Every 3s)
  if (connection && isAuthorized && tickCount % 3 === 0) {
    const pending = document.querySelectorAll('tr.trade-pending');
    pending.forEach(r => {
      const cid = r.dataset.contractId;
      if (cid) connection.send({ proposal_open_contract: 1, contract_id: cid });
    });
  }
}, 1000);

// V3.1.65: UI Polish - Focus/Blur Decimal Enforcement
document.getElementById('stake').addEventListener('blur', function () {
  this.value = parseFloat(this.value || 0).toFixed(2);
  saveSettings();
});

document.getElementById('device-name-input').addEventListener('blur', function () {
  saveSettings();
});

// V3.1.68: Removed buggy DOM-scanning interval that caused repeating decimal issue.
// Formatting is now handled at the source in updateSummaryPanel for better stability.

// Initial Run
chartManager = new ChartManager('chart-container');
loadSettings();
fetchHistoricalTrades(); // LOAD HISTORY ON BOOT V3.1.33
fetch('/api/user_config.php').then(r => r.json()).then(d => {
  if (d.success && d.data) {
    if (d.data.deriv_app_id) document.getElementById('app-id').value = d.data.deriv_app_id;
    if (d.data.deriv_token) document.getElementById('api-token').value = d.data.deriv_token;
  }
});
document.getElementById('btn-logout').addEventListener('click', () => {
  fetch('/api/auth.php', { method: 'POST', body: new URLSearchParams({ action: 'logout' }) }).then(() => window.location.href = '/login.php');
});
log(`Final-Evo v${V} Engine Online. High-Precision Sniper Active.`, 'success');

// -- Manual Mode Listeners --
if (checkManualMode) {
  checkManualMode.addEventListener('change', () => {
    const enabled = checkManualMode.checked;
    btnManualCall.disabled = !enabled;
    btnManualPut.disabled = !enabled;
    btnManualCall.style.opacity = enabled ? '1' : '0.3';
    btnManualPut.style.opacity = enabled ? '1' : '0.3';
    btnManualCall.style.cursor = enabled ? 'pointer' : 'not-allowed';
    btnManualPut.style.cursor = enabled ? 'pointer' : 'not-allowed';
    if (enabled) log('MANUAL MODE: Enabled. Lions are ready to hunt! 🦁', 'info');
  });
}

if (btnManualCall) {
  btnManualCall.addEventListener('click', () => {
    if (checkManualMode && checkManualMode.checked) handleTrade('CALL', 'Manual', true);
  });
}

if (btnManualPut) {
  btnManualPut.addEventListener('click', () => {
    if (checkManualMode && checkManualMode.checked) handleTrade('PUT', 'Manual', true);
  });
}
// Final Initialization
loadSettings();
configKeys.forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('change', saveSettings);
    el.addEventListener('input', saveSettings);
  }
});

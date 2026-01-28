import { DerivConnection } from './deriv.js?v=3.1.67';
import { ChartManager } from './chart.js?v=3.1.67';
import { Indicators } from './indicators.js?v=3.1.67';

const V = "3.1.82";

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

    // V3.1.82: Unified Global Sync Gate
    const isStartOfCandle = (lastServerTime % 60) <= 1.5;

    if (botRunning && isAuthorized && (isSequentialReq ? !tradeInProgress : true)) {
      // V3.1.80: Balance Watchdog
      if (tickCount % 30 === 0 && (Date.now() - lastBalanceUpdate > 60000)) {
        log('WATCHDOG: Balance stale. Re-syncing... 🔄', 'warning');
        connection.send({ balance: 1, subscribe: 1 });
        lastBalanceUpdate = Date.now(); // Reset to wait for next sync
      }

      // V3.1.81: Balance Watchdog & Sniper Stabilizer
      if (tickCount % 30 === 0 && (Date.now() - lastBalanceUpdate > 60000)) {
        log('WATCHDOG: Balance stale. Force Sync... 🔄', 'warning');
        connection.send({ balance: 1, subscribe: 1 });
        lastBalanceUpdate = Date.now();
      }
      tickCount++;

      const data = chartManager.getLatestIndicators();
      if (!data) return;

      // Pullback detection
      if (sniperNeedsPullback) {
        const threshold = data.lastPrice * 0.00015; // 0.015% tolerance
        if (Math.abs(data.lastPrice - data.ema) <= threshold) {
          sniperNeedsPullback = false;
          log('SNIPER: Pullback detected. Logic reset! 🦉', 'info');
        }
      }

      const isEmaActive = checkEmas && checkEmas.checked;
      const isGiraffaActive = checkGiraffa && checkGiraffa.checked;
      const isSafariActive = checkSafari && checkSafari.checked;
      const isXFastActive = checkXFast && checkXFast.checked;
      const isSniperActive = checkSniper && checkSniper.checked;
      const isOlympActive = checkOlymp && checkOlymp.checked;
      const requireAll = checkRequireAll && checkRequireAll.checked;
      const signals = [];

      // Mandatory Market Rest: Restoration of the 60s Gap to avoid "Crazy" frequency
      const recentlyTraded = lastTradeCandleTime !== 0 && (lastServerTime < lastTradeCandleTime + 60);

      if (!isEmaActive && !isGiraffaActive && !isSafariActive && !isXFastActive && !isSniperActive && !isOlympActive) {
        if (tickCount % 20 === 0) log('SECURITY: Select an active logic block.', 'error');
        return;
      }
      if (tickCount % 12 === 0) {
        log(`Master Pulse 💓 RSI: ${data.rsi.toFixed(1)} | ZS: ${data.zScore.toFixed(1)}`, 'info');
      }

      // Universal Soro Shielding V3: Steep 5-Level Curve
      // L1: 1.0x, L2: 1.35x, L3: 1.70x, L4: 2.05x, L5: 2.40x (Shielded!)
      const levelBoost = (currentLevel > 1) ? (currentLevel - 1) * 0.35 : 0;
      const totalSelectivity = dynamicSelectivity + levelBoost;

      // --- Safety Circuit Check ---
      if (checkSafetyCircuit.checked && Date.now() < pauseUntil) {
        const remainingSec = Math.ceil((pauseUntil - Date.now()) / 1000);
        if (tickCount % 5 === 0) {
          log(`SAFETY CIRCUIT: Protected Pause Active. Returning in ${remainingSec}s. 🛡️🐕`, 'warning');
        }
        return;
      }
      if (isSniperActive) {
        const prices = chartManager.allCandles.map(c => c.close);
        const highs = chartManager.allCandles.map(c => c.high);
        const lows = chartManager.allCandles.map(c => c.low);
        const adx = Indicators.calculateADX(highs, lows, prices, 14);
        const rsi = data.rsi;
        const prevPrices = prices.slice(0, -1);
        const prevRsi = Indicators.calculateRSI(prevPrices, 14);
        const rsiSlope = rsi - prevRsi;
        const isGreen = data.lastCandle.close > data.lastCandle.open;
        const isRed = data.lastCandle.close < data.lastCandle.open;
        const gap = Math.abs(data.ema - data.sma) / data.lastPrice;
        const currentSnap = { rsi, adx, gap };
        const matchScore = AI_Library.calculateSimilarity(currentSnap, 'wins');
        const lossScore = AI_Library.calculateSimilarity(currentSnap, 'losses');
        if (tickCount % 10 === 0) {
          const aiMsg = AI_Library.wins.length > 0 ? ` | AI Match: ${matchScore.toFixed(0)}%` : ' | AI: Learning...';
          const lossMsg = AI_Library.losses.length > 0 ? ` | Loss Similarity: ${lossScore.toFixed(0)}%` : '';
          const precMsg = totalSelectivity > 1.0 ? ` | Total Precision: ${totalSelectivity.toFixed(2)}x` : '';
          log(`SNIPER SCAN: ADX ${adx.toFixed(1)}${aiMsg}${lossMsg}${precMsg} 🔭`, 'info');
        }

        const isAiMasterMatch = matchScore > 90;
        const isLossRepeat = lossScore > 85;

        // -- Loss Avoidance Filter --
        if (isLossRepeat) {
          if (tickCount % 5 === 0) log(`AI: Trade Blocked! Pattern similar to previous loss (${lossScore.toFixed(0)}%) 🛡️`, 'warning');
          return;
        }

        if (recentlyTraded) return;
        if (sniperCooldown > 0) return;
        if (sniperNeedsPullback) return;
        if (!isStartOfCandle) return; // Strictly start of candle

        // Fatigue Filters (Avoid Peaks)

        // Fatigue Filters (Avoid Peaks) - V3.1.81 (Stricter Multipliers)
        const rsiGap = (totalSelectivity - 1.0) * 8; // Restored to 8x for safety
        const rsiMin = 46 + rsiGap;
        const rsiMax = 67 - rsiGap;
        const slopeMin = 0.05 * totalSelectivity; // Higher slope requirement (0.05)

        const callTrigger = (rsi > rsiMin && rsi < rsiMax && data.lastPrice > data.ema && data.ema > data.sma && rsiSlope > slopeMin);
        const putTrigger = (rsi > (33 + rsiGap) && rsi < (54 - rsiGap) && data.lastPrice < data.ema && data.ema < data.sma && rsiSlope < -slopeMin);

        // -- Wick Reversal Logic (Sniper Upgrade) --
        if (data.sniperWick !== "NONE") {
          const isNearUpperBB = data.bollinger && data.lastPrice >= (data.bollinger.upper - (data.bollinger.upper - data.bollinger.middle) * 0.4);
          const isNearLowerBB = data.bollinger && data.lastPrice <= (data.bollinger.lower + (data.bollinger.middle - data.bollinger.lower) * 0.4);

          if (data.sniperWick === "LOWER_REJECTION" && isNearLowerBB) {
            signals.push('CALL');
            log(`SNIPER: Bullish Reversal detected at Lower Zone! 🏹`, 'success');
          } else if (data.sniperWick === "UPPER_REJECTION" && isNearUpperBB) {
            signals.push('PUT');
            log(`SNIPER: Bearish Reversal detected at Upper Zone! 🏹`, 'success');
          } else if (tickCount % 5 === 0) {
            log(`SNIPER: Wick rejection detected but outside active Zone.`, 'info');
          }
        }

        if ((callTrigger && isGreen) || (isAiMasterMatch && isGreen && rsiSlope > 0)) {
          signals.push({ type: 'CALL', source: 'SNIPER' });
          log(`SNIPER SHOT: CALL (${isAiMasterMatch ? 'AI Pattern' : 'Rules'}) 🎯`, 'success');
        } else if ((putTrigger && isRed) || (isAiMasterMatch && isRed && rsiSlope < 0)) {
          signals.push({ type: 'PUT', source: 'SNIPER' });
          log(`SNIPER SHOT: PUT (${isAiMasterMatch ? 'AI Pattern' : 'Rules'}) 🎯`, 'success');
        }
      }


      if (isOlympActive && isStartOfCandle) {
        const rsi = data.rsi;
        const olympSignal = Indicators.detectOlympRejection(chartManager.allCandles, data.ema36, data.ema51, data.sma20, data.bollinger, rsi);

        if (olympSignal && olympSignal !== "NONE") {
          if (recentlyTraded) {
            log(`WYSETRADE: Signal detected, market resting... 🧘‍♂️`, 'info');
          } else {
            const type = olympSignal.includes("CALL") ? 'CALL' : 'PUT';
            signals.push({ type, source: 'WYSETRADE' });
            log(`WYSETRADE: Pattern ${olympSignal} Detected! ↔️🔱`, 'success');
          }
          return;
        }
      }

      // V3.1.78: All strategies below use the unified 1.5s window

      if (isEmaActive && data.crossover && isStartOfCandle) {
        // Confirmation: Price must be on the correct side of the crossover for a true breakout
        const breakoutThreshold = 0.0001 * totalSelectivity; // Tighter at high levels
        const isBullish = data.lastPrice > (data.ema + breakoutThreshold) && data.ema > data.sma;
        const isBearish = data.lastPrice < (data.ema - breakoutThreshold) && data.ema < data.sma;

        if (data.crossover === "UP" && isBullish) {
          signals.push({ type: 'CALL', source: 'EMA/SMA' });
        } else if (data.crossover === "DOWN" && isBearish) {
          signals.push({ type: 'PUT', source: 'EMA/SMA' });
        } else if (tickCount % 5 === 0) {
          log(`EMA/SMA: Crossover detected, waiting for breakout confirmation...`, 'info');
        }
      }
      if (isGiraffaActive && data.fibo && isStartOfCandle) {
        const price = data.lastPrice;
        const tolerance = 0.005 / totalSelectivity; // Tightened from 0.008 back to 0.005
        const isNear618 = Math.abs(price - data.fibo.l618) <= ((data.fibo.max - data.fibo.min) * tolerance);

        // Tightened: Only trade if SuperTrend and SMC agree on the reversal direction
        if (isNear618) {
          const type = price > data.superTrend ? 'CALL' : 'PUT';
          const isTrendHealthy = (type === 'CALL' && data.smc === "Alcista") || (type === 'PUT' && data.smc === "Bajista");
          if (isTrendHealthy) signals.push({ type, source: 'GIRAFFA' });
        }
      }
      if (isSafariActive && isStartOfCandle) {
        const safariGap = (totalSelectivity - 1.0) * 6; // Reduced from 15x to 6x
        const rsiHigh = 70 + safariGap;
        const rsiLow = 30 - safariGap;
        if (data.safariTrend === "Alcista" && data.smc === "Alcista" && data.lastPrice > data.ichimoku.kijun && data.rsiLaguerre > rsiHigh) signals.push({ type: 'CALL', source: 'SAFARI' });
        else if (data.safariTrend === "Bajista" && data.smc === "Bajista" && data.lastPrice < data.ichimoku.kijun && data.rsiLaguerre < rsiLow) signals.push({ type: 'PUT', source: 'SAFARI' });
      }
      if (isXFastActive && data.bollinger && isStartOfCandle) {
        const Z_THRESHOLD = 0.8 + ((totalSelectivity - 1.0) * 0.4); // Balanced Z-Score (1.2x at L4)
        const isGreen = data.lastCandle.close > data.lastCandle.open;
        if (data.lastPrice > data.bollinger.upper && data.zScore > Z_THRESHOLD && isGreen) signals.push({ type: 'CALL', source: 'X-FAST' });
        else if (data.lastPrice < data.bollinger.lower && data.zScore < -Z_THRESHOLD && !isGreen) signals.push({ type: 'PUT', source: 'X-FAST' });
      }
      if (signals.length > 0) {
        if (requireAll) {
          const activeCount = (isEmaActive ? 1 : 0) + (isGiraffaActive ? 1 : 0) + (isSafariActive ? 1 : 0) + (isXFastActive ? 1 : 0) + (isSniperActive ? 1 : 0) + (isOlympActive ? 1 : 0);
          if (signals.length === activeCount && signals.every(s => s.type === signals[0].type)) {
            const combinedSource = signals.map(s => s.source).join('+');
            handleTrade(signals[0].type, combinedSource);
          }
        } else {
          handleTrade(signals[0].type, signals[0].source);
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
  let baseStake = parseFloat(document.getElementById('stake').value) || 1.0;
  if (checkAutoScale && checkAutoScale.checked && currentBalance >= 100) {
    const scaledStake = Math.floor(currentBalance / 100) * 10;
    if (scaledStake > baseStake) baseStake = scaledStake;
  }
  return baseStake;
}

function handleTrade(type, source = "Manual", isManual = false) {
  if (tradeTimeout) clearTimeout(tradeTimeout);

  // Mark this candle as traded to enforce cooldown
  lastTradeCandleTime = Math.floor(lastServerTime / 60) * 60;

  const baseStake = getDynamicBaseStake();

  if (currentLevel === 1) currentStake = parseFloat(baseStake);
  if (!document.getElementById('compound-enabled').checked) { currentStake = parseFloat(baseStake); currentLevel = 1; }
  const market = marketSelect.value;
  tradeInProgress = true;
  currentSequenceContractId = 'PENDING';
  log(`DISPATCHING ORDER: ${type} @ $${currentStake.toFixed(2)} (${source})`, 'success');
  const data = chartManager.getLatestIndicators();
  const adx = Indicators.calculateADX(chartManager.allCandles.map(c => c.high), chartManager.allCandles.map(c => c.low), chartManager.allCandles.map(c => c.close), 14);
  if (data) lastSnapshot = { rsi: data.rsi, adx, gap: Math.abs(data.ema - data.sma) / data.lastPrice, type };

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
      status: 'PENDING'
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
      status: isWin ? 'WON' : 'LOST'
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
          const pauseMinutes = 12;
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

function saveSettings() {
  const stake = document.getElementById('stake').value;
  if (currentLevel === 1) currentStake = parseFloat(stake) || 1.0;
  const settings = {
    market: marketSelect.value,
    deviceName: document.getElementById('device-name-input').value || 'Main PC',
    stake: stake,
    duration: document.getElementById('duration').value,
    durationUnit: document.getElementById('duration-unit').value,
    compoundEnabled: document.getElementById('compound-enabled').checked,
    compoundLevels: document.getElementById('compound-levels').value,
    strategies: {
      ema: checkEmas.checked,
      giraffa: checkGiraffa.checked,
      safari: checkSafari.checked,
      xfast: checkXFast.checked,
      sniper: checkSniper.checked,
      olymp: checkOlymp.checked,
      autoscale: checkAutoScale ? checkAutoScale.checked : false,
      requireAll: checkRequireAll.checked,
      sequential: checkSequential.checked,
      sniperTarget: document.getElementById('sniper-target') ? document.getElementById('sniper-target').value : 8
    }
  };
  deviceName = settings.deviceName;
  localStorage.setItem('tk_device_name', deviceName);
  localStorage.setItem('tk_settings', JSON.stringify(settings));
  updateSummaryPanel();
}

function updateSummaryPanel() {
  const summaryEl = document.getElementById('summary-content');
  if (!summaryEl) return;
  const market = marketSelect.options[marketSelect.selectedIndex].text;
  const stake = document.getElementById('stake').value;
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

function loadSettings() {
  const saved = localStorage.getItem('tk_settings');
  if (!saved) return;
  try {
    const s = JSON.parse(saved);
    if (s.market) marketSelect.value = s.market;
    if (s.deviceName) {
      deviceName = s.deviceName;
      localStorage.setItem('tk_device_name', deviceName);
      if (document.getElementById('device-name-input')) document.getElementById('device-name-input').value = deviceName;
    }
    if (s.stake) {
      const sVal = parseFloat(s.stake) || 1.0;
      document.getElementById('stake').value = sVal.toFixed(2);
      if (currentLevel === 1) currentStake = parseFloat(sVal);
    }
    if (s.duration) document.getElementById('duration').value = s.duration;
    if (s.durationUnit && document.getElementById('duration-unit')) document.getElementById('duration-unit').value = s.durationUnit;
    if (document.getElementById('compound-enabled')) {
      document.getElementById('compound-enabled').checked = s.compoundEnabled;
      document.getElementById('compound-levels').disabled = !s.compoundEnabled;
      document.getElementById('compound-levels').value = s.compoundLevels || 3;
    }
    if (s.strategies) {
      checkEmas.checked = s.strategies.ema;
      checkGiraffa.checked = s.strategies.giraffa;
      checkSafari.checked = s.strategies.safari;
      checkXFast.checked = s.strategies.xfast;
      checkSniper.checked = s.strategies.sniper;
      if (checkOlymp) checkOlymp.checked = s.strategies.olymp;
      if (checkAutoScale) checkAutoScale.checked = s.strategies.autoscale || false;
      checkRequireAll.checked = s.strategies.requireAll;
      checkSequential.checked = s.strategies.sequential;
      if (document.getElementById('sniper-target')) document.getElementById('sniper-target').value = s.strategies.sniperTarget || 8;
    }
  } catch (e) { console.error("Settings Load Error", e); }
  updateSummaryPanel();
}

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

import './style.css';
import { DerivConnection } from './deriv.js';
import { ChartManager } from './chart.js';

document.querySelector('#app').innerHTML = `
  <header>
    <div class="logo">TRADERKING <span style="font-size: 0.8em; opacity: 0.7;">PRO BOT V2.5</span></div>
    <div class="account-info">
      <span>Account: <strong id="acc-id">...</strong></span>
      <span>Balance: <strong id="balance">...</strong></span>
    </div>
  </header>

  <aside>
    <div class="control-group">
      <div class="panel-title">API Connection</div>
      <label>App ID</label>
      <input type="text" id="app-id" value="122130" placeholder="Deriv App ID">
      <label>API Token</label>
      <input type="password" id="api-token" value="wQYBaZn052gTBrs" placeholder="Paste your token here">
      <button id="btn-connect" class="btn-primary" style="margin-top: 10px;">Connect</button>
    </div>

    <div class="control-group">
      <div class="panel-title">Trade Settings</div>
      <label>Market</label>
      <select id="market-select">
        <option value="R_100">Volatility 100</option>
        <option value="R_10">Volatility 10</option>
        <option value="1HZ100V">Volatility 100 (1s)</option>
      </select>
      
      <label>Stake ($)</label>
      <input type="number" id="stake" value="0.35" step="0.1" min="0.35">
      
      <label>Duration (Ticks)</label>
      <input type="number" id="duration" value="5" min="1" max="10">
    </div>

    <div class="control-group">
      <div class="panel-title">Strategy Control</div>
      <button id="btn-start" class="btn-primary">Start Bot</button>
      <button id="btn-stop" class="btn-primary btn-stop" style="display: none; margin-top: 10px;">Stop Bot</button>
    </div>
  </aside>

  <main>
    <div id="chart-container" style="width: 100%; height: 100%; background: #000; border-radius: 8px;"></div>
    <div id="current-tick-overlay" style="position: absolute; top: 80px; right: 40px; font-size: 2rem; font-weight: bold; pointer-events: none; z-index: 10;">--.--</div>
  </main>


  <footer id="logs-panel">
    <div class="log-entry log-info">[System] Interface loaded. Ready manually.</div>
  </footer>
`;

// -- Helpers --
function log(msg, type = 'info') {
  const logsPanel = document.getElementById('logs-panel');
  if (!logsPanel) return;
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logsPanel.prepend(entry);
}

// Global Error Handler
window.onerror = function (message, source, lineno, colno, error) {
  log(`JS Error: ${message} (Line: ${lineno})`, 'error');
  return false;
};

// -- State Variables --
log("TraderKing Bot v2.5 Initializing...", 'info');
let connection = null;
let botRunning = false;
let ticks = [];
const MAX_TICKS = 10;

// -- DOM Elements --
const balanceEl = document.getElementById('balance');
const accIdEl = document.getElementById('acc-id');
const tickEl = document.getElementById('current-tick-overlay');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const marketSelect = document.getElementById('market-select');

// -- Chart --
let chartManager = null;
try {
  chartManager = new ChartManager('chart-container');
  log("Chart engine loaded.", "success");
} catch (e) {
  log("Chart Failed: " + e.message, "error");
}

log("System Ready. Click 'Connect' to begin.", "success");

function updateBotUI() {

  if (botRunning) {
    btnStart.style.display = 'none';
    btnStop.style.display = 'block';
    log('Bot Started. Waiting for signals...', 'info');
  } else {
    btnStart.style.display = 'block';
    btnStop.style.display = 'none';
    log('Bot Stopped.', 'info');
  }
}

// -- Event Listeners --

// Connect Button
document.getElementById('btn-connect').addEventListener('click', () => {
  const appId = document.getElementById('app-id').value;
  const token = document.getElementById('api-token').value;

  if (!token) return log('Please enter an API Token', 'error');

  log(`Initializing connection to App ID: ${appId}...`, 'info');

  if (connection) {
    // logic to disconnect if needed
  }

  connection = new DerivConnection(appId);

  connection.on('open', () => {
    log('WebSocket Connected. Authorizing...', 'success');
    connection.authorize(token);
  });

  connection.on('authorize', (data) => {
    log(`Authorized as ${data.loginid} (${data.fullname})`, 'success');
    balanceEl.textContent = `${data.currency} ${data.balance}`;
    accIdEl.textContent = data.loginid;

    // Subscribe to default market
    const market = marketSelect.value;
    log(`Subscribing to ${market}...`, 'info');
    connection.subscribeTicks(market);
  });

  connection.on('error', (err) => {
    log(`Error: ${err.message || err.code}`, 'error');
  });

  connection.on('tick', (tick) => {
    const quote = parseFloat(tick.quote);
    tickEl.textContent = quote;
    chartManager.onTick(tick);

    // Color update based on previous tick
    const lastQuote = ticks.length > 0 ? ticks[ticks.length - 1] : quote;
    if (quote > lastQuote) tickEl.style.color = '#4caf50';
    else if (quote < lastQuote) tickEl.style.color = '#ff444f';
    else tickEl.style.color = 'var(--text-primary)';

    ticks.push(quote);
    if (ticks.length > MAX_TICKS) ticks.shift();

    // Strategy Logic
    if (botRunning && ticks.length >= 3) {
      const t1 = ticks[ticks.length - 1];
      const t2 = ticks[ticks.length - 2];
      const t3 = ticks[ticks.length - 3];

      const stake = document.getElementById('stake').value;
      const duration = document.getElementById('duration').value;
      const symbol = marketSelect.value;

      // Simple Trend Strategy: 3 Up -> Call, 3 Down -> Put
      if (t1 > t2 && t2 > t3) {
        log(`Signal: CALL (Rise) on ${symbol} @ ${t1}`, 'success');
        connection.buyContract('CALL', stake, duration, symbol);
        botRunning = false; // Stop after trade
        updateBotUI();
      } else if (t1 < t2 && t2 < t3) {
        log(`Signal: PUT (Fall) on ${symbol} @ ${t1}`, 'error');
        connection.buyContract('PUT', stake, duration, symbol);
        botRunning = false;
        updateBotUI();
      }
    }
  });

  connection.on('contract', (contract) => {
    log(`Trade Executed! ID: ${contract.contract_id} | Price: ${contract.buy_price}`, 'success');
  });

  connection.connect();
});

// Start/Stop Buttons
btnStart.addEventListener('click', () => {
  if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
    return log('Please connect to API first.', 'error');
  }
  botRunning = true;
  ticks = [];
  updateBotUI();
});

btnStop.addEventListener('click', () => {
  botRunning = false;
  updateBotUI();
});

// Market Change
marketSelect.addEventListener('change', (e) => {
  if (connection && connection.ws.readyState === WebSocket.OPEN) {
    log(`Switching market to ${e.target.value}...`);
    connection.subscribeTicks(e.target.value);
    ticks = [];
    chartManager.clear();
  }
});

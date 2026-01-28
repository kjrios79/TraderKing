<?php
session_start();
if (!isset($_SESSION['user_id'])) {
    header('Location: /login.php');
    exit;
}
$username = $_SESSION['username'];
// Atomic Versioning for 100% Cache Busting
$v = time();
?>
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>TraderKing Pro Bot V3.1.75-STABLE [ORACLE-PRO]</title>
    
    <!-- External Dependencies -->
    <script src="https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet">
    
    <!-- Design System (V3.1.67) -->
    <link rel="stylesheet" href="/css/style.css?v=<?php echo $v; ?>">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Roboto+Mono:wght@500&display=swap');
      :root {
          --header-height: 70px;
          --sidebar-width: 320px;
          --bg-main: #0b0e11;
          --bg-panel: #1e2329;
          --bg-input: #2b2f36;
          --accent: #f0b90b;
          --text-primary: #eaecef;
          --text-secondary: #848e9c;
          --success: #2ebd85;
          --danger: #f6465d;
          --border: #333;
      }
      * { box-sizing: border-box; }
      body { 
          margin: 0; 
          padding-top: var(--header-height); 
          background: var(--bg-main); 
          color: var(--text-primary); 
          font-family: 'Inter', sans-serif; 
          height: 100vh; 
          height: 100dvh; 
          overflow: hidden; 
          display: flex; 
          flex-direction: column; 
      }
      header { position: fixed; top: 0; left: 0; right: 0; height: var(--header-height); background: var(--bg-panel); display: flex; justify-content: flex-start; align-items: center; gap: 20px; padding: 0 20px; border-bottom: 2px solid var(--accent); z-index: 1000; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
      .logo { font-size: 1.2rem; font-weight: 700; color: var(--accent); letter-spacing: 1px; }
      .account-info { display: flex; gap: 20px; align-items: center; border-left: 1px solid var(--border); padding-left: 20px; font-size: 0.9rem; margin-left: auto; }
      .account-info strong { color: var(--text-primary); }

      /* Active Trade Display */
      #active-trade-info {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 15px;
        font-family: 'Roboto Mono', monospace;
        font-weight: 700;
        font-size: 1.1rem;
        opacity: 0;
        transition: opacity 0.3s;
        transform: translateY(-5px);
      }
      #active-trade-info.visible { opacity: 1; transform: translateY(0); }
      .trade-badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; }
      .trade-price { color: #f0b90b; }


      #app-layout { 
          display: flex; 
          flex: 1; 
          height: calc(100vh - var(--header-height)); 
          height: calc(100dvh - var(--header-height)); 
          overflow: hidden; 
      }
      aside { width: var(--sidebar-width); background: var(--bg-panel); border-right: 1px solid var(--border); padding: 15px; overflow-y: auto; flex-shrink: 0; }
      main { flex: 1; display: flex; flex-direction: column; background: var(--bg-main); overflow: hidden; padding: 15px; gap: 15px; }

      /* Accordion Styles */
      .control-group { background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 10px; overflow: hidden; }
      .panel-header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          padding: 12px 15px; 
          background: rgba(255,255,255,0.02); 
          cursor: pointer; 
          user-select: none;
          transition: background 0.2s;
      }
      .panel-header:hover { background: rgba(255,255,255,0.05); }
      .panel-title { font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin: 0; }
      .panel-icon { font-size: 0.7rem; color: var(--text-secondary); transition: transform 0.3s; }
      .control-group.open .panel-icon { transform: rotate(180deg); }
      
      .panel-content { 
          padding: 15px; 
          display: none; 
          border-top: 1px solid var(--border);
          background: rgba(0,0,0,0.1);
      }
      .control-group.open .panel-content { display: block; }

      label { display: block; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 5px; }
      input, select { width: 100%; background: var(--bg-input); border: 1px solid var(--border); color: white; padding: 10px; border-radius: 4px; margin-bottom: 12px; font-family: inherit; }
      button { width: 100%; padding: 12px; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
      #btn-connect { background: var(--accent); color: #1e2329; margin-top: 5px; }
      .btn-start { background: var(--success); color: white; margin-bottom: 10px; }
      .btn-stop { background: var(--danger); color: white; }

      /* Strategy Checks */
      .strategy-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
      .strategy-item:last-child { border-bottom: none; }
      .strategy-item input[type="checkbox"] { width: auto; margin: 0; cursor: pointer; flex-shrink: 0; }
      .strategy-item span { font-size: 0.8rem; color: var(--text-primary); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      #chart-container { flex: 5.5; background: #000; border-radius: 10px; border: 1px solid var(--border); position: relative; overflow: hidden; }
      #hud-header { display: flex; align-items: center; gap: 20px; flex: 1; justify-content: center; }
      #current-tick-overlay { background: rgba(0,0,0,0.5); padding: 4px 12px; border-radius: 4px; border: 1px solid var(--accent); color: var(--accent); font-family: 'Roboto Mono', monospace; font-size: 1.1rem; min-width: 100px; text-align: center; }
      #candle-countdown { background: rgba(246,70,93,0.1); border: 1px solid #f6465d; padding: 4px 12px; border-radius: 4px; color: #f6465d; font-family: 'Roboto Mono', monospace; font-size: 0.9rem; font-weight: bold; min-width: 70px; text-align: center; }
      #trade-timer-overlay { position: absolute; top: 20px; left: 20px; background: rgba(0,0,0,0.8); border: 1px solid var(--success); color: var(--success); padding: 5px 15px; border-radius: 4px; font-family: 'Roboto Mono', monospace; font-size: 1rem; z-index: 20; display: none; }

      .panels-container { flex: 2; display: flex; gap: 15px; overflow: hidden; min-height: 0; margin-bottom: 5px; }
      #logs-panel { flex: 1.2; min-width: 250px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 8px; padding: 10px; overflow-y: auto; font-family: 'Roboto Mono', monospace; font-size: 0.75rem; display: flex; flex-direction: column; gap: 4px; }
      #history-panel { flex: 1.8; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 8px; overflow-y: auto; overflow-x: auto; position: relative; }
      
      table { width: 100%; border-collapse: collapse; font-size: 0.75rem; color: var(--text-secondary); min-width: 500px; }
      th { background: #1a1a1a; text-align: left; padding: 12px 10px; border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 10; color: var(--accent); white-space: nowrap; }
      td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.02); white-space: nowrap; }
      .log-entry { display: flex; gap: 8px; line-height: 1.4; padding: 2px 5px; border-radius: 3px; }
      .log-time { color: var(--text-secondary); min-width: 65px; }
      .log-info { border-left: 2px solid var(--accent); background: rgba(240,185,11,0.05); }
      .log-success { border-left: 2px solid var(--success); color: var(--success); }
      .log-error { border-left: 2px solid var(--danger); color: var(--danger); }
      
      /* High-Contrast Result Badges */
      .res-win { color: #00ff88; font-weight: 900; text-shadow: 0 0 8px rgba(0,255,136,0.3); }
      .res-loss { color: #ff3344; font-weight: 900; text-shadow: 0 0 8px rgba(255,51,68,0.3); }
      .res-pending { color: #848e9c; font-weight: bold; }
      .res-rejected { color: #ff9800; font-weight: 900; }

      footer { background: var(--bg-panel); border-top: 1px solid var(--border); padding: 8px 20px; font-size: 10px; color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center; min-height: 30px; }
      /* High-Contrast Professional Scrollbar */
      ::-webkit-scrollbar { width: 12px; height: 12px; }
      ::-webkit-scrollbar-track { background: #0a0a0a; border-radius: 0; }
      ::-webkit-scrollbar-thumb { background: #333; border-radius: 6px; border: 2px solid #0a0a0a; }
      ::-webkit-scrollbar-thumb:hover { background: var(--accent); }

      .soro-controls { display: flex; align-items: center; gap: 10px; background: var(--bg-input); padding: 5px 10px; border-radius: 4px; border: 1px solid var(--border); margin-bottom: 12px; }

      /* Side Menu Toggle & Mobile Refinement */
      #menu-toggle {
          background: none; border: 1px solid var(--border); color: var(--accent);
          font-size: 1.5rem; cursor: pointer; padding: 5px 10px; border-radius: 4px;
          display: flex; align-items: center; justify-content: center; transition: all 0.3s;
          width: auto; /* Override global button width */
          margin-right: 15px;
      }
      #menu-toggle:hover { background: rgba(240,185,11,0.1); }
      
      aside { transition: transform 0.3s ease, width 0.3s ease; }
      aside.collapsed { width: 0; padding: 0; overflow: hidden; border: none; transform: translateX(-100%); }

          @media (max-width: 768px) {
              header { gap: 10px; padding: 0 10px; height: 60px; font-size: 0.8rem; justify-content: space-between; }
              .logo { display: none; } /* Hide Logo entirely on Mobile */
              
              .account-info { 
                gap: 5px; 
                padding-left: 0; 
                border-left: none; 
                font-size: 0.75rem; 
                flex-direction: column; /* Stack Account/Balance */
                align-items: flex-end; 
                margin-left: auto; /* Push to right */
              }
              
              #app-layout { flex-direction: column; position: relative; }

              /* Backdrop for Mobile Menu */
              #mobile-backdrop {
                  position: fixed; top: 60px; left: 0; right: 0; bottom: 0;
                  background: rgba(0,0,0,0.7);
                  z-index: 1900; /* Behind sidebar (2000), above content */
                  opacity: 0; pointer-events: none; transition: opacity 0.3s;
              }
              #mobile-backdrop.active { opacity: 1; pointer-events: auto; }

              aside { 
                  position: fixed; top: 60px; left: 0; bottom: 0; 
                  z-index: 2000; width: 85%; 
                  transform: translateX(-100%); 
                  background: var(--bg-panel);
                  box-shadow: 5px 0 15px rgba(0,0,0,0.5);
              }
              aside.active { transform: translateX(0); }
          main { padding: 10px; gap: 10px; }
          #chart-container { height: 45vh !important; }
          .panels-container { flex-direction: column; height: auto !important; }
          
          /* Optimized for Single Pulse View */
          #logs-panel { height: 60px !important; width: 100% !important; overflow: hidden; }
          #history-panel { height: 350px !important; width: 100% !important; }
          
          #current-tick-overlay { font-size: 1.5rem; top: 10px; right: 10px; padding: 5px 10px; }
      }
    </style>
  </head>
  <body>
    <!-- Mobile Backdrop -->
    <div id="mobile-backdrop"></div>
    <header>
      <button id="menu-toggle">☰</button>
      <div class="logo">TRADERKING <span style="font-size:0.8rem; background:#f0b90b; color:#000; padding:2px 8px; border-radius:4px; font-weight:bold; margin-left:10px;">V3.1.82</span></div>
      
      <!-- Market Oracle (Recommendation System) -->
      <div id="market-oracle" style="margin-left: 15px; background: rgba(240,185,11,0.05); border: 1px solid rgba(240,185,11,0.2); padding: 4px 12px; border-radius: 4px; font-size: 0.7rem; color: #f0b90b; min-width: 150px; display: flex; align-items: center; gap: 8px;">
        <span style="opacity: 0.7;">🎯 Oracle:</span>
        <strong id="oracle-recommendation">Scanning Market...</strong>
      </div>

      <div id="hud-header">
        <div id="current-tick-overlay">0.000000</div>
        <div id="candle-countdown">00:00</div>
        
        <!-- Relocated History Button -->
        <a href="/history.php" target="_blank" class="btn-history" style="text-decoration:none; background:rgba(0,0,0,0.3); color:#848e9c; padding:4px 8px; border-radius:4px; font-size:0.65rem; border:1px solid rgba(255,255,255,0.1); margin-left:10px; transition:all 0.2s;" onmouseover="this.style.borderColor='var(--accent)'; this.style.color='white'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.color='#848e9c'">History 📋</a>
      </div>

      <div id="active-trade-info"></div>

      <div class="account-info" style="border-left: 1px solid var(--border); padding-left: 20px; margin-left: 20px;">
        <span>Account: <strong id="acc-id">...</strong></span>
        <span>Balance: <strong id="balance">...</strong></span>
      </div>
    </header>

    <div id="app-layout">
      <aside>
        <!-- Connector Accordion -->
        <div class="control-group" id="panel-api">
          <div class="panel-header" onclick="this.parentElement.classList.toggle('open')">
            <h3 class="panel-title">API Connection</h3>
            <span class="panel-icon">▼</span>
          </div>
          <div class="panel-content">
            <label>App ID</label>
            <input type="text" id="app-id" placeholder="Your App ID">
            <label>Device Name (Identification)</label>
            <input type="text" id="device-name-input" placeholder="e.g. My Laptop">
            <label>API Token</label>
            <input type="password" id="api-token" placeholder="Your API Token">
            <button id="btn-connect">Connect / Save</button>
            <button id="btn-logout" style="background:#2b2f36; color:#f6465d; margin-top:5px; font-size:0.8rem;">Logout</button>
          </div>
        </div>

        <!-- Trade Settings Accordion (Moved UP) -->
        <div class="control-group" id="panel-settings">
          <div class="panel-header" onclick="this.parentElement.classList.toggle('open')">
            <h3 class="panel-title">Trade Settings</h3>
            <span class="panel-icon">▼</span>
          </div>
          <div class="panel-content">
            <label>Market</label>
            <select id="market-select">
              <optgroup label="Volatility Indices">
                <option value="R_100">Volatility 100</option>
                <option value="R_75">Volatility 75</option>
                <option value="R_50">Volatility 50</option>
                <option value="R_25">Volatility 25</option>
                <option value="R_10">Volatility 10</option>
                <option value="1HZ100V">Volatility 100 (1s)</option>
                <option value="1HZ75V">Volatility 75 (1s)</option>
                <option value="1HZ50V">Volatility 50 (1s)</option>
                <option value="1HZ25V">Volatility 25 (1s)</option>
                <option value="1HZ10V">Volatility 10 (1s)</option>
              </optgroup>
              <optgroup label="Crash/Boom Indices">
                <option value="BOOM1000">Boom 1000</option>
                <option value="BOOM500">Boom 500</option>
                <option value="CRASH1000">Crash 1000</option>
                <option value="CRASH500">Crash 500</option>
              </optgroup>
              <optgroup label="Jump Indices">
                <option value="JD10">Jump 10</option>
                <option value="JD100">Jump 100</option>
              </optgroup>
            </select>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom: 12px;">
                <div style="flex:1;">
                    <label>Stake ($)</label>
                    <input type="number" id="stake" value="1.0" step="0.1" style="margin-bottom:0;">
                </div>
                <div style="flex:1; background: rgba(240,185,11,0.1); border: 1px solid var(--accent); padding: 5px; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <label style="margin-bottom:2px; font-size:0.65rem; color:var(--accent);">Auto-Scale 🦁</label>
                    <input type="checkbox" id="strat-autoscale" style="width: auto; margin:0;">
                </div>
            </div>
            
            <div style="display:flex; gap:10px;">
              <div style="flex:1;">
                <label>Interés Compuesto</label>
                <div class="soro-controls">
                    <input type="number" id="compound-levels" value="3" min="2" max="5" style="width: 50px; border: none; margin:0;" disabled>
                    <input type="checkbox" id="compound-enabled">
                </div>
              </div>
              <div style="flex:1;">
                <label>Circuito Seguridad</label>
                <div class="soro-controls" style="border-color: var(--danger);">
                    <input type="number" id="max-losses" value="2" min="1" max="5" style="width: 50px; border: none; margin:0;" title="Pérdidas consecutivas para pausar">
                    <input type="checkbox" id="safety-circuit-enabled" checked>
                </div>
              </div>
            </div>

            <label>Duration</label>
            <div style="display:flex; gap:5px;">
              <input type="number" id="duration" value="5" style="flex:1;">
              <select id="duration-unit" style="flex:1;">
                <option value="t">Ticks</option>
                <option value="s">Seconds</option>
                <option value="m" selected>Minutes</option>
              </select>
            </div>
            
            <div class="strategy-item" style="border-bottom:none; padding:5px 0;">
                <input type="checkbox" id="sequential-mode" checked>
                <span onclick="document.getElementById('sequential-mode').click()">Modo Ciclo Completo (Espera activa) 🔄</span>
            </div>
          </div>
        </div>

        <!-- Strategy Selector Accordion (Moved DOWN) -->
        <div class="control-group" id="panel-strategies">
          <div class="panel-header" onclick="this.parentElement.classList.toggle('open')">
            <h3 class="panel-title">Active Strategies</h3>
            <span class="panel-icon">▼</span>
          </div>
          <div class="panel-content">
            <div class="strategy-item">
                <input type="checkbox" id="strat-emas" checked>
                <span onclick="document.getElementById('strat-emas').click()" title="EMA & SMA Crossover (Exact) 📈">EMA & SMA Crossover (Exact) 📈</span>
            </div>
            <div class="strategy-item">
                <input type="checkbox" id="strat-giraffa" checked>
                <span onclick="document.getElementById('strat-giraffa').click()" title="Strategy Giraffa (Fibo + SuperTrend) 🦒">Strategy Giraffa (Fibo + SuperTrend) 🦒</span>
            </div>
            <div class="strategy-item">
                <input type="checkbox" id="strat-safari">
                <span onclick="document.getElementById('strat-safari').click()" title="Strategy Safari (SMC + Ichimoku + Laguerre) 🦓">Strategy Safari (SMC + Ichimoku + Laguerre) 🦓</span>
            </div>
            <div class="strategy-item" style="background: rgba(246,70,93,0.1); border-radius: 4px; padding: 5px;">
              <input type="checkbox" id="strat-xfast">
              <span style="color: #f6465d; font-weight: 700;" title="STRATEGY X-FAST (Bollinger + Z-Score) ⚡">STRATEGY X-FAST (Bollinger + Z-Score) ⚡</span>
          </div>
            
            <div class="strategy-item" style="background: rgba(46, 189, 133, 0.1); border-radius: 4px; padding: 5px; margin-top: 5px; border: 1px solid #2ebd85; display: flex; justify-content: space-between; align-items: center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="strat-sniper">
                    <span onclick="document.getElementById('strat-sniper').click()" title="High Precision: ADX > 30 + RSI Reversal" style="color: #2ebd85; font-weight: 700;">STRATEGY SNIPER 🎯</span>
                </div>
                <input type="number" id="sniper-target" value="8" min="1" max="20" style="width: 50px; padding: 4px; margin: 0; text-align: center; border: 1px solid #2ebd85; color: #2ebd85; font-weight: bold; background: #0b0e11;" title="Meta de Wins (Target)">
            </div>

            <div class="strategy-item" style="background: rgba(0, 174, 255, 0.1); border-radius: 4px; padding: 5px; margin-top: 5px; border: 1px solid #00aeff;">
              <input type="checkbox" id="strat-olymp">
              <span style="color: #00aeff; font-weight: 700;" title="Olymp Pattern: Based on manual Price Action recovery failure">OLYMP PATTERN 🔱</span>
            </div>
            
            <div class="strategy-item" style="margin-top: 10px; border-top: 1px solid var(--border); padding-top: 10px; background: rgba(240,185,11,0.05); border-radius: 4px;">
                <input type="checkbox" id="strat-require-all">
                <strong style="font-size: 0.75rem; cursor: pointer; color: var(--accent);" onclick="document.getElementById('strat-require-all').click()">CONFIRMACIÓN TOTAL (Match All)</strong>
            </div>
            <p style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 8px;">* Activa tus sistemas favoritos. Si marcas "Confirmación Total", el bot será extremadamente selectivo.</p>
          </div>
        </div>

        <!-- Bot Lifecycle -->
        <div class="control-group" id="panel-control">
          <div class="panel-header" onclick="this.parentElement.classList.toggle('open')">
            <h3 class="panel-title">Bot Lifecycle</h3>
            <span class="panel-icon">▼</span>
          </div>
          <div class="panel-content">
            <button id="btn-start" class="btn-start">Start Bot</button>
            <button id="btn-stop" class="btn-stop" style="display:none">Stop Bot</button>
          </div>
        </div>


        <!-- Manual Trader 🦁 (New) -->
        <div class="control-group" id="panel-manual">
          <div class="panel-header" onclick="this.parentElement.classList.toggle('open')">
            <h3 class="panel-title" style="color: #64ffda;">🦁 Manual Trader</h3>
            <span class="panel-icon">▼</span>
          </div>
          <div class="panel-content">
            <div class="strategy-item" style="margin-bottom:10px;">
                <input type="checkbox" id="manual-mode-enabled">
                <span onclick="document.getElementById('manual-mode-enabled').click()">Activar Operación Manual</span>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <button id="btn-manual-call" class="btn-start" style="background:#2ebd85; opacity:0.3; cursor:not-allowed; margin-bottom:0; padding: 10px;" disabled>CALL ▲</button>
                <button id="btn-manual-put" class="btn-stop" style="background:#f6465d; opacity:0.3; cursor:not-allowed; margin-bottom:0; padding: 10px;" disabled>PUT ▼</button>
            </div>
          </div>
        </div>

        <!-- Summary Panel ⚡ -->
        <div class="control-group open" id="panel-summary" style="border: 1px solid #f0b90b; background: rgba(240,185,11,0.05); margin-top: 15px;">
          <div class="panel-header" onclick="this.parentElement.classList.toggle('open')">
            <h3 class="panel-title" style="color: #f0b90b;">⚡ Live Configuration</h3>
            <span class="panel-icon">▼</span>
          </div>
          <div class="panel-content" id="summary-content" style="font-size: 0.8rem; padding: 10px; color: #848e9c;">
            Initializing analytics...
          </div>
        </div>
      </aside>

      <main>
        <div id="chart-container">
          <div id="trade-timer-overlay">TRADE: 00:00</div>
        </div>
        <div class="panels-container">
          <div id="logs-panel"></div>
          <div id="history-panel">
            <table id="history-table">
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th>Time</th>
                  <th>Market</th>
                  <th>Type</th>
                  <th>Stake</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody id="history-body"></tbody>
            </table>
          </div>
        </div>
      </main>
    </div>

    <footer>
      <span>[MARKET-ORACLE Logic V3.1.44] Bitácora Estratégica Activa.</span>
      <span id="system-pulse" style="color: var(--success); display:none;">● Master Strategy Pulse 💓</span>
    </footer>

    <!-- Core Logic -->
    <script type="module" src="/js/main.js?v=3.1.44.<?php echo $v; ?>"></script>
    <script>
      console.log("TraderKing MARKET-ORACLE V3.1.44 Loaded. Timestamp: <?php echo $v; ?>");
    </script>
  </body>
</html>

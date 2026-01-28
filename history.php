<?php
session_start();
if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

$host = 'localhost';
$user = 'traderking';
$pass = 'traderking';
$dbname = 'traderking';

$conn = new mysqli($host, $user, $pass, $dbname);
if ($conn->connect_error) die("DB Error");

// Fetch User Config for Live Balance
$user_id = $_SESSION['user_id'];
$conf_res = $conn->query("SELECT deriv_app_id, deriv_token FROM users WHERE id = $user_id");
$config = $conf_res->fetch_assoc();
$app_id = $config['deriv_app_id'] ?? '1089';
$token = $config['deriv_token'] ?? '';

// Fetch all distinct devices for filtering
$device_res = $conn->query("SELECT DISTINCT instance_id, device_name FROM trades WHERE instance_id IS NOT NULL");
$devices = [];
while($row = $device_res->fetch_assoc()) $devices[] = $row;

$selected_instance = $_GET['instance_id'] ?? '';
$where_clause = "status != 'PENDING'";
if (!empty($selected_instance)) {
    $where_clause .= " AND instance_id = '" . $conn->real_escape_string($selected_instance) . "'";
}

// Fetch strategy stats with total count
$stats_res = $conn->query("SELECT strategy, COUNT(*) as total, SUM(CASE WHEN status='WON' THEN 1 ELSE 0 END) as wins, SUM(profit) as total_profit FROM trades WHERE $where_clause GROUP BY strategy");
$stats = [];
while($row = $stats_res->fetch_assoc()) $stats[] = $row;

// Fetch market-specific stats
$market_res = $conn->query("SELECT market, COUNT(*) as total, SUM(CASE WHEN status='WON' THEN 1 ELSE 0 END) as wins, SUM(CASE WHEN status='LOST' THEN 1 ELSE 0 END) as losses, SUM(profit) as total_profit FROM trades WHERE $where_clause GROUP BY market ORDER BY wins DESC");
$market_stats = [];
while($row = $market_res->fetch_assoc()) $market_stats[] = $row;

// Fetch global stats
$total_res = $conn->query("SELECT COUNT(*) as total_ops, SUM(profit) as grand_total FROM trades WHERE $where_clause");
$global_stats = $total_res->fetch_assoc();
$grand_total = $global_stats['grand_total'] ?? 0;
$total_ops = $global_stats['total_ops'] ?? 0;

// Fetch last 500 trades excluding pending
$trades_res = $conn->query("SELECT * FROM trades WHERE $where_clause ORDER BY timestamp DESC LIMIT 500");
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>TraderKing - Historial Maestro</title>
    <style>
        body { background: #0b0e11; color: #eaecef; font-family: 'Inter', sans-serif; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #f0b90b; text-transform: uppercase; letter-spacing: 1px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; background: #1e2329; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        th, td { padding: 15px; text-align: left; border-bottom: 1px solid #2b2f36; }
        th { background: #2b2f36; color: #848e9c; font-size: 0.75rem; text-transform: uppercase; font-weight: 600; }
        .win { color: #00ff88; font-weight: 900; text-shadow: 0 0 10px rgba(0,255,136,0.6); }
        .loss { color: #ff3344; font-weight: 900; text-shadow: 0 0 10px rgba(255,51,68,0.6); }
        .pending { color: #848e9c; font-style: italic; }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .market-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 15px; margin-top: 15px; margin-bottom: 30px; }
        .stat-card { background: #1e2329; padding: 20px; border-radius: 12px; border-top: 4px solid #f0b90b; box-shadow: 0 5px 15px rgba(0,0,0,0.3); transition: transform 0.3s; }
        .stat-card:hover, .market-chip:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.4); cursor: default; }
        .market-chip { background: #2b2f36; padding: 12px 15px; border-radius: 8px; border-left: 3px solid #f0b90b; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
        .badge { padding: 2px 6px; border-radius: 3px; font-size: 0.7rem; font-weight: bold; }
        .badge-win { background: rgba(0,255,136,0.1); color: #00ff88; }
        .badge-loss { background: rgba(255,51,68,0.1); color: #ff3344; }
        .badge-total { background: rgba(240,185,11,0.1); color: #f0b90b; }
        .filter-box { background: #1e2329; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #2b2f36; display: flex; align-items: center; gap: 15px; }
        select { background: #0b0e11; color: white; border: 1px solid #444; padding: 8px 12px; border-radius: 4px; outline: none; }
        .device-tag { font-size: 0.6rem; background: #2b2f36; padding: 2px 5px; border-radius: 3px; color: #848e9c; }
    </style>
</head>
<body>
    <div class="container">
        <h1 style="display:flex; align-items:center; justify-content: space-between; gap:10px; margin-bottom: 25px;">
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="color:#f0b90b">Shielded History</span> 
                <span style="font-size:0.8rem; background:#f0b90b; color:#000; padding:2px 8px; border-radius:4px; font-weight:bold;">V3.1.90</span>
            </div>
            <div style="display:flex; gap:15px;">
                <div style="background: rgba(255,184,0,0.1); border: 1px solid rgba(255,184,0,0.3); padding: 5px 15px; border-radius: 8px; font-size: 1rem; color: #ffb800; display:none;" id="balance-box">
                    <span style="color: #848e9c; font-size: 0.65rem; text-transform: uppercase;">Saldo Actual:</span> 
                    <strong id="live-balance">...</strong>
                </div>
                <div style="background: rgba(240,185,11,0.1); border: 1px solid rgba(240,185,11,0.2); padding: 5px 15px; border-radius: 8px; font-size: 0.9rem;">
                    <span style="color: #848e9c; font-size: 0.65rem; text-transform: uppercase;">Operaciones:</span> 
                    <strong style="color: #f0b90b;"><?php echo $total_ops; ?></strong>
                </div>
                <div style="background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.3); padding: 5px 15px; border-radius: 8px; font-size: 1rem; color: #00ff88;">
                    <span style="color: #848e9c; font-size: 0.65rem; text-transform: uppercase;">Beneficio Netto:</span> 
                    <strong>$<?php echo number_format($grand_total, 2); ?></strong>
                </div>
            </div>
        </h1>

        <div class="filter-box">
            <span style="color:#848e9c; font-size: 0.8rem; font-weight: bold;">FILTRAR POR EQUIPO:</span>
            <select onchange="window.location.href='?instance_id=' + this.value">
                <option value="">Todos los Equipos (Global)</option>
                <?php foreach($devices as $d): ?>
                    <option value="<?php echo $d['instance_id']; ?>" <?php echo $selected_instance == $d['instance_id'] ? 'selected' : ''; ?>>
                        <?php echo $d['device_name']; ?> (<?php echo $d['instance_id']; ?>)
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
        
        <div class="stat-grid">
            <?php foreach($stats as $s): ?>
                <div class="stat-card">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="color: #848e9c; font-size: 0.75rem;"><?php echo $s['strategy']; ?></div>
                        <span class="badge badge-total"><?php echo $s['total']; ?> trades</span>
                    </div>
                    <div style="font-size: 1.5rem; margin: 5px 0;">WR: <?php echo $s['total'] > 0 ? round(($s['wins']/$s['total'])*100, 1) : 0; ?>%</div>
                    <div style="font-size: 0.8rem; color: #00ff88;">Profit: $<?php echo number_format($s['total_profit'], 2); ?></div>
                </div>
            <?php endforeach; ?>
        </div>

        <h2 style="color:#848e9c; font-size: 1rem; margin-top:30px; border-bottom: 1px solid #2b2f36; padding-bottom:10px;">ANÁLISIS POR ACTIVO – RENDIMIENTO GLOBAL 🔍</h2>
        <div class="market-grid">
            <?php foreach($market_stats as $m): 
                $mWR = $m['total'] > 0 ? round(($m['wins']/$m['total'])*100, 1) : 0;
            ?>
                <div class="market-chip" style="<?php echo $mWR > 60 ? 'border-left-color: #00ff88; background: rgba(0,255,136,0.05);' : ''; ?>">
                    <div style="flex:1;">
                        <div style="font-size: 0.85rem; font-weight: bold; color: white;"><?php echo $m['market']; ?></div>
                        <div style="font-size: 0.7rem; color: #848e9c;">Ops: <span style="color:#f0b90b"><?php echo $m['total']; ?></span></div>
                    </div>
                    <div style="text-align: center; flex:1;">
                        <div style="font-size: 0.9rem; font-weight: 900; color: <?php echo $mWR > 50 ? '#00ff88' : '#ff3344'; ?>;"><?php echo $mWR; ?>%</div>
                        <div style="font-size: 0.6rem; text-transform: uppercase; color: #848e9c;">Win Rate</div>
                    </div>
                    <div style="text-align: right; flex:1;">
                        <div style="margin-bottom: 2px;">
                            <span class="badge badge-win">W:<?php echo $m['wins']; ?></span>
                            <span class="badge badge-loss">L:<?php echo $m['losses']; ?></span>
                        </div>
                        <div style="font-size: 0.75rem; font-weight: bold; color: <?php echo $m['total_profit'] >= 0 ? '#00ff88' : '#ff3344'; ?>;">
                            <?php echo ($m['total_profit'] >= 0 ? '+$' : '-$') . number_format(abs($m['total_profit']), 2); ?>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Estrategia</th>
                    <th>Equipo</th>
                    <th>Fecha/Hora</th>
                    <th>Mercado</th>
                    <th>Tipo</th>
                    <th>Stake</th>
                    <th>Resultado</th>
                </tr>
            </thead>
            <tbody>
                <?php while($t = $trades_res->fetch_assoc()): ?>
                    <tr>
                        <td style="color:#f0b90b; font-weight: bold;"><?php echo $t['strategy']; ?></td>
                        <td><span class="device-tag"><?php echo $t['device_name'] ?? 'Generic'; ?></span></td>
                        <td><?php echo $t['timestamp']; ?></td>
                        <td><?php echo $t['market']; ?></td>
                        <td style="color:<?php echo $t['type'] == 'CALL' ? '#00ff88' : '#ff3344'; ?>; font-weight: bold;"><?php echo $t['type']; ?></td>
                        <td>$<?php echo number_format($t['stake'], 2); ?></td>
                        <td class="<?php echo strtolower($t['status']); ?>">
                            <?php 
                                if($t['status'] == 'WON') echo '<span class="win">WIN (+$'.number_format($t['profit'], 2).')</span>';
                                elseif($t['status'] == 'LOST') echo '<span class="loss">LOSS ($'.number_format($t['profit'], 2).')</span>';
                                else echo '<span class="pending">'.$t['status'].'</span>';
                            ?>
                        </td>
                    </tr>
                <?php endwhile; ?>
            </tbody>
        </table>
    </div>
    <script>
        const appId = "<?php echo $app_id; ?>";
        const token = "<?php echo $token; ?>";
        
        if (token) {
            const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`);
            ws.onopen = () => ws.send(JSON.stringify({ authorize: token }));
            ws.onmessage = (msg) => {
                const data = JSON.parse(msg.data);
                if (data.msg_type === 'authorize' && data.authorize) {
                    document.getElementById('balance-box').style.display = 'block';
                    document.getElementById('live-balance').textContent = `${data.authorize.currency || 'USD'} ${parseFloat(data.authorize.balance || 0).toFixed(2)}`;
                    ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
                }
                if (data.msg_type === 'balance' && data.balance) {
                    document.getElementById('live-balance').textContent = `${data.balance.currency || 'USD'} ${parseFloat(data.balance.balance || 0).toFixed(2)}`;
                }
                // V3.1.89: Handle errors to avoid console noise
                if (data.error) {
                    console.warn("History Sync Alert:", data.error.message);
                }
            };
        }
    </script>
</body>
</html>
<?php $conn->close(); ?>

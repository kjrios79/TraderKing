<?php
header('Content-Type: application/json');

$host = 'localhost';
$user = 'traderking';
$pass = 'traderking';
$dbname = 'traderking';

$conn = new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    die(json_encode(['error' => "Connection failed: " . $conn->connect_error]));
}

$action = $_GET['action'] ?? '';

if ($action === 'save') {
    $contract_id = $_POST['contract_id'] ?? '';
    $strategy = $_POST['strategy'] ?? '';
    $market = $_POST['market'] ?? '';
    $type = $_POST['type'] ?? '';
    $stake = $_POST['stake'] ?? 0;
    $profit = $_POST['profit'] ?? null;
    $status = $_POST['status'] ?? 'PENDING';

    if (empty($contract_id)) {
        die(json_encode(['error' => 'contract_id is required']));
    }

    $stmt = $conn->prepare("INSERT INTO trades (contract_id, strategy, market, type, stake, profit, status) 
                            VALUES (?, ?, ?, ?, ?, ?, ?) 
                            ON DUPLICATE KEY UPDATE 
                            strategy = VALUES(strategy), 
                            profit = VALUES(profit), 
                            status = VALUES(status)");
    $stmt->bind_param("ssssdds", $contract_id, $strategy, $market, $type, $stake, $profit, $status);

    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => $stmt->error]);
    }
    $stmt->close();

} elseif ($action === 'fetch') {
    $result = $conn->query("SELECT * FROM trades WHERE status != 'PENDING' ORDER BY timestamp DESC LIMIT 30");
    $trades = [];
    while ($row = $result->fetch_assoc()) {
        $trades[] = $row;
    }
    echo json_encode($trades);
} else {
    echo json_encode(['error' => 'Invalid action']);
}

$conn->close();
?>

<?php
date_default_timezone_set('America/Bogota');
header('Content-Type: application/json');

$host = 'localhost';
$user = 'traderking';
$pass = 'traderking';
$dbname = 'traderking';

$conn = new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    die(json_encode(['error' => "Connection failed: " . $conn->connect_error]));
}
$conn->query("SET time_zone = '-05:00'");

$action = $_GET['action'] ?? '';

if ($action === 'save') {
    $contract_id = $_POST['contract_id'] ?? '';
    $instance_id = $_POST['instance_id'] ?? 'GENERIC';
    $device_name = $_POST['device_name'] ?? 'Unknown Device';
    $strategy = $_POST['strategy'] ?? '';
    $market = $_POST['market'] ?? '';
    $type = $_POST['type'] ?? '';
    $stake = $_POST['stake'] ?? 0;
    $profit = $_POST['profit'] ?? null;
    $status = $_POST['status'] ?? 'PENDING';
    $indicators = $_POST['indicators_json'] ?? null;

    if (empty($contract_id)) {
        die(json_encode(['error' => 'contract_id is required']));
    }

    $stmt = $conn->prepare("INSERT INTO trades (contract_id, instance_id, device_name, strategy, market, type, stake, profit, status, indicators_json) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                            ON DUPLICATE KEY UPDATE 
                            strategy = VALUES(strategy), 
                            profit = VALUES(profit), 
                            status = VALUES(status),
                            indicators_json = VALUES(indicators_json)");
    $stmt->bind_param("ssssssddss", $contract_id, $instance_id, $device_name, $strategy, $market, $type, $stake, $profit, $status, $indicators);

    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => $stmt->error]);
    }
    $stmt->close();

} elseif ($action === 'fetch') {
    $instance_id = $_GET['instance_id'] ?? '';
    $query = "SELECT * FROM trades WHERE status != 'PENDING'";
    
    if (!empty($instance_id)) {
        $query .= " AND instance_id = '" . $conn->real_escape_string($instance_id) . "'";
    }
    
    $query .= " ORDER BY timestamp DESC LIMIT 30";
    
    $result = $conn->query($query);
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

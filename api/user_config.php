<?php
// api/user_config.php
session_start();
require_once '../includes/db.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$user_id = $_SESSION['user_id'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare("SELECT deriv_app_id, deriv_token FROM users WHERE id = ?");
    $stmt->execute([$user_id]);
    $data = $stmt->fetch();
    echo json_encode(['success' => true, 'data' => $data]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $app_id = $_POST['app_id'] ?? '';
    $token = $_POST['token'] ?? '';

    $stmt = $pdo->prepare("UPDATE users SET deriv_app_id = ?, deriv_token = ? WHERE id = ?");
    if ($stmt->execute([$app_id, $token, $user_id])) {
        echo json_encode(['success' => true, 'message' => 'Configuration saved']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Save failed']);
    }
    exit;
}
?>

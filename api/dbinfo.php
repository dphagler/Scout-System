<?php
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/config.php';
cors_preflight();

$clientKey = client_api_key();
global $API_KEY;
if (!isset($API_KEY) || !$clientKey || !hash_equals($API_KEY, $clientKey)) {
  http_response_code(401);
  echo json_encode(['ok'=>false,'error'=>'unauthorized']); exit;
}

try {
  $pdo = db();
  $pdo->query('SELECT 1'); // ping
  echo json_encode(['ok'=>true, 'db'=>$GLOBALS['DB_NAME'] ?? null, 'php'=>PHP_VERSION]);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>'exception','details'=>$e->getMessage()]);
}

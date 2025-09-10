<?php
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/config.php';
cors_preflight();

try {
  $clientKey = client_api_key();
  global $API_KEY;
  if (!isset($API_KEY) || !$clientKey || !hash_equals($API_KEY, $clientKey)) {
    http_response_code(401);
    echo json_encode(['ok'=>false,'error'=>'unauthorized']); exit;
  }

  $event = strtolower(trim($_GET['event'] ?? ''));
  $team  = intval($_GET['team'] ?? 0);
  if ($event === '' || !$team) {
    http_response_code(400);
    echo json_encode(['ok'=>false,'error'=>'missing_params']); exit;
  }

  $root = dirname(__DIR__); // server/
  $dir  = $root . '/uploads/pit';
  $photos = [];

  if (is_dir($dir)) {
    $safeEvent = preg_replace('~[^a-z0-9_]~', '', $event);
    $pattern   = sprintf('%s/%s_%d_*.*', $dir, $safeEvent, (int)$team);
    $matches   = glob($pattern);
    sort($matches); // deterministic order
    $scheme    = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host      = $_SERVER['HTTP_HOST'] ?? '';
    foreach ($matches as $path) {
      $url = $scheme . '://' . $host . '/uploads/pit/' . basename($path);
      $photos[] = $url;
      if (count($photos) >= 3) break;
    }
  }

  echo json_encode(['ok'=>true, 'photos'=>$photos]);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>'exception','details'=>$e->getMessage()]);
}

<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';
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

  $root   = dirname(__DIR__); // server/
  $base   = $root . '/uploads/pit';
  $photos = [];

  $safeEvent = preg_replace('~[^a-z0-9_]~', '', $event);
  $teamInt   = (int)$team;
  $dir       = $base . '/' . $safeEvent . '/' . $teamInt;

  if (is_dir($dir)) {
    $files  = glob($dir . '/*.*');
    sort($files); // deterministic order
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    foreach ($files as $path) {
      if (!is_file($path)) { continue; }
      $rel = '/uploads/pit/' . rawurlencode($safeEvent) . '/' . rawurlencode((string)$teamInt) . '/' . rawurlencode(basename($path));
      $photos[] = $scheme . '://' . $host . $rel;
      if (count($photos) >= 3) break;
    }
  }

  echo json_encode(['ok'=>true, 'photos'=>$photos], JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>'exception','details'=>$e->getMessage()]);
}

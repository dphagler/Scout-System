<?php
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="team_averages.csv"');
require_once __DIR__ . '/config.php';
cors_preflight();

$clientKey = client_api_key();
global $API_KEY;
if (!isset($API_KEY) || !$clientKey || !hash_equals($API_KEY, $clientKey)) {
  http_response_code(401); echo "unauthorized"; exit;
}
$event = strtolower(trim($_GET['event'] ?? ''));
if ($event === '') { http_response_code(400); echo "missing_event"; exit; }

ob_start();
$_GET['event'] = $event;
include __DIR__ . '/dash_summary.php';
$out = ob_get_clean();
$js = json_decode($out, true);
if (!is_array($js) || empty($js['ok'])) { echo "error"; exit; }

$teams = $js['teams'] ?? [];
$metricKeys = $js['stats']['metrics_keys'] ?? [];

$fh = fopen('php://output', 'w');
$headers = array_merge(['team_number','nickname','played'], array_map(function($k){ return "avg_" . $k; }, $metricKeys));
fputcsv($fh, $headers, ',', chr(34), '\\');
foreach ($teams as $t) {
  $row = [$t['team_number'], $t['nickname'] ?? '', $t['played'] ?? 0];
  foreach ($metricKeys as $k) { $row[] = $t['avg'][$k] ?? 0; }
  fputcsv($fh, $row, ',', chr(34), '\\');
}
fclose($fh);

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

// Gather select field options across teams so we can export percent columns
$selectOpts = [];
foreach ($teams as $t) {
  $sel = $t['select_pct'] ?? [];
  foreach ($sel as $field => $opts) {
    if (!isset($selectOpts[$field])) $selectOpts[$field] = [];
    foreach ($opts as $opt => $pct) { $selectOpts[$field][$opt] = true; }
  }
}
ksort($selectOpts); foreach ($selectOpts as $k=>$_) { ksort($selectOpts[$k]); }

$fh = fopen('php://output', 'w');
$headers = ['team_number','nickname','played'];
foreach ($metricKeys as $k) { $headers[] = "avg_" . $k; }
foreach ($selectOpts as $field => $opts) {
  foreach (array_keys($opts) as $opt) { $headers[] = "pct_{$field}:{$opt}"; }
}
$headers = array_merge($headers, [
  'penalties_avg','driver_skill_avg','defense_played_avg','defense_resilience_avg','broke_down_pct'
]);
fputcsv($fh, $headers, ',', chr(34), '\\');
foreach ($teams as $t) {
  $row = [$t['team_number'], $t['nickname'] ?? '', $t['played'] ?? 0];
  foreach ($metricKeys as $k) { $row[] = $t['avg'][$k] ?? 0; }
  foreach ($selectOpts as $field => $opts) {
    foreach (array_keys($opts) as $opt) {
      $row[] = $t['select_pct'][$field][$opt] ?? 0;
    }
  }
  $row[] = $t['penalties_avg'] ?? 0;
  $row[] = $t['driver_skill_avg'] ?? 0;
  $row[] = $t['defense_played_avg'] ?? 0;
  $row[] = $t['defense_resilience_avg'] ?? 0;
  $row[] = $t['broke_down_pct'] ?? 0;
  fputcsv($fh, $row, ',', chr(34), '\\');
}
fclose($fh);

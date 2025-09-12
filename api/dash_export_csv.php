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

// Gather select field options across all teams so each gets a column
$selectMap = [];
foreach ($teams as $team) {
  $sel = $team['select_pct'] ?? [];
  foreach ($sel as $field => $opts) {
    foreach ($opts as $opt => $_) {
      if (!isset($selectMap[$field])) $selectMap[$field] = [];
      $selectMap[$field][$opt] = true;
    }
  }
  // Legacy endgame_pct field (already included in select_pct but keep just in case)
  $endSel = $team['endgame_pct'] ?? [];
  foreach ($endSel as $opt => $_) {
    if (!isset($selectMap['endgame'])) $selectMap['endgame'] = [];
    $selectMap['endgame'][$opt] = true;
  }
}

$selectKeys = [];
foreach ($selectMap as $field => $opts) {
  foreach (array_keys($opts) as $opt) {
    $selectKeys[] = $field . ':' . $opt;
  }
}
sort($metricKeys);
sort($selectKeys);

$fh = fopen('php://output', 'w');
$headers = array_merge(
  ['team_number','nickname','played'],
  array_map(function($k){ return 'avg_' . $k; }, $metricKeys),
  array_map(function($k){ return 'pct_' . $k; }, $selectKeys),
  ['penalties_avg','driver_skill_avg','defense_played_avg','defended_by_avg','broke_down_pct']
);
fputcsv($fh, $headers, ',', chr(34), '\\');

foreach ($teams as $t) {
  $row = [$t['team_number'], $t['nickname'] ?? '', $t['played'] ?? 0];
  foreach ($metricKeys as $k) {
    $row[] = $t['avg'][$k] ?? 0;
  }
  foreach ($selectKeys as $k) {
    $parts = explode(':', $k, 2);
    $field = $parts[0]; $opt = $parts[1] ?? '';
    $row[] = $t['select_pct'][$field][$opt] ?? $t['endgame_pct'][$opt] ?? 0;
  }
  $row[] = $t['penalties_avg'] ?? 0;
  $row[] = $t['driver_skill_avg'] ?? 0;
  $row[] = $t['defense_played_avg'] ?? 0;
  $row[] = $t['defended_by_avg'] ?? 0;
  $row[] = $t['broke_down_pct'] ?? 0;
  fputcsv($fh, $row, ',', chr(34), '\\');
}
fclose($fh);

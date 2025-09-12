<?php
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="pit_scouting.csv"');
require_once __DIR__ . '/config.php';
cors_preflight();

$clientKey = client_api_key();
global $API_KEY;
if (!isset($API_KEY) || !$clientKey || !hash_equals($API_KEY, $clientKey)) {
  http_response_code(401); echo "unauthorized"; exit;
}

$event = strtolower(trim($_GET['event'] ?? ''));
if ($event === '') { http_response_code(400); echo "missing_event"; exit; }

$pdo = db();
$stmt = $pdo->prepare(
  "SELECT team_number, drivetrain, weight_lb, dims_json, autos, mechanisms_json, notes, photos_json, scout_name, device_id, created_at_ms, schema_version FROM pit_records WHERE event_key = :event ORDER BY team_number"
);
$stmt->execute([':event' => $event]);

$fh = fopen('php://output', 'w');
$headers = ['team_number','drivetrain','weight_lb','dim_h','dim_w','dim_l','autos','mechanisms','notes','photos_json','scout_name','device_id','created_at_ms','schema_version'];
fputcsv($fh, $headers, ',', chr(34), '\\');

while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
  $dims = json_decode($r['dims_json'] ?? '', true) ?: [];
  $mech = json_decode($r['mechanisms_json'] ?? '', true);
  $mechanisms = '';
  if (is_array($mech)) {
    if (array_key_exists('text', $mech)) $mechanisms = $mech['text'];
    else $mechanisms = json_encode($mech, JSON_UNESCAPED_SLASHES);
  }
  $row = [
    $r['team_number'],
    $r['drivetrain'],
    $r['weight_lb'],
    $dims['h'] ?? '',
    $dims['w'] ?? '',
    $dims['l'] ?? '',
    $r['autos'],
    $mechanisms,
    $r['notes'],
    $r['photos_json'],
    $r['scout_name'],
    $r['device_id'],
    $r['created_at_ms'],
    $r['schema_version'],
  ];
  fputcsv($fh, $row, ',', chr(34), '\\');
}
fclose($fh);


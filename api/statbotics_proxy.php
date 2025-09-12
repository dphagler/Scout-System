<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';
cors_preflight();

$clientKey = client_api_key();
global $API_KEY;
if (!isset($API_KEY) || !$clientKey || !hash_equals($API_KEY, $clientKey)) {
  http_response_code(401);
  echo json_encode(['ok'=>false,'error'=>'unauthorized']); exit;
}

function sb_get($path) {
  $url = "https://api.statbotics.io/v3/" . ltrim($path, "/");
  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);
  curl_setopt($ch, CURLOPT_TIMEOUT, 10);
  $resp = curl_exec($ch);
  $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err = curl_error($ch);
  curl_close($ch);
  if ($resp === false || $status < 200 || $status >= 300) {
    http_response_code(502);
    echo json_encode(['ok'=>false,'error'=>'statbotics_bad_gateway','status'=>$status,'curl_error'=>$err]); exit;
  }
  $data = json_decode($resp, true);
  if (!is_array($data)) { echo json_encode(['ok'=>false,'error'=>'statbotics_invalid_json']); exit; }
  return $data;
}

$kind = $_GET['kind'] ?? 'team_year';
$team = isset($_GET['team']) ? intval($_GET['team']) : null;
$year = isset($_GET['year']) ? intval($_GET['year']) : null;
$event = isset($_GET['event']) ? strtolower(trim($_GET['event'])) : null;

try {
  if ($kind === 'team_year') {
    if (!$team || !$year) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'missing_team_or_year']); exit; }
    $data = sb_get("team_year/$team/$year");
    echo json_encode(['ok'=>true,'kind'=>$kind,'data'=>$data]);
  } elseif ($kind === 'team_event') {
    if (!$team || !$event) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'missing_team_or_event']); exit; }
    $data = sb_get("team_event/$team/$event");
    echo json_encode(['ok'=>true,'kind'=>$kind,'data'=>$data]);
  } elseif ($kind === 'team_matches') {
    if (!$team) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'missing_team']); exit; }
    if ($event) {
      $data = sb_get("team_matches?team=$team&event=" . urlencode($event) . "&limit=1000");
    } elseif ($year) {
      $data = sb_get("team_matches?team=$team&year=$year&limit=1000");
    } else {
      $data = sb_get("team_matches?team=$team&limit=1000");
    }
    echo json_encode(['ok'=>true,'kind'=>$kind,'data'=>$data]);
  } elseif ($kind === 'team') {
    if (!$team) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'missing_team']); exit; }
    $data = sb_get("team/$team");
    echo json_encode(['ok'=>true,'kind'=>$kind,'data'=>$data]);
  } else {
    http_response_code(400); echo json_encode(['ok'=>false,'error'=>'bad_kind']); exit;
  }
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>'exception','details'=>$e->getMessage()]);
}

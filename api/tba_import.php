<?php
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/config.php';
cors_preflight();

$clientKey = client_api_key();
global $API_KEY, $TBA_KEY;
if (!isset($API_KEY) || !$clientKey || !hash_equals($API_KEY, $clientKey)) {
  http_response_code(401);
  echo json_encode(['ok'=>false, 'error'=>'unauthorized']); exit;
}
$event = strtolower(trim($_GET['event'] ?? ''));
if ($event === '') { http_response_code(400); echo json_encode(['ok'=>false, 'error'=>'missing_event']); exit; }
if (empty($TBA_KEY)) { http_response_code(500); echo json_encode(['ok'=>false,'error'=>'missing_tba_key_in_config']); exit; }

function clip($s, $n) { if ($s === null) return null; $s = (string)$s; return mb_substr($s, 0, $n, 'UTF-8'); }
function num_from_team_key($key) { return (int)preg_replace('/\D+/', '', (string)$key); }
function tbaGET($path, $TBA_KEY) {
  $url = "https://www.thebluealliance.com/api/v3$path";
  $ch = curl_init($url);
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["X-TBA-Auth-Key: $TBA_KEY","Accept: application/json"], CURLOPT_TIMEOUT=>25]);
  $out = curl_exec($ch);
  if ($out === false) throw new RuntimeException('TBA curl error: '.curl_error($ch));
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
  if ($code < 200 || $code >= 300) throw new RuntimeException("TBA HTTP $code for $path");
  $json = json_decode($out, true);
  if (!is_array($json)) throw new RuntimeException("TBA non-JSON for $path");
  return $json;
}

try {
  $pdo = db();
  $pdo->beginTransaction();

  $teams = tbaGET("/event/$event/teams/simple", $TBA_KEY);
  $insTeam = $pdo->prepare("
    INSERT INTO teams (team_number, nickname, name, city, state_prov, country, rookie_year, website)
    VALUES (:n,:nick,:name,:city,:state,:country,:rookie,:web)
    ON DUPLICATE KEY UPDATE
      nickname=VALUES(nickname), name=VALUES(name), city=VALUES(city),
      state_prov=VALUES(state_prov), country=VALUES(country),
      rookie_year=VALUES(rookie_year), website=VALUES(website)
  ");
  $teamCount = 0;
  foreach ($teams as $t) {
    $num = isset($t['team_number']) ? (int)$t['team_number'] : num_from_team_key($t['key'] ?? '');
    if ($num <= 0) continue;
    $insTeam->execute([
      ':n'=>$num, ':nick'=>clip($t['nickname'] ?? null,255),
      ':name'=>clip($t['name'] ?? null,255), ':city'=>clip($t['city'] ?? null,128),
      ':state'=>clip($t['state_prov'] ?? null,128), ':country'=>clip($t['country'] ?? null,128),
      ':rookie'=>isset($t['rookie_year'])?(int)$t['rookie_year']:null, ':web'=>clip($t['website'] ?? null,255)
    ]);
    $teamCount++;
  }

  $matches = tbaGET("/event/$event/matches/simple", $TBA_KEY);
  $insMatch = $pdo->prepare("
    INSERT INTO matches_schedule
      (match_key, event_key, comp_level, set_number, match_number, time_utc,
       red1, red2, red3, blue1, blue2, blue3, field)
    VALUES (:key,:event,:lvl,:setn,:mn,:time,:r1,:r2,:r3,:b1,:b2,:b3,:field)
    ON DUPLICATE KEY UPDATE comp_level=VALUES(comp_level), set_number=VALUES(set_number),
      match_number=VALUES(match_number), time_utc=VALUES(time_utc),
      red1=VALUES(red1), red2=VALUES(red2), red3=VALUES(red3),
      blue1=VALUES(blue1), blue2=VALUES(blue2), blue3=VALUES(blue3), field=VALUES(field)
  ");
  $matchCount = 0;
  foreach ($matches as $m) {
    $lvl = strtolower($m['comp_level'] ?? 'qm'); if ($lvl !== 'qm') continue;
    $red = array_map('num_from_team_key', $m['alliances']['red']['team_keys'] ?? []);
    $blue= array_map('num_from_team_key', $m['alliances']['blue']['team_keys'] ?? []);
    if (count($red) < 3 || count($blue) < 3) continue;
    $ts = null; if (!empty($m['time'])) $ts = (int)$m['time']; elseif (!empty($m['predicted_time'])) $ts = (int)$m['predicted_time'];
    $timeUtc = $ts ? gmdate('Y-m-d H:i:s', $ts) : null;
    $insMatch->execute([
      ':key'=>$m['key'] ?? '', ':event'=>$event, ':lvl'=>'qm',
      ':setn'=>(int)($m['set_number'] ?? 1), ':mn'=>(int)($m['match_number'] ?? 0),
      ':time'=>$timeUtc,
      ':r1'=>(int)$red[0], ':r2'=>(int)$red[1], ':r3'=>(int)$red[2],
      ':b1'=>(int)$blue[0],':b2'=>(int)$blue[1],':b3'=>(int)$blue[2],
      ':field'=>!empty($m['field'])?substr($m['field'],0,64):null
    ]);
    $matchCount++;
  }

  $pdo->commit();
  echo json_encode(['ok'=>true, 'event'=>$event, 'teams'=>$teamCount, 'matches'=>$matchCount]);
} catch (Throwable $e) {
  if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>'tba_import_failed','details'=>$e->getMessage()]);
}

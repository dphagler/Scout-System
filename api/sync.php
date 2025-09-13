<?php
// Sync endpoint: accepts JSON payload with { pit: [...], match: [...] }.
// - Pit photos are expected to be uploaded separately (e.g., via upload_photo.php) and referenced by URLs in rec.photos[]
// - This endpoint persists pit_records and match_records with last-write-wins semantics
// - CORS + API key handled via config.php helpers

require_once __DIR__ . '/config.php';

cors_preflight();

// Verify API key
require_api_key();

// Decode JSON body
$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);
if (!is_array($payload)) { $payload = []; }

$pit   = isset($payload['pit'])   && is_array($payload['pit'])   ? $payload['pit']   : [];
$match = isset($payload['match']) && is_array($payload['match']) ? $payload['match'] : [];

$pdo = db();

// ----------------------------
// Helpers
// ----------------------------
function jenc($v) {
  if ($v === null) return null;
  return json_encode($v, JSON_UNESCAPED_SLASHES);
}
function to_int($v, $def = 0) {
  if ($v === null || $v === '') return $def;
  return (int)$v;
}
function to_bool01($v) {
  if (is_bool($v)) return $v ? 1 : 0;
  if (is_numeric($v)) return ((int)$v) ? 1 : 0;
  if (is_string($v)) {
    $vv = strtolower(trim($v));
    return in_array($vv, ['1','true','yes','y','on'], true) ? 1 : 0;
  }
  return 0;
}
function to_str_or_null($v) {
  if ($v === null) return null;
  $s = trim((string)$v);
  return $s === '' ? null : $s;
}

// ----------------------------
// PIT RECORDS
// last-write-wins by (event_key, team_number)
// ----------------------------
$pitSynced = 0;

if (!empty($pit)) {
  // Prepare once
  $stmtPitDelete = $pdo->prepare("
    DELETE FROM pit_records
     WHERE event_key = :event_key AND team_number = :team_number
  ");
  $stmtPitInsert = $pdo->prepare("
    INSERT INTO pit_records
      (event_key, team_number, drivetrain, weight_lb, dims_json, autos,
       mechanisms_json, notes, photos_json,
       scout_name, device_id, created_at_ms, schema_version)
    VALUES
      (:event_key, :team_number, :drivetrain, :weight_lb, :dims_json, :autos,
       :mechanisms_json, :notes, :photos_json,
       :scout_name, :device_id, :created_at_ms, :schema_version)
  ");

  foreach ($pit as $r) {
    if (!is_array($r)) continue;

    $event_key   = to_str_or_null($r['eventKey'] ?? null);
    $team_number = to_int($r['teamNumber'] ?? 0);
    if (!$event_key || !$team_number) continue;

    $drivetrain  = to_str_or_null($r['drivetrain'] ?? null);
    $weight_lb   = isset($r['weightLb']) && $r['weightLb'] !== '' ? (float)$r['weightLb'] : null;
    $dims_json   = jenc($r['dims'] ?? null);
    $autos       = to_str_or_null($r['autos'] ?? null);

    // mechanisms: free-text (string) OR legacy array -> store in JSON column
    $mechVal = null;
    if (array_key_exists('mechanisms', $r)) {
      $mech = $r['mechanisms'];
      if (is_array($mech)) {
        $mechVal = $mech; // keep old array form if provided
      } else {
        $str = to_str_or_null($mech);
        if ($str !== null) { $mechVal = ['text' => $str]; }
      }
    } elseif (array_key_exists('mechanisms_json', $r)) {
      // if client already supplied mechanisms_json, trust it
      $mechVal = $r['mechanisms_json'];
    }
    $mechanisms_json = jenc($mechVal);

    $notes       = to_str_or_null($r['notes'] ?? null);
    $photos_json = jenc($r['photos'] ?? []); // URLs only; no blobs here

    $scout_name  = to_str_or_null($r['scoutName'] ?? null);
    $device_id   = to_str_or_null($r['deviceId'] ?? null);
    $created_at  = (string)($r['createdAt'] ?? 0);
    $schema_ver  = isset($r['schemaVersion']) ? (int)$r['schemaVersion'] : null;

    // last-write-wins: delete then insert
    $stmtPitDelete->execute([
      ':event_key'   => $event_key,
      ':team_number' => $team_number,
    ]);

    $stmtPitInsert->execute([
      ':event_key'       => $event_key,
      ':team_number'     => $team_number,
      ':drivetrain'      => $drivetrain,
      ':weight_lb'       => $weight_lb,
      ':dims_json'       => $dims_json,
      ':autos'           => $autos,
      ':mechanisms_json' => $mechanisms_json,
      ':notes'           => $notes,
      ':photos_json'     => $photos_json,
      ':scout_name'      => $scout_name,
      ':device_id'       => $device_id,
      ':created_at_ms'   => $created_at,
      ':schema_version'  => $schema_ver,
    ]);

    $pitSynced++;
  }
}

// ----------------------------
// MATCH RECORDS
// last-write-wins by UNIQUE (match_key, team_number)
// ----------------------------
$matchSynced = 0;

if (!empty($match)) {
  $stmtMatch = $pdo->prepare("
    INSERT INTO match_records
      (match_key, alliance, position, team_number,
       metrics_json,
       penalties, broke_down, defense_played, defense_resilience, driver_skill, card, comments,
       scout_name, device_id, created_at_ms, schema_version)
    VALUES
      (:match_key, :alliance, :position, :team_number,
       :metrics_json,
       :penalties, :broke_down, :defense_played, :defense_resilience, :driver_skill, :card, :comments,
       :scout_name, :device_id, :created_at_ms, :schema_version)
    ON DUPLICATE KEY UPDATE
       alliance        = VALUES(alliance),
       position        = VALUES(position),
       metrics_json    = VALUES(metrics_json),
       penalties       = VALUES(penalties),
       broke_down      = VALUES(broke_down),
       defense_played  = VALUES(defense_played),
       defense_resilience = VALUES(defense_resilience),
       driver_skill    = VALUES(driver_skill),
       card            = VALUES(card),
       comments        = VALUES(comments),
       scout_name      = VALUES(scout_name),
       device_id       = VALUES(device_id),
       created_at_ms   = VALUES(created_at_ms),
       schema_version  = VALUES(schema_version)
  ");

  foreach ($match as $r) {
    if (!is_array($r)) continue;

    $match_key  = to_str_or_null($r['matchKey'] ?? null);
    $team_number= to_int($r['teamNumber'] ?? 0);
    if (!$match_key || !$team_number) continue;

    $alliance   = to_str_or_null($r['alliance'] ?? null); // 'red'|'blue'
    // DB column is 'position', client uses 'station' (e.g., 'red1')
    $position   = to_str_or_null($r['station'] ?? null);

    // Ensure 'notes' isn't duplicated inside metrics_json; client attempts to strip, but be safe
    $metrics    = $r['metrics'] ?? null;
    if (is_array($metrics) && array_key_exists('notes', $metrics)) {
      unset($metrics['notes']);
    }
    $metrics_json = jenc($metrics);

    $penalties    = to_int($r['penalties'] ?? 0);
    $broke_down   = to_bool01($r['brokeDown'] ?? 0);
    $def_played   = to_int($r['defensePlayed'] ?? 0);
    $def_resilience = to_int($r['defenseResilience'] ?? 0);
    $driver_skill = to_int($r['driverSkill'] ?? 0);
    $card         = to_str_or_null($r['card'] ?? null);
    $comments     = to_str_or_null($r['comments'] ?? null);

    $scout_name   = to_str_or_null($r['scoutName'] ?? null);
    $device_id    = to_str_or_null($r['deviceId'] ?? null);
    $created_at   = (string)($r['createdAt'] ?? 0);
    $schema_ver   = isset($r['schemaVersion']) ? (int)$r['schemaVersion'] : null;

    $stmtMatch->execute([
      ':match_key'      => $match_key,
      ':alliance'       => $alliance,
      ':position'       => $position,
      ':team_number'    => $team_number,
      ':metrics_json'   => $metrics_json,
      ':penalties'      => $penalties,
      ':broke_down'     => $broke_down,
      ':defense_played' => $def_played,
      ':defense_resilience' => $def_resilience,
      ':driver_skill'   => $driver_skill,
      ':card'           => $card,
      ':comments'       => $comments,
      ':scout_name'     => $scout_name,
      ':device_id'      => $device_id,
      ':created_at_ms'  => $created_at,
      ':schema_version' => $schema_ver,
    ]);

    $matchSynced++;
  }
}

// Done
echo json_encode([
  'ok' => true,
  'pitSynced' => $pitSynced,
  'matchSynced' => $matchSynced
], JSON_UNESCAPED_SLASHES);

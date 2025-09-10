<?php
require_once __DIR__ . '/config.php';
cors_preflight();

header('Content-Type: application/json; charset=utf-8');

try {
  $key = client_api_key();
  if (!$key || $key !== $API_KEY) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'unauthorized']); exit;
  }

  $event = isset($_GET['event']) ? trim($_GET['event']) : '';
  $team  = isset($_GET['team'])  ? intval($_GET['team']) : 0;

  if ($event === '' || $team <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'bad_request']); exit;
  }

  $pdo = db();

  // --- Team meta (nickname/name)
  $meta = null;
  $stmt = $pdo->prepare("SELECT team_number, nickname, name FROM teams WHERE team_number = ? LIMIT 1");
  $stmt->execute([$team]);
  $meta = $stmt->fetch() ?: null;

  // --- Latest pit record (if any)
  $stmt = $pdo->prepare("
    SELECT *
    FROM pit_records
    WHERE event_key = ? AND team_number = ?
    ORDER BY created_at_ms DESC
    LIMIT 1
  ");
  $stmt->execute([$event, $team]);
  $pit = $stmt->fetch() ?: null;

  // --- Recent matches for this team at this event (latest first, up to 10)
  $stmt = $pdo->prepare("
    SELECT match_key, alliance, position, team_number,
           metrics_json, flags_json, penalties, broke_down,
           defense_played, defended_by, driver_skill, endgame, card,
           comments, scout_name, device_id, created_at_ms, schema_version
    FROM match_records
    WHERE team_number = ?
      AND match_key LIKE CONCAT(?, '_%')
    ORDER BY created_at_ms DESC
    LIMIT 10
  ");
  $stmt->execute([$team, $event]);
  $recent = $stmt->fetchAll() ?: [];

  // --- Aggregate (light) — penalties & driver skill averages
  $stmt = $pdo->prepare("
    SELECT
      COUNT(*)                           AS played,
      AVG(NULLIF(penalties, NULL))       AS penalties_avg,
      AVG(NULLIF(driver_skill, NULL))    AS driver_skill_avg
    FROM match_records
    WHERE team_number = ?
      AND match_key LIKE CONCAT(?, '_%')
  ");
  $stmt->execute([$team, $event]);
  $agg = $stmt->fetch() ?: ['played'=>0,'penalties_avg'=>null,'driver_skill_avg'=>null];

  // --- Endgame & flags percentages (optional, tolerate missing/invalid JSON)
  $flagsPct = [];
  $endgamePct = [];
  $stmt = $pdo->prepare("
    SELECT flags_json, endgame
    FROM match_records
    WHERE team_number = ?
      AND match_key LIKE CONCAT(?, '_%')
  ");
  $stmt->execute([$team, $event]);
  $rows = $stmt->fetchAll();
  $cnt = max(1, count($rows));
  foreach ($rows as $r) {
    // endgame
    $eg = $r['endgame'] ?? null;
    if ($eg) {
      $k = strtolower(trim($eg));
      $endgamePct[$k] = ($endgamePct[$k] ?? 0) + 1;
    }
    // flags
    $fj = $r['flags_json'] ?? null;
    if ($fj) {
      $obj = is_string($fj) ? json_decode($fj, true) : $fj;
      if (is_array($obj)) {
        foreach ($obj as $k => $v) {
          if ($v) $flagsPct[$k] = ($flagsPct[$k] ?? 0) + 1;
        }
      }
    }
  }
  foreach ($endgamePct as $k => $v) { $endgamePct[$k] = round($v * 1000 / $cnt) / 10; }
  foreach ($flagsPct   as $k => $v) { $flagsPct[$k]   = round($v * 1000 / $cnt) / 10; }

  // --- Ensure pit photos have correct PUBLIC path if photos_json is empty and files exist
  // We DO NOT assume /server/uploads here; public path is /uploads/...
  if ($pit && empty($pit['photos_json'])) {
    $imgDir = __DIR__ . '/../uploads/pit/' . $event . '/' . $team;
    if (is_dir($imgDir)) {
      $files = glob($imgDir . '/*.{jpg,jpeg,png,webp}', GLOB_BRACE);
      if ($files && count($files)) {
        // Build relative public URLs
        $urls = [];
        foreach ($files as $f) {
          $basename = basename($f);
          $urls[] = '/uploads/pit/' . rawurlencode($event) . '/' . rawurlencode((string)$team) . '/' . rawurlencode($basename);
        }
        $pit['photos_json'] = json_encode($urls, JSON_UNESCAPED_SLASHES);
      }
    }
  }

  echo json_encode([
    'ok' => true,
    'meta' => $meta,
    'pit' => $pit,
    'recent' => $recent,
    'played' => intval($agg['played'] ?? 0),
    'penalties_avg' => $agg['penalties_avg'] !== null ? floatval($agg['penalties_avg']) : null,
    'driver_skill_avg' => $agg['driver_skill_avg'] !== null ? floatval($agg['driver_skill_avg']) : null,
    'flags_pct' => (object)$flagsPct,
    'endgame_pct' => (object)$endgamePct
  ], JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'exception', 'details' => $e->getMessage()]);
}

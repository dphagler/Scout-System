<?php
require_once __DIR__ . '/config.php';
cors_preflight();

header('Content-Type: application/json; charset=utf-8');

try {
  require_api_key();

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
           metrics_json, penalties, broke_down,
           defense_played, defended_by, driver_skill, card,
           comments, scout_name, device_id, created_at_ms, schema_version
    FROM match_records
    WHERE team_number = ?
      AND match_key LIKE CONCAT(?, '_%')
    ORDER BY created_at_ms DESC
    LIMIT 10
  ");
  $stmt->execute([$team, $event]);
  $recent = $stmt->fetchAll() ?: [];
  // Derive simple 'endgame' label from metrics_json if available
  foreach ($recent as &$rec) {
    $eg = null;
    $mj = $rec['metrics_json'] ?? null;
    if ($mj) {
      $m = is_string($mj) ? json_decode($mj, true) : $mj;
      if (is_array($m)) {
        if (isset($m['endgame'])) {
          $eg = is_string($m['endgame']) ? $m['endgame'] : (string)$m['endgame'];
        } elseif (isset($m['endgame_climb'])) {
          $eg = is_string($m['endgame_climb']) ? $m['endgame_climb'] : (string)$m['endgame_climb'];
        } elseif (isset($m['endgame_status'])) {
          $eg = is_string($m['endgame_status']) ? $m['endgame_status'] : (string)$m['endgame_status'];
        } elseif (isset($m['end'])) {
          $eg = is_string($m['end']) ? $m['end'] : (string)$m['end'];
        } elseif (isset($m['climb'])) {
          $eg = is_string($m['climb']) ? $m['climb'] : (string)$m['climb'];
        }
      }
    }
    $rec['endgame'] = $eg;
  }
  unset($rec);

  // --- Aggregate (light) — penalties & driver skill averages
  $stmt = $pdo->prepare("
    SELECT
      COUNT(*)                           AS played,
      AVG(NULLIF(penalties, NULL))       AS penalties_avg,
      AVG(NULLIF(driver_skill, NULL))    AS driver_skill_avg,
      COALESCE(AVG(broke_down), 0)       AS broke_down_avg,
      COALESCE(AVG(defended_by), 0)      AS defended_by_avg,
      COALESCE(AVG(defense_played), 0)   AS defense_played_avg
    FROM match_records
    WHERE team_number = ?
      AND match_key LIKE CONCAT(?, '_%')
  ");
  $stmt->execute([$team, $event]);
  $agg = $stmt->fetch() ?: ['played'=>0,'penalties_avg'=>null,'driver_skill_avg'=>null,'broke_down_avg'=>0,'defended_by_avg'=>0,'defense_played_avg'=>0];

  // --- Cards received (distinct)
  $stmt = $pdo->prepare("
    SELECT DISTINCT card
    FROM match_records
    WHERE team_number = ?
      AND match_key LIKE CONCAT(?, '_%')
      AND card IS NOT NULL AND card <> ''
  ");
  $stmt->execute([$team, $event]);
  $cards = array_values(array_filter($stmt->fetchAll(PDO::FETCH_COLUMN) ?: [], fn($c) => $c !== null && $c !== ''));

  // --- Endgame & flags percentages (optional; tolerate missing/legacy schemas)
  $flagsPct = [];
  $endgamePct = [];
  try {
    $stmt = $pdo->prepare("
      SELECT metrics_json
      FROM match_records
      WHERE team_number = ?
        AND match_key LIKE CONCAT(?, '_%')
    ");
    $stmt->execute([$team, $event]);
    $rows = $stmt->fetchAll();
    $cnt = max(1, count($rows));
    foreach ($rows as $r) {
      $mj = $r['metrics_json'] ?? null;
      if (!$mj) continue;
      $obj = is_string($mj) ? json_decode($mj, true) : $mj;
      if (!is_array($obj)) continue;

      // endgame
      $eg = $obj['endgame'] ?? $obj['endgame_climb'] ?? $obj['endgame_status'] ?? null;
      if ($eg !== null && $eg !== '') {
        $k = trim((string)$eg);
        $endgamePct[$k] = ($endgamePct[$k] ?? 0) + 1;
      }

      // flags
      foreach ($obj as $k => $v) {
        if (in_array($k, ['endgame', 'endgame_climb', 'endgame_status'], true)) continue;
        $flag = null;
        if (is_bool($v)) {
          $flag = $v;
        } elseif (is_numeric($v)) {
          if ($v == 0 || $v == 1) { $flag = ($v != 0); }
        } elseif (is_string($v)) {
          $vl = strtolower($v);
          if (in_array($vl, ['true','false','1','0','yes','no','y','n','t','f'], true)) {
            $flag = in_array($vl, ['true','1','yes','y','t'], true);
          }
        }
        if ($flag) { $flagsPct[$k] = ($flagsPct[$k] ?? 0) + 1; }
      }
    }
    foreach ($endgamePct as $k => $v) { $endgamePct[$k] = round($v * 1000 / $cnt) / 10; }
    foreach ($flagsPct   as $k => $v) { $flagsPct[$k]   = round($v * 1000 / $cnt) / 10; }
  } catch (Throwable $__) {
    // If metrics_json column missing or other errors, keep empty aggregates
    $flagsPct = [];
    $endgamePct = [];
  }

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
    'penalties_avg' => $agg['penalties_avg'] !== null ? round(floatval($agg['penalties_avg']), 2) : null,
    'driver_skill_avg' => $agg['driver_skill_avg'] !== null ? round(floatval($agg['driver_skill_avg']), 2) : null,
    'broke_down_avg' => round(floatval($agg['broke_down_avg'] ?? 0), 2),
    'defended_by_avg' => round(floatval($agg['defended_by_avg'] ?? 0), 2),
    'defense_played_avg' => round(floatval($agg['defense_played_avg'] ?? 0), 2),
    'cards' => $cards,
    'flags_pct' => (object)$flagsPct,
    'endgame_pct' => (object)$endgamePct
  ], JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'exception', 'details' => $e->getMessage()]);
}

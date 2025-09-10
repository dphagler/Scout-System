<?php
// /api/schedule.php
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
  if ($event === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'missing_event']); exit;
  }

  $pdo = db();

  // Pull the official schedule rows for this event
  $sql = "
    SELECT
      match_key,
      event_key,
      comp_level,
      set_number,
      match_number,
      time_utc,
      red1, red2, red3,
      blue1, blue2, blue3,
      field
    FROM matches_schedule
    WHERE event_key = ?
    ORDER BY
      CASE comp_level
        WHEN 'qm' THEN 1
        WHEN 'qf' THEN 2
        WHEN 'sf' THEN 3
        WHEN 'f'  THEN 4
        ELSE 5
      END,
      match_number ASC, set_number ASC
  ";
  $stmt = $pdo->prepare($sql);
  $stmt->execute([$event]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  // Normalize integers
  foreach ($rows as &$r) {
    $r['set_number']   = isset($r['set_number'])   ? (int)$r['set_number']   : 0;
    $r['match_number'] = isset($r['match_number']) ? (int)$r['match_number'] : 0;
    foreach (['red1','red2','red3','blue1','blue2','blue3'] as $k) {
      if (array_key_exists($k, $r) && $r[$k] !== null && $r[$k] !== '') {
        $r[$k] = (int)$r[$k];
      } else {
        $r[$k] = null;
      }
    }
  }
  unset($r);

  echo json_encode(['ok' => true, 'event' => $event, 'matches' => $rows], JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'exception', 'details' => $e->getMessage()]);
}

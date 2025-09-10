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
  if ($event === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'bad_request']); exit;
  }

  $pdo = db();

  // Prefer official schedule (distinct teams actually playing at the event)
  $teams = [];
  $stmt = $pdo->prepare("
    SELECT DISTINCT tnum FROM (
      SELECT red1 AS tnum FROM matches_schedule WHERE event_key = ?
      UNION SELECT red2 FROM matches_schedule WHERE event_key = ?
      UNION SELECT red3 FROM matches_schedule WHERE event_key = ?
      UNION SELECT blue1 FROM matches_schedule WHERE event_key = ?
      UNION SELECT blue2 FROM matches_schedule WHERE event_key = ?
      UNION SELECT blue3 FROM matches_schedule WHERE event_key = ?
    ) AS x
    WHERE tnum IS NOT NULL
    ORDER BY tnum
  ");
  $stmt->execute([$event, $event, $event, $event, $event, $event]);
  $rows = $stmt->fetchAll();
  foreach ($rows as $r) {
    $n = intval($r['tnum']);
    if ($n > 0) $teams[] = $n;
  }

  // Fallback: if schedule is empty (e.g., pre-event), use ALL teams (ordered)
  if (empty($teams)) {
    $stmt = $pdo->query("SELECT team_number FROM teams ORDER BY team_number");
    $rows = $stmt->fetchAll();
    foreach ($rows as $r) {
      $n = intval($r['team_number']);
      if ($n > 0) $teams[] = $n;
    }
  }

  // Build metadata map number -> { nickname, name }
  $meta = [];
  if (!empty($teams)) {
    // Prepare IN clause safely
    $placeholders = implode(',', array_fill(0, count($teams), '?'));
    $q = $pdo->prepare("SELECT team_number, nickname, name FROM teams WHERE team_number IN ($placeholders)");
    $q->execute($teams);
    foreach ($q->fetchAll() as $row) {
      $num = intval($row['team_number']);
      $meta[(string)$num] = [
        'nickname' => $row['nickname'] ?? null,
        'name'     => $row['name'] ?? null
      ];
    }
  }

  echo json_encode([
    'ok' => true,
    'event' => $event,
    // Always a flat array of numbers for robustness
    'teams' => $teams,
    // Optional metadata to display names client-side
    'meta'  => (object)$meta
  ], JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'exception', 'details' => $e->getMessage()]);
}

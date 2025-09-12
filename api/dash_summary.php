<?php
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/config.php';
cors_preflight();

$clientKey = client_api_key();
global $API_KEY;
if (!isset($API_KEY) || !$clientKey || !hash_equals($API_KEY, $clientKey)) {
  http_response_code(401);
  echo json_encode(['ok'=>false,'error'=>'unauthorized']); exit;
}

$event = strtolower(trim($_GET['event'] ?? ''));
if ($event === '') { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'missing_event']); exit; }

try {
  $pdo = db();

  //$like = $event . '\_%';
  //$stmt = $pdo->prepare("SELECT * FROM match_records WHERE match_key LIKE ?");
  //$stmt->execute([$like]);
  $prefix = $event . '_';
  $stmt = $pdo->prepare("SELECT * FROM match_records WHERE match_key LIKE CONCAT(?, '%')");
  $stmt->execute([$prefix]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  $teamsAgg = []; $metricsKeys = []; $flagKeys = []; $recent = [];
  $selectKeys = [];

  foreach ($rows as $r) {
    $tnum = (int)$r['team_number']; if ($tnum <= 0) continue;
    if (!isset($teamsAgg[$tnum])) {
      $teamsAgg[$tnum] = [
        'team_number' => $tnum, 'played' => 0,
        'metrics_sum' => [],
        'flags_sum' => [],
        'selects' => [],
        'penalties_sum' => 0,
        'card' => [],
        'driver_skill_sum' => 0,
        'defense_played_sum' => 0,
        'defended_by_sum' => 0,
        'broke_down_sum' => 0,
      ];
    }
    $teamsAgg[$tnum]['played'] += 1;

    $m = json_decode($r['metrics_json'] ?? "{}", true);
    if (is_array($m)) {
      foreach ($m as $k=>$v) {
        if (is_bool($v)) {
          $v = $v ? 1 : 0;
        }
        if (is_numeric($v)) {
          if (!isset($teamsAgg[$tnum]['metrics_sum'][$k])) $teamsAgg[$tnum]['metrics_sum'][$k] = 0;
          $teamsAgg[$tnum]['metrics_sum'][$k] += (float)$v;
          $metricsKeys[$k] = true;
        } elseif (is_string($v) && $v !== '') {
          if (!isset($teamsAgg[$tnum]['selects'][$k])) $teamsAgg[$tnum]['selects'][$k] = [];
          if (!isset($teamsAgg[$tnum]['selects'][$k][$v])) $teamsAgg[$tnum]['selects'][$k][$v] = 0;
          $teamsAgg[$tnum]['selects'][$k][$v] += 1;
          $selectKeys[$k] = true;
        }
      }
    }
    // flags_json is legacy; tolerate missing
    $f = json_decode($r['flags_json'] ?? "{}", true);
    if (is_array($f)) {
      foreach ($f as $k=>$v) {
        if (!isset($teamsAgg[$tnum]['flags_sum'][$k])) $teamsAgg[$tnum]['flags_sum'][$k] = 0;
        if (!!$v) $teamsAgg[$tnum]['flags_sum'][$k] += 1;
        $flagKeys[$k] = true;
      }
    }
    $teamsAgg[$tnum]['penalties_sum'] += (int)($r['penalties'] ?? 0);
    $teamsAgg[$tnum]['broke_down_sum'] += (int)($r['broke_down'] ?? 0);

    // Legacy endgame column support
    $eg = $r['endgame'] ?? null;
    if ($eg !== null && $eg !== '') {
      $eg = is_string($eg) ? $eg : (string)$eg;
      if (!isset($teamsAgg[$tnum]['selects']['endgame'])) $teamsAgg[$tnum]['selects']['endgame'] = [];
      if (!isset($teamsAgg[$tnum]['selects']['endgame'][$eg])) $teamsAgg[$tnum]['selects']['endgame'][$eg] = 0;
      $teamsAgg[$tnum]['selects']['endgame'][$eg] += 1;
      $selectKeys['endgame'] = true;
    }

    $card = $r['card'] ?? 'none';
    if (!isset($teamsAgg[$tnum]['card'][$card])) $teamsAgg[$tnum]['card'][$card] = 0;
    $teamsAgg[$tnum]['card'][$card] += 1;

    $teamsAgg[$tnum]['driver_skill_sum'] += (int)($r['driver_skill'] ?? 0);
    $teamsAgg[$tnum]['defense_played_sum'] += (int)($r['defense_played'] ?? 0);
    $teamsAgg[$tnum]['defended_by_sum'] += (int)($r['defended_by'] ?? 0);

    $recent[] = [
      'match_key' => $r['match_key'], 'team_number' => $tnum, 'alliance' => $r['alliance'],
      'position' => (int)$r['position'], 'metrics' => $m, 'card' => $card,
      'penalties' => (int)($r['penalties'] ?? 0), 'scout_name' => $r['scout_name'] ?? null,
      'created_at_ms' => (int)($r['created_at_ms'] ?? 0),
    ];
  }

  $teamIds = array_keys($teamsAgg); $nick = [];
  if (count($teamIds) > 0) {
    $in = implode(',', array_fill(0, count($teamIds), '?'));
    $st = $pdo->prepare("SELECT team_number, nickname, name FROM teams WHERE team_number IN ($in)");
    $st->execute($teamIds);
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $t) {
      $nick[(int)$t['team_number']] = ['nickname'=>$t['nickname'] ?? null, 'name'=>$t['name'] ?? null];
    }
  }

  $teams = [];
  foreach ($teamsAgg as $tnum => $agg) {
    $played = max(1, (int)$agg['played']);
    $avg = []; foreach ($agg['metrics_sum'] as $k=>$sum) { $avg[$k] = round($sum / $played, 2); }
    $flags_pct = []; foreach ($agg['flags_sum'] as $k=>$cnt) { $flags_pct[$k] = round(100.0*$cnt/$played,1); }

    if (isset($agg['selects']['endgame_climb']) || isset($agg['selects']['endgame_status'])) {
      if (!isset($agg['selects']['endgame'])) $agg['selects']['endgame'] = [];
      foreach (['endgame_climb', 'endgame_status'] as $legacy) {
        if (isset($agg['selects'][$legacy])) {
          foreach ($agg['selects'][$legacy] as $val=>$cnt) {
            if (!isset($agg['selects']['endgame'][$val])) $agg['selects']['endgame'][$val] = 0;
            $agg['selects']['endgame'][$val] += $cnt;
          }
          unset($agg['selects'][$legacy]);
        }
      }
      $selectKeys['endgame'] = true;
      unset($selectKeys['endgame_climb'], $selectKeys['endgame_status']);
    }

    $select_pct = [];
    foreach ($agg['selects'] as $k=>$opts) {
      $select_pct[$k] = [];
      foreach ($opts as $val=>$cnt) {
        $select_pct[$k][$val] = round(100.0*$cnt/$played,1);
      }
    }
    $end_pct = $select_pct['endgame'] ?? [];
    $card_pct = []; foreach ($agg['card'] as $k=>$cnt) { $card_pct[$k] = round(100.0*$cnt/$played,1); }

    $teams[] = [
      'team_number' => $tnum,
      'nickname' => $nick[$tnum]['nickname'] ?? null,
      'name' => $nick[$tnum]['name'] ?? null,
      'played' => $agg['played'],
      'avg' => $avg, 'sum' => $agg['metrics_sum'],
      'flags_pct' => $flags_pct,
      'select_pct' => $select_pct,
      'endgame_pct' => $end_pct,
      'card_pct' => $card_pct,
      'penalties_avg' => round($agg['penalties_sum'] / $played, 2),
      'driver_skill_avg' => round($agg['driver_skill_sum'] / $played, 2),
      'defense_played_avg' => round($agg['defense_played_sum'] / $played, 2),
      'defended_by_avg' => round($agg['defended_by_sum'] / $played, 2),
      'broke_down_pct' => round(100.0 * $agg['broke_down_sum'] / $played, 1),
    ];
  }

  usort($teams, function($a,$b){
    $totalA = 0; foreach ($a['sum'] as $k=>$v) { if (stripos($k, 'coral') !== false) $totalA += (float)$v; }
    $totalB = 0; foreach ($b['sum'] as $k=>$v) { if (stripos($k, 'coral') !== false) $totalB += (float)$v; }
    if ($totalA === $totalB) return ($b['played'] <=> $a['played']);
    return ($totalB <=> $totalA);
  });

  usort($recent, function($x,$y){ return ($y['created_at_ms'] <=> $x['created_at_ms']); });
  if (count($recent) > 50) $recent = array_slice($recent, 0, 50);

  echo json_encode([
    'ok' => true, 'event' => $event,
    'stats' => [ 'teams' => count($teams), 'matches' => count($rows),
                 'metrics_keys' => array_keys($metricsKeys),
                 'flags_keys' => array_keys($flagKeys),
                 'select_keys' => array_keys($selectKeys) ],
    'teams' => $teams, 'recent' => $recent
  ]);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>'exception','details'=>$e->getMessage()]);
}

<?php
require __DIR__ . '/config.php';

cors_preflight();
header('Content-Type: application/json');

echo json_encode([
  'syncUrl' => $SYNC_URL ?? '',
]);
?>

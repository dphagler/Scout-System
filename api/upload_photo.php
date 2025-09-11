<?php
// Upload a single pit photo and return its public URL.
// Accepts: POST body as raw image (Content-Type image/*) or multipart file "file".
// Headers: X-API-KEY (or ?key=...), X-FILENAME (optional filename hint)
// Query: ?event=2025gaalb&team=1795&name=... (name optional; we'll sanitize)

require __DIR__ . '/config.php'; // db(), cors_preflight(), client_api_key(), $API_KEY

// --- CORS ---
cors_preflight();
header('Content-Type: application/json; charset=utf-8');

// --- Auth ---
try {
  require_api_key();

  // ---- Params ----
  $event = isset($_GET['event']) ? strtolower(trim($_GET['event'])) : '';
  $team  = isset($_GET['team'])  ? intval($_GET['team']) : 0;
  $nameQ = isset($_GET['name'])  ? trim($_GET['name']) : '';

  if (!$event || !$team) {
    http_response_code(400);
    echo json_encode(['ok'=>false,'error'=>'missing_params']); exit;
  }

  // Optional header for filename
  $headers = function_exists('getallheaders') ? getallheaders() : [];
  $nameH   = isset($headers['X-FILENAME']) ? $headers['X-FILENAME']
            : (isset($headers['x-filename']) ? $headers['x-filename'] : '');

  // pick a filename: query > header > generated
  $rawName = $nameQ ?: $nameH ?: ($event . '_' . $team . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.webp');

  // sanitize to a safe basename
  $safe = preg_replace('/[^a-zA-Z0-9._-]+/', '_', $rawName);
  if (!preg_match('/\.(png|jpe?g|webp|gif|avif)$/i', $safe)) {
    // default to .webp if no extension
    $safe .= '.webp';
  }

  // ---- Storage paths ----
  // Disk location: ../uploads/pit/<event>/<team>/<file>
  $UPLOADS_DIR = realpath(__DIR__ . '/../uploads');
  if ($UPLOADS_DIR === false) {
    // attempt to create if missing
    $baseTry = __DIR__ . '/../uploads';
    if (!is_dir($baseTry)) { @mkdir($baseTry, 0775, true); }
    $UPLOADS_DIR = realpath($baseTry);
  }
  if ($UPLOADS_DIR === false) {
    throw new Exception('uploads_dir_missing');
  }

  $targetDir = $UPLOADS_DIR . '/pit/' . $event . '/' . $team;
  if (!is_dir($targetDir)) {
    if (!@mkdir($targetDir, 0775, true)) {
      throw new Exception('mkdir_failed');
    }
  }

  $targetPath = $targetDir . '/' . $safe;

  // ---- Read body/file ----
  $content = null;
  if (!empty($_FILES['file']['tmp_name'])) {
    $content = file_get_contents($_FILES['file']['tmp_name']);
  } else {
    // raw body
    $content = file_get_contents('php://input');
  }
  if ($content === false || strlen($content) === 0) {
    http_response_code(400);
    echo json_encode(['ok'=>false,'error'=>'empty_body']); exit;
  }

  // ---- Validate file ----
  $maxBytes     = 5 * 1024 * 1024; // 5 MB limit
  $allowedExts  = ['png','jpg','jpeg','webp','gif','avif'];
  $allowedMimes = ['image/png','image/jpeg','image/webp','image/gif','image/avif'];

  // size check
  if (strlen($content) > $maxBytes) {
    http_response_code(400);
    echo json_encode(['ok'=>false,'error'=>'file_too_large']); exit;
  }

  // extension check
  $ext = strtolower(pathinfo($safe, PATHINFO_EXTENSION));
  if (!in_array($ext, $allowedExts, true)) {
    http_response_code(400);
    echo json_encode(['ok'=>false,'error'=>'invalid_extension']); exit;
  }

  // MIME check
  $finfo = new finfo(FILEINFO_MIME_TYPE);
  $mime  = $finfo->buffer($content);
  if ($mime === false || !in_array($mime, $allowedMimes, true)) {
    http_response_code(400);
    echo json_encode(['ok'=>false,'error'=>'invalid_type']); exit;
  }

  // ---- Write file ----
  if (file_put_contents($targetPath, $content) === false) {
    throw new Exception('write_failed');
  }

  // ---- Build PUBLIC URL (no /api) ----
  // Use the current request host and force path from the site root: /uploads/...
  $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
  $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
  $publicUrl = $scheme . '://' . $host . '/uploads/pit/' . rawurlencode($event) . '/' . rawurlencode((string)$team) . '/' . rawurlencode($safe);

  echo json_encode([
    'ok'   => true,
    'url'  => $publicUrl,
    'name' => $safe,
    'size' => strlen($content)
  ], JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>'exception','details'=>$e->getMessage()]);
}

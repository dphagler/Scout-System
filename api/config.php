<?php
// --- Load environment variables from optional .env file ---
foreach ([__DIR__ . '/../.env', __DIR__ . '/.env'] as $dotenv) {
  if (is_file($dotenv)) {
    $lines = file($dotenv, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
      $line = trim($line);
      if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
      [$name, $value] = array_map('trim', explode('=', $line, 2));
      putenv("$name=$value");
      $_ENV[$name] = $value;
    }
  }
}

// --- Base config (safe defaults). Override via environment or config.local.php ---

$API_KEY = getenv('API_KEY') ?: '';
$TBA_KEY = getenv('TBA_KEY') ?: '';

// DB creds — override these in your environment or config.local.php
$DB_HOST = getenv('DB_HOST') ?: '127.0.0.1';
$DB_NAME = getenv('DB_NAME') ?: '';
$DB_USER = getenv('DB_USER') ?: '';
$DB_PASS = getenv('DB_PASS') ?: '';

// Allowed origins for CORS
$CORS_ALLOWED_ORIGINS = [
  'https://www.commodorerobotics.com',
  'https://commodorerobotics.com',
  'http://127.0.0.1:5173', 'http://127.0.0.1:5174',
  'http://localhost:5173', 'http://localhost:5174',
];

// Optional debugging
$DEBUG = false;
if ($DEBUG) { ini_set('display_errors', 1); ini_set('display_startup_errors', 1); error_reporting(E_ALL); }

// --- Allow local overrides so uploads never nuke secrets ---
$local = __DIR__ . '/config.local.php';
if (is_file($local)) { include $local; }  // variables in config.local.php override the ones above

// --- Helpers shared by endpoints ---
function db() {
  static $pdo = null;
  if ($pdo) return $pdo;
  global $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS;
  $dsn = "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4";
  $opts = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
  ];
  $pdo = new PDO($dsn, $DB_USER, $DB_PASS, $opts);
  return $pdo;
}

function client_api_key() {
  $headers = function_exists('getallheaders') ? getallheaders() : [];
  $key = $headers['X-API-KEY'] ?? $headers['x-api-key'] ?? ($_SERVER['HTTP_X_API_KEY'] ?? null);
  if (!$key) { $key = $_GET['key'] ?? $_POST['key'] ?? null; }
  return $key;
}

function cors_preflight() {
  global $CORS_ALLOWED_ORIGINS;
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

  if ($origin && in_array($origin, $CORS_ALLOWED_ORIGINS, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
  }

  // Allow the headers we actually use (include X-Filename for future compatibility)
  header('Access-Control-Allow-Headers: Content-Type, X-API-KEY, X-Filename');
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  header('Access-Control-Max-Age: 86400'); // cache preflight for 24h

  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
}

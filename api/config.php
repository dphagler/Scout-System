<?php
// --- Base config (safe defaults). You can override in config.local.php ---

$API_KEY = '123456789abcdefg11';   // server API key used by your PWA/dashboard
$TBA_KEY = 'P1OCFTEclkeAJO4vxlwirA4OqmrDyE7wqBLqTZTXftp2iXzg10KLFgQJ8aS7sFsQ';  // <-- paste your real TBA v3 key

// DB creds — fill these in
$DB_HOST = '127.0.0.1';
$DB_NAME = 'hctdron1_frc_scouting';
$DB_USER = 'hctdron1_frcscouting';
$DB_PASS = 't80MmVFkaHQ&#p#2';

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

<?php

$API_KEY = getenv('API_KEY') ?: '';
$TBA_KEY = getenv('TBA_KEY') ?: '';

// DB creds — override these in your environment or config.local.php
$DB_HOST = getenv('DB_HOST') ?: '127.0.0.1';
$DB_NAME = getenv('DB_NAME') ?: '';
$DB_USER = getenv('DB_USER') ?: '';
$DB_PASS = getenv('DB_PASS') ?: '';

// External endpoints
$SYNC_URL = getenv('SYNC_URL') ?: '';
$API_BASE = getenv('API_BASE') ?: '';

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

function require_api_key() {
  global $API_KEY;
  $key = client_api_key();
  if (!$key || !hash_equals($API_KEY, $key)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'unauthorized'], JSON_UNESCAPED_SLASHES);
    exit;
  }
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

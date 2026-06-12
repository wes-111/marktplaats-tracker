<?php
/**
 * Gedeelde basis voor alle API-endpoints:
 * - laadt config
 * - start sessie
 * - zet JSON-headers
 * - levert hulpfuncties voor JSON-respons
 */

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0'); // fouten niet naar de browser lekken

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'config.php ontbreekt. Kopieer config.example.php naar config.php.']);
    exit;
}

/** @var array $CONFIG */
$CONFIG = require $configPath;

// --- Sessie ---
session_name($CONFIG['session_name'] ?? 'mp_tracker_sess');
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
    'secure'   => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
]);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

/** Stuur een JSON-respons en stop. */
function respond($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Lees de JSON-body van het verzoek als associatieve array. */
function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Controleer of de gebruiker is ingelogd; zo niet, stop met 401. */
function require_auth(): void
{
    if (empty($_SESSION['authenticated'])) {
        respond(['error' => 'Niet ingelogd'], 401);
    }
}

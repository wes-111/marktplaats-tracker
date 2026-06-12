<?php
require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['error' => 'Methode niet toegestaan'], 405);
}

$body     = read_json_body();
$password = (string) ($body['password'] ?? '');
$expected = (string) ($CONFIG['app_password'] ?? '');

if ($expected === '' || !hash_equals($expected, $password)) {
    // kleine vertraging tegen brute-force
    usleep(400000);
    respond(['error' => 'Onjuist wachtwoord'], 401);
}

session_regenerate_id(true);
$_SESSION['authenticated'] = true;

respond(['authenticated' => true]);

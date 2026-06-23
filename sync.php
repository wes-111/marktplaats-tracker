<?php
/**
 * Sync-endpoint met een handmatig aangeleverde snapshot (door Claude).
 * Body: { "snapshot": [ { mpId, naam, prijsUit, advertentieUrl, onlineSinds }, ... ] }
 */

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/db.php';
require __DIR__ . '/item_helpers.php';

require_auth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['error' => 'Methode niet toegestaan'], 405);
}

$body     = read_json_body();
$snapshot = $body['snapshot'] ?? null;
if (!is_array($snapshot)) {
    respond(['error' => 'Geen geldige snapshot'], 422);
}

respond(apply_snapshot(db(), $snapshot));

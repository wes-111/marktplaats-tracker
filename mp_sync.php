<?php
/**
 * In-app sync met Marktplaats (geen externe hulp nodig).
 * Haalt het aanbod van de ingestelde verkoper op via de Marktplaats-zoek-API
 * en werkt de database bij. Verkoper-id staat in config.php ('mp_seller_id').
 */

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/db.php';
require __DIR__ . '/item_helpers.php';

require_auth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['error' => 'Methode niet toegestaan'], 405);
}

$sellerId = trim((string) ($CONFIG['mp_seller_id'] ?? ''));
if ($sellerId === '') {
    respond(['error' => 'Geen mp_seller_id ingesteld in config.php'], 400);
}

if (!function_exists('curl_init')) {
    respond(['error' => 'cURL is niet beschikbaar op de server'], 500);
}

$pdo = db();

try {
    $snapshot = mp_fetch_snapshot($sellerId);
} catch (Throwable $e) {
    respond(['error' => $e->getMessage()], 502);
}

if (!$snapshot) {
    respond(['error' => 'Geen advertenties opgehaald (Marktplaats blokkeert mogelijk de server).'], 502);
}

// Dry-run: alleen rapporteren wat is opgehaald, niets wijzigen (?dry=1).
if (!empty($_GET['dry'])) {
    respond([
        'dry'      => true,
        'gevonden' => count($snapshot),
        'voorbeeld' => array_slice($snapshot, 0, 3),
    ]);
}

respond(apply_snapshot($pdo, $snapshot));

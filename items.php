<?php
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/db.php';
require __DIR__ . '/item_helpers.php';

require_auth();

$method = $_SERVER['REQUEST_METHOD'];
$pdo    = db();

switch ($method) {

    // --- Lijst ophalen ---
    case 'GET': {
        $stmt = $pdo->query(
            'SELECT * FROM items
             ORDER BY (datum_inkoop IS NULL), datum_inkoop DESC, created_at DESC'
        );
        $items = array_map('row_to_item', $stmt->fetchAll());
        respond(['items' => $items]);
        break;
    }

    // --- Nieuw item (of meerdere tegelijk bij migratie) ---
    case 'POST': {
        $body = read_json_body();

        // Bulk: { "items": [ ... ] }  -> voor migratie/herstel
        if (isset($body['items']) && is_array($body['items'])) {
            $count = 0;
            $pdo->beginTransaction();
            try {
                foreach ($body['items'] as $raw) {
                    if (!is_array($raw)) continue;
                    upsert_item($pdo, normalize_item($raw, true));
                    $count++;
                }
                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                respond(['error' => 'Importeren mislukt'], 500);
            }
            respond(['imported' => $count]);
            break;
        }

        // Enkel item
        $item = normalize_item($body, false);
        if ($item['naam'] === '') {
            respond(['error' => 'Naam is verplicht'], 422);
        }
        upsert_item($pdo, $item);
        respond(['item' => fetch_item($pdo, $item['id'])], 201);
        break;
    }

    // --- Bestaand item bijwerken ---
    case 'PUT': {
        $id = (string) ($_GET['id'] ?? '');
        if ($id === '') {
            respond(['error' => 'Geen id opgegeven'], 422);
        }
        $existing = fetch_item($pdo, $id);
        if (!$existing) {
            respond(['error' => 'Item niet gevonden'], 404);
        }
        $body       = read_json_body();
        $body['id'] = $id;
        $item       = normalize_item($body, false);
        if ($item['naam'] === '') {
            respond(['error' => 'Naam is verplicht'], 422);
        }
        upsert_item($pdo, $item);
        respond(['item' => fetch_item($pdo, $id)]);
        break;
    }

    // --- Item verwijderen ---
    case 'DELETE': {
        $id = (string) ($_GET['id'] ?? '');
        if ($id === '') {
            respond(['error' => 'Geen id opgegeven'], 422);
        }
        $stmt = $pdo->prepare('DELETE FROM items WHERE id = ?');
        $stmt->execute([$id]);
        respond(['deleted' => $id]);
        break;
    }

    default:
        respond(['error' => 'Methode niet toegestaan'], 405);
}

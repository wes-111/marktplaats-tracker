<?php
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/db.php';

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

// ---------------------------------------------------------------------------

/** Normaliseer binnenkomende JSON naar een schoon item-array. */
function normalize_item(array $raw, bool $keepGivenId): array
{
    $id = isset($raw['id']) ? (string) $raw['id'] : '';
    if ($id === '' || !$keepGivenId && $id === '') {
        $id = gen_id();
    }
    if ($id === '') {
        $id = gen_id();
    }

    $status = (string) ($raw['status'] ?? 'te-koop');
    $allowed = ['te-koop', 'gereserveerd', 'verkocht'];
    if (!in_array($status, $allowed, true)) {
        $status = 'te-koop';
    }

    return [
        'id'           => $id,
        'naam'         => trim((string) ($raw['naam'] ?? '')),
        'categorie'    => trim((string) ($raw['categorie'] ?? '')),
        'winkel'       => trim((string) ($raw['winkel'] ?? '')),
        'datumInkoop'  => nullable_date($raw['datumInkoop'] ?? ''),
        'prijsIn'      => (float) ($raw['prijsIn'] ?? 0),
        'prijsUit'     => (float) ($raw['prijsUit'] ?? 0),
        'status'       => $status,
        'datumVerkoop' => nullable_date($raw['datumVerkoop'] ?? ''),
        'notitie'      => trim((string) ($raw['notitie'] ?? '')),
    ];
}

/** Voeg toe of werk bij (op id). */
function upsert_item(PDO $pdo, array $i): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO items
            (id, naam, categorie, winkel, datum_inkoop, prijs_in, prijs_uit, status, datum_verkoop, notitie)
         VALUES
            (:id, :naam, :categorie, :winkel, :datum_inkoop, :prijs_in, :prijs_uit, :status, :datum_verkoop, :notitie)
         ON DUPLICATE KEY UPDATE
            naam = VALUES(naam),
            categorie = VALUES(categorie),
            winkel = VALUES(winkel),
            datum_inkoop = VALUES(datum_inkoop),
            prijs_in = VALUES(prijs_in),
            prijs_uit = VALUES(prijs_uit),
            status = VALUES(status),
            datum_verkoop = VALUES(datum_verkoop),
            notitie = VALUES(notitie)'
    );
    $stmt->execute([
        ':id'            => $i['id'],
        ':naam'          => $i['naam'],
        ':categorie'     => $i['categorie'] !== '' ? $i['categorie'] : null,
        ':winkel'        => $i['winkel'] !== '' ? $i['winkel'] : null,
        ':datum_inkoop'  => $i['datumInkoop'],
        ':prijs_in'      => $i['prijsIn'],
        ':prijs_uit'     => $i['prijsUit'],
        ':status'        => $i['status'],
        ':datum_verkoop' => $i['datumVerkoop'],
        ':notitie'       => $i['notitie'] !== '' ? $i['notitie'] : null,
    ]);
}

function fetch_item(PDO $pdo, string $id): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM items WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ? row_to_item($row) : null;
}

/** Genereer een uniek id in dezelfde stijl als de oude app (tijd in ms). */
function gen_id(): string
{
    return (string) (int) (microtime(true) * 1000) . random_int(100, 999);
}

<?php
/**
 * Databaseverbinding (PDO) + automatisch aanmaken van de tabel.
 */

declare(strict_types=1);

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    global $CONFIG;
    $db = $CONFIG['db'];

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=%s',
        $db['host'],
        $db['name'],
        $db['charset'] ?? 'utf8mb4'
    );

    try {
        $pdo = new PDO($dsn, $db['user'], $db['pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (Throwable $e) {
        respond(['error' => 'Databaseverbinding mislukt'], 500);
    }

    ensure_schema($pdo);
    migrate($pdo);
    return $pdo;
}

/** Maakt de tabel aan als die nog niet bestaat. */
function ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS items (
            id                   VARCHAR(32)    NOT NULL PRIMARY KEY,
            naam                 VARCHAR(255)   NOT NULL,
            categorie            VARCHAR(64)    DEFAULT NULL,
            winkel               VARCHAR(255)   DEFAULT NULL,
            datum_inkoop         DATE           DEFAULT NULL,
            prijs_in             DECIMAL(10,2)  NOT NULL DEFAULT 0,
            prijs_uit            DECIMAL(10,2)  NOT NULL DEFAULT 0,
            status               VARCHAR(20)    NOT NULL DEFAULT "te-koop",
            datum_verkoop        DATE           DEFAULT NULL,
            notitie              TEXT           DEFAULT NULL,
            advertentie_url      VARCHAR(500)   DEFAULT NULL,
            mp_id                VARCHAR(32)    DEFAULT NULL,
            online_sinds         DATE           DEFAULT NULL,
            weergaven            INT            DEFAULT NULL,
            bewaard              INT            DEFAULT NULL,
            vermoedelijk_verkocht TINYINT(1)    NOT NULL DEFAULT 0,
            foto_url             VARCHAR(500)   DEFAULT NULL,
            created_at           TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
            updated_at           TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
}

/**
 * Voegt ontbrekende kolommen toe aan een bestaande tabel (veilig, non-destructief).
 * Werkt op zowel MySQL als MariaDB (geen "ADD COLUMN IF NOT EXISTS" nodig).
 */
function migrate(PDO $pdo): void
{
    // Bestaande kolomnamen in één keer ophalen (geen placeholder in SHOW -> werkt op MySQL én MariaDB).
    $existing = $pdo->query('SHOW COLUMNS FROM items')->fetchAll(PDO::FETCH_COLUMN);

    $cols = [
        'advertentie_url'       => 'VARCHAR(500) DEFAULT NULL',
        'mp_id'                 => 'VARCHAR(32) DEFAULT NULL',
        'online_sinds'          => 'DATE DEFAULT NULL',
        'weergaven'             => 'INT DEFAULT NULL',
        'bewaard'               => 'INT DEFAULT NULL',
        'vermoedelijk_verkocht' => 'TINYINT(1) NOT NULL DEFAULT 0',
        'foto_url'              => 'VARCHAR(500) DEFAULT NULL',
    ];
    foreach ($cols as $name => $def) {
        if (!in_array($name, $existing, true)) {
            $pdo->exec("ALTER TABLE items ADD COLUMN $name $def");
        }
    }
}

/** Zet een DB-rij (snake_case) om naar het JSON-formaat van de app (camelCase). */
function row_to_item(array $r): array
{
    return [
        'id'                 => $r['id'],
        'naam'               => $r['naam'],
        'categorie'          => $r['categorie'] ?? '',
        'winkel'             => $r['winkel'] ?? '',
        'datumInkoop'        => $r['datum_inkoop'] ?? '',
        'prijsIn'            => (float) $r['prijs_in'],
        'prijsUit'           => (float) $r['prijs_uit'],
        'status'             => $r['status'],
        'datumVerkoop'       => $r['datum_verkoop'] ?? '',
        'notitie'            => $r['notitie'] ?? '',
        'advertentieUrl'     => $r['advertentie_url'] ?? '',
        'mpId'               => $r['mp_id'] ?? '',
        'onlineSinds'        => $r['online_sinds'] ?? '',
        'weergaven'          => isset($r['weergaven']) && $r['weergaven'] !== null ? (int) $r['weergaven'] : null,
        'bewaard'            => isset($r['bewaard']) && $r['bewaard'] !== null ? (int) $r['bewaard'] : null,
        'vermoedelijkVerkocht' => !empty($r['vermoedelijk_verkocht']),
        'fotoUrl'            => $r['foto_url'] ?? '',
        'aangemaakt'         => $r['created_at'] ?? '',
    ];
}

/** Maakt van een lege datumstring NULL (voor DATE-kolommen). */
function nullable_date($v): ?string
{
    $v = is_string($v) ? trim($v) : '';
    return $v === '' ? null : $v;
}

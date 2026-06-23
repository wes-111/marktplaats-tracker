<?php
/**
 * Gedeelde item-helpers, gebruikt door items.php en sync.php.
 */

declare(strict_types=1);

/** Normaliseer binnenkomende JSON naar een schoon item-array. */
function normalize_item(array $raw, bool $keepGivenId): array
{
    $id = isset($raw['id']) ? (string) $raw['id'] : '';
    if ($id === '') {
        $id = gen_id();
    }

    $status = (string) ($raw['status'] ?? 'te-koop');
    $allowed = ['te-koop', 'gereserveerd', 'verkocht'];
    if (!in_array($status, $allowed, true)) {
        $status = 'te-koop';
    }

    $weergaven = $raw['weergaven'] ?? null;
    $bewaard   = $raw['bewaard'] ?? null;

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
        'advertentieUrl' => trim((string) ($raw['advertentieUrl'] ?? '')),
        'mpId'         => trim((string) ($raw['mpId'] ?? '')),
        'onlineSinds'  => nullable_date($raw['onlineSinds'] ?? ''),
        'weergaven'    => ($weergaven === null || $weergaven === '') ? null : (int) $weergaven,
        'bewaard'      => ($bewaard === null || $bewaard === '') ? null : (int) $bewaard,
        'vermoedelijkVerkocht' => !empty($raw['vermoedelijkVerkocht']) ? 1 : 0,
        'fotoUrl'      => trim((string) ($raw['fotoUrl'] ?? '')),
    ];
}

/** Voeg toe of werk bij (op id). */
function upsert_item(PDO $pdo, array $i): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO items
            (id, naam, categorie, winkel, datum_inkoop, prijs_in, prijs_uit, status, datum_verkoop, notitie,
             advertentie_url, mp_id, online_sinds, weergaven, bewaard, vermoedelijk_verkocht, foto_url)
         VALUES
            (:id, :naam, :categorie, :winkel, :datum_inkoop, :prijs_in, :prijs_uit, :status, :datum_verkoop, :notitie,
             :advertentie_url, :mp_id, :online_sinds, :weergaven, :bewaard, :vermoedelijk_verkocht, :foto_url)
         ON DUPLICATE KEY UPDATE
            naam = VALUES(naam),
            categorie = VALUES(categorie),
            winkel = VALUES(winkel),
            datum_inkoop = VALUES(datum_inkoop),
            prijs_in = VALUES(prijs_in),
            prijs_uit = VALUES(prijs_uit),
            status = VALUES(status),
            datum_verkoop = VALUES(datum_verkoop),
            notitie = VALUES(notitie),
            advertentie_url = VALUES(advertentie_url),
            mp_id = VALUES(mp_id),
            online_sinds = VALUES(online_sinds),
            weergaven = VALUES(weergaven),
            bewaard = VALUES(bewaard),
            vermoedelijk_verkocht = VALUES(vermoedelijk_verkocht),
            foto_url = VALUES(foto_url)'
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
        ':advertentie_url' => $i['advertentieUrl'] !== '' ? $i['advertentieUrl'] : null,
        ':mp_id'         => $i['mpId'] !== '' ? $i['mpId'] : null,
        ':online_sinds'  => $i['onlineSinds'],
        ':weergaven'     => $i['weergaven'],
        ':bewaard'       => $i['bewaard'],
        ':vermoedelijk_verkocht' => $i['vermoedelijkVerkocht'],
        ':foto_url'      => $i['fotoUrl'] !== '' ? $i['fotoUrl'] : null,
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

/* ===================== Marktplaats-sync ===================== */

/** Normaliseer een titel voor matching (kleine letters, alleen alfanumeriek). */
function norm_title_key($s): string
{
    $s = mb_strtolower((string) $s);
    $s = preg_replace('/[^a-z0-9]+/u', ' ', $s);
    return trim(preg_replace('/\s+/', ' ', $s));
}

/** Zet Marktplaats-datum "19 jun 26" om naar "2026-06-19" (of '' als onbekend). */
function parse_mp_date($d): string
{
    static $m = ['jan'=>1,'feb'=>2,'mrt'=>3,'maa'=>3,'apr'=>4,'mei'=>5,'jun'=>6,
                 'jul'=>7,'aug'=>8,'sep'=>9,'okt'=>10,'nov'=>11,'dec'=>12];
    if (!preg_match('/(\d{1,2})\s+([a-z]{3})[a-z]*\s+(\d{2,4})/i', (string) $d, $x)) {
        return '';
    }
    $mon = $m[strtolower(substr($x[2], 0, 3))] ?? 0;
    if (!$mon) return '';
    $yr = (int) $x[3];
    if ($yr < 100) $yr += 2000;
    return sprintf('%04d-%02d-%02d', $yr, $mon, (int) $x[1]);
}

/** Eén HTTPS GET met browser-headers; geeft body of null bij fout. */
function http_get_json(string $url): ?string
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_HTTPHEADER     => [
            'Accept: application/json, text/plain, */*',
            'Accept-Language: nl-NL,nl;q=0.9',
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        ],
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code !== 200) return null;
    return (string) $body;
}

/**
 * Haalt het volledige aanbod van een verkoper op via de Marktplaats-zoek-API
 * en geeft een snapshot terug: [{ mpId, naam, prijsUit, advertentieUrl, onlineSinds }].
 */
function mp_fetch_snapshot(string $sellerId): array
{
    $all = [];
    $page = 50;
    for ($offset = 0; $offset < 1000; $offset += $page) {
        $url = 'https://www.marktplaats.nl/lrp/api/search?limit=' . $page . '&offset=' . $offset
             . '&viewOptions=list-view&sortBy=SORT_INDEX&sortOrder=DECREASING&sellerIds[]=' . rawurlencode($sellerId);
        $body = http_get_json($url);
        if ($body === null) {
            if ($offset === 0) {
                throw new RuntimeException('Marktplaats is niet bereikbaar (mogelijk geblokkeerd).');
            }
            break;
        }
        $data = json_decode($body, true);
        $listings = $data['listings'] ?? [];
        if (!is_array($listings) || !$listings) break;

        foreach ($listings as $l) {
            $vip = (string) ($l['vipUrl'] ?? '');
            $mpId = '';
            if (preg_match('~/(m\d+)~', $vip, $mm)) {
                $mpId = $mm[1];
            } elseif (!empty($l['itemId'])) {
                $mpId = (string) $l['itemId'];
            }
            $pi = $l['priceInfo'] ?? [];
            $cents = (int) ($pi['priceCents'] ?? 0);
            $type = (string) ($pi['priceType'] ?? '');
            $prijs = ($type === 'FIXED' && $cents > 0) ? round($cents / 100, 2) : 0.0;

            $foto = '';
            if (!empty($l['pictures'][0]['mediumUrl'])) {
                $foto = (string) $l['pictures'][0]['mediumUrl'];
            } elseif (!empty($l['pictures'][0]['largeUrl'])) {
                $foto = (string) $l['pictures'][0]['largeUrl'];
            } elseif (!empty($l['imageUrls'][0])) {
                $foto = (string) $l['imageUrls'][0];
                if (strpos($foto, '//') === 0) $foto = 'https:' . $foto;
            }

            $all[] = [
                'mpId'           => $mpId,
                'naam'           => trim((string) ($l['title'] ?? '')),
                'prijsUit'       => $prijs,
                'advertentieUrl' => $vip !== '' ? ('https://www.marktplaats.nl' . $vip) : '',
                'onlineSinds'    => parse_mp_date($l['date'] ?? ''),
                'fotoUrl'        => $foto,
            ];
        }
        if (count($listings) < $page) break;
    }
    return $all;
}

/**
 * Vergelijkt een snapshot met de database en werkt bij:
 *  - match op mpId, anders op genormaliseerde titel (niet-verkochte items)
 *  - nieuw -> toevoegen als 'te-koop'
 *  - gewijzigde vraagprijs -> bijwerken; link/datum backfillen
 *  - te-koop-item met mp_id dat niet meer in de snapshot zit -> vermoedelijk_verkocht
 * Items zonder mp_id worden nooit automatisch gevlagd (geen valse 'verkocht').
 */
function apply_snapshot(PDO $pdo, array $snapshot): array
{
    $rows = $pdo->query(
        'SELECT id, naam, mp_id, status, prijs_uit, advertentie_url, online_sinds, vermoedelijk_verkocht
         FROM items'
    )->fetchAll();

    $byMp = [];
    $byTitle = [];
    foreach ($rows as $r) {
        if (!empty($r['mp_id'])) $byMp[$r['mp_id']] = $r;
        if ($r['status'] !== 'verkocht') $byTitle[norm_title_key($r['naam'])] = $r;
    }

    $seen = [];
    $added = 0; $priceUpd = 0; $dateUpd = 0;

    $updMatch = $pdo->prepare(
        'UPDATE items SET
            vermoedelijk_verkocht = 0,
            mp_id           = COALESCE(NULLIF(mp_id, ""), :mp_id),
            advertentie_url = :url,
            online_sinds    = COALESCE(online_sinds, :sinds),
            foto_url        = COALESCE(:foto, foto_url)
         WHERE id = :id'
    );
    $updPrice = $pdo->prepare('UPDATE items SET prijs_uit = :p WHERE id = :id');

    foreach ($snapshot as $e) {
        $mpId = trim((string) ($e['mpId'] ?? ''));
        $naam = trim((string) ($e['naam'] ?? ''));
        if ($naam === '' && $mpId === '') continue;
        $prijs = (float) ($e['prijsUit'] ?? 0);
        $url   = trim((string) ($e['advertentieUrl'] ?? ''));
        $sinds = nullable_date($e['onlineSinds'] ?? '');
        $foto  = trim((string) ($e['fotoUrl'] ?? ''));

        $match = null;
        if ($mpId !== '' && isset($byMp[$mpId])) {
            $match = $byMp[$mpId];
        } elseif ($naam !== '' && isset($byTitle[norm_title_key($naam)])) {
            $match = $byTitle[norm_title_key($naam)];
        }

        if ($match) {
            $id = $match['id'];
            $seen[$id] = true;
            $updMatch->execute([
                ':mp_id' => $mpId !== '' ? $mpId : null,
                ':url'   => $url !== '' ? $url : ($match['advertentie_url'] ?: null),
                ':sinds' => $sinds,
                ':foto'  => $foto !== '' ? $foto : null,
                ':id'    => $id,
            ]);
            if ($sinds && empty($match['online_sinds'])) $dateUpd++;
            if ($prijs > 0 && abs($prijs - (float) $match['prijs_uit']) >= 0.01) {
                $updPrice->execute([':p' => $prijs, ':id' => $id]);
                $priceUpd++;
            }
        } else {
            $item = normalize_item([
                'naam' => $naam, 'prijsUit' => $prijs, 'status' => 'te-koop', 'winkel' => 'Marktplaats',
                'advertentieUrl' => $url, 'mpId' => $mpId, 'onlineSinds' => $e['onlineSinds'] ?? '',
                'fotoUrl' => $foto,
            ], false);
            upsert_item($pdo, $item);
            $seen[$item['id']] = true;
            $added++;
        }
    }

    $flagged = 0;
    $flag = $pdo->prepare('UPDATE items SET vermoedelijk_verkocht = 1 WHERE id = ?');
    foreach ($rows as $r) {
        if ($r['status'] === 'te-koop' && empty($seen[$r['id']])
            && !empty($r['mp_id']) && empty($r['vermoedelijk_verkocht'])) {
            $flag->execute([$r['id']]);
            $flagged++;
        }
    }

    return [
        'gevonden'             => count($snapshot),
        'toegevoegd'           => $added,
        'prijs_bijgewerkt'     => $priceUpd,
        'datum_bijgewerkt'     => $dateUpd,
        'vermoedelijk_verkocht' => $flagged,
    ];
}

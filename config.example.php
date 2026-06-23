<?php
/**
 * Voorbeeld-configuratie voor Marktplaats Tracker.
 *
 * Kopieer dit bestand naar `config.php` en vul je eigen gegevens in.
 * `config.php` staat in .gitignore en hoort NOOIT in git/GitHub terecht te komen.
 */

return [
    // --- Database (mijn.host / MySQL) ---
    'db' => [
        'host'    => 'localhost',          // Bij mijn.host shared hosting is dit meestal 'localhost'
        'name'    => 'ht135931_VoorbeeldDB',
        'user'    => 'ht135931_VoorbeeldUser',
        'pass'    => 'JOUW_DB_WACHTWOORD',
        'charset' => 'utf8mb4',
    ],

    // --- App-login ---
    // Wachtwoord waarmee je in de app inlogt. Kies iets sterks en uniek.
    'app_password' => 'KIES_EEN_WACHTWOORD',

    // Naam van de sessiecookie (mag je laten staan).
    'session_name' => 'mp_tracker_sess',

    // --- Marktplaats-sync ---
    // Je verkoper-id, te vinden in je profiel-URL: marktplaats.nl/u/<naam>/<id>/
    'mp_seller_id' => '',
];

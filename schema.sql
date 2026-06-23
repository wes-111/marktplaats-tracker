-- Marktplaats Tracker — databaseschema
-- De app maakt deze tabel automatisch aan, maar je kunt hem ook handmatig
-- importeren via phpMyAdmin in het mijn.host configuratiescherm.

CREATE TABLE IF NOT EXISTS items (
    id            VARCHAR(32)    NOT NULL PRIMARY KEY,
    naam          VARCHAR(255)   NOT NULL,
    categorie     VARCHAR(64)    DEFAULT NULL,
    winkel        VARCHAR(255)   DEFAULT NULL,
    datum_inkoop  DATE           DEFAULT NULL,
    prijs_in      DECIMAL(10,2)  NOT NULL DEFAULT 0,
    prijs_uit     DECIMAL(10,2)  NOT NULL DEFAULT 0,
    status        VARCHAR(20)    NOT NULL DEFAULT 'te-koop',
    datum_verkoop DATE           DEFAULT NULL,
    notitie       TEXT           DEFAULT NULL,
    created_at    TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

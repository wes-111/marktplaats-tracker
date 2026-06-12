# Marktplaats Tracker

Een moderne web-app om je in- en verkoop bij te houden en je winst per maand en
categorie te zien. De data staat in een eigen MySQL-database (mijn.host) en de
app is beveiligd met een wachtwoord.

![Toevoegen · Overzicht · Statistieken]

## Functies

- 📦 Artikelen toevoegen, bewerken en verwijderen (naam, categorie, winkel, prijzen, status, datums, notitie)
- 💰 Live winst-/verliesberekening en statistieken per maand en categorie
- 🔍 Filteren op status (te koop, gereserveerd, verkocht)
- 🌗 Licht/donker thema (volgt standaard je systeem)
- 🔐 Wachtwoordbeveiliging
- ⬇️ Backup als JSON/CSV en importeren/migreren van oude data
- 📱 Installeerbaar op je telefoon (PWA)

## Structuur

```
index.html               front-end (markup)
manifest.webmanifest      PWA-manifest
assets/
  styles.css              styling (licht + donker)
  app.js                  app-logica (praat met de API)
  icon.svg                app-icoon
api/
  config.example.php      voorbeeldconfig (wél in git)
  config.php              JOUW geheime config (NIET in git)
  bootstrap.php           sessie + JSON-helpers
  db.php                  database (PDO) + tabel automatisch aanmaken
  login.php / logout.php / session.php   authenticatie
  items.php               CRUD-endpoint (incl. bulk-import)
  schema.sql              databaseschema (referentie)
  .htaccess               beschermt config/php-helpers
.gitignore                negeert api/config.php
```

## Vereisten

- Webhosting met **PHP 7.4+** en **MySQL/MariaDB** (mijn.host shared hosting voldoet)
- Een aangemaakte database + databasegebruiker met rechten op die database

## Installatie op mijn.host

1. **Config invullen.** Open `api/config.php` en controleer/vul in:
   - `db.host` – bij mijn.host meestal `localhost`
   - `db.name`, `db.user`, `db.pass` – je databasegegevens
   - `app_password` – **kies hier een eigen, sterk wachtwoord** voor de app-login
2. **Uploaden via FTP / bestandsbeheer.** Zet de hele map in de webroot van je domein
   of subdomein (bijv. `public_html/` of `public_html/tracker/`). Upload óók
   `api/config.php` (die staat niet in git, maar moet wel op de server staan).
3. **Openen.** Ga naar je domein in de browser. De tabel wordt automatisch
   aangemaakt bij het eerste gebruik. Log in met je `app_password`.

> Tip: gebruik je een submap zoals `/tracker/`, dan werkt alles automatisch
> omdat de app relatieve paden gebruikt (`api/...`).

### Bestaande data overzetten

Had je al artikelen in de oude versie (opgeslagen in je browser)?

- Open de app op **hetzelfde apparaat/browser** als waar de oude tracker draaide,
  ga naar **⚙️ Instellingen → "Oude browser-data overzetten"**. De app leest de
  oude `localStorage` en zet alles in de database.
- Of had je een **backup-bestand** (JSON)? Gebruik **Instellingen → "Backup-bestand importeren"**.

## Beveiliging

- De databasegegevens en het app-wachtwoord staan uitsluitend in `api/config.php`.
  Dit bestand staat in `.gitignore` en wordt nooit naar GitHub gepusht.
- `.htaccess` blokkeert directe toegang tot `config.php` en de PHP-helpers.
- De API vereist een geldige sessie; zonder inloggen krijg je `401`.
- Verander het standaard `app_password` vóór je live gaat.

## Lokaal testen (optioneel)

Met PHP geïnstalleerd kun je lokaal draaien:

```bash
php -S localhost:8000
```

Open daarna http://localhost:8000. Je hebt wel een bereikbare MySQL-database nodig
(pas `api/config.php` aan naar je lokale database).

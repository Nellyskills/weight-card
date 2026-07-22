# Nellyskills Weight Card

Eine Lovelace-Karte für Home Assistant, die dein zuletzt gemessenes Gewicht
(und optional deinen Körperfettanteil) anzeigt. Ein Klick auf die Karte öffnet
eine Detailansicht mit Balkendiagramm, automatisch skalierter Achse und
Seiten-Navigation durch ältere Zeiträume.

![Kachel](images/card-collapsed.jpg)
![Detailansicht](images/card-detail.jpg)

## Features

- Kompakte Kachel: letzter Messwert, Veränderung zur vorherigen Messung, optionale BMI-Anzeige
- Klick öffnet Detailansicht mit zwei Balkendiagrammen (Gewicht & Körperfett)
- Achsen skalieren sich automatisch auf deinen Wertebereich
- Vor-/Zurück-Navigation durch ältere Messzeiträume
- Frei einstellbare Mess-Frequenz: täglich, wöchentlich (mit Wochentag) oder monatlich (mit Tag im Monat)
- Konfigurierbare Gewichtseinheit (kg / lb / st)
- Werte werden live über die Home-Assistant-History-API geladen – keine zusätzliche Integration nötig
- Vollständig über den visuellen Karten-Editor konfigurierbar, kein YAML nötig

## Installation

### HACS (recommended)

1. Open HACS → Frontend
2. Click the three-dot menu → **Custom repositories**
3. Add `https://github.com/Nellyskills/weight-card` → Category: **Dashboard**
4. Search for **Sensor Card** and install
5. Reload your browser

### Manuell

1. [`nellyskills-weight-card.js`](nellyskills-weight-card.js) herunterladen
2. Datei nach `/config/www/` kopieren
3. Unter Einstellungen → Dashboards → Ressourcen hinzufügen:
   ```
   URL: /local/nellyskills-weight-card.js
   Typ: JavaScript-Modul
   ```

## Verwendung

Karte über den Dashboard-Editor hinzufügen und **„Nellyskills Weight Card"**
auswählen, oder per YAML:

```yaml
type: custom:nellyskills-weight-card
title: Gewicht
weight_entity: sensor.withings_gewicht
body_fat_entity: sensor.withings_koerperfett
weight_unit: kg
height_cm: 178
frequency: weekly
weekday: 1
```

## Konfiguration

| Option            | Pflicht | Beschreibung                                                                 |
|--------------------|:-------:|-------------------------------------------------------------------------------|
| `weight_entity`    | ✅      | Sensor-Entität mit dem Gewichtswert                                           |
| `body_fat_entity`  |         | Sensor-Entität mit dem Körperfettanteil (optional)                            |
| `title`            |         | Titel der Karte (Standard: „Körpergewicht")                                   |
| `weight_unit`      |         | Anzeigeeinheit: `kg`, `lb` oder `st` (Standard: `kg`)                          |
| `height_cm`        |         | Körpergröße in cm, aktiviert die BMI-Anzeige nach WHO-Formel                  |
| `frequency`        |         | `daily`, `weekly` oder `monthly` (Standard: `weekly`)                          |
| `weekday`          |         | Nur bei `frequency: weekly` – 1 (Montag) bis 7 (Sonntag)                       |
| `day_of_month`     |         | Nur bei `frequency: monthly` – Tag im Monat (1–31)                             |

Alle Optionen lassen sich auch komplett über den visuellen Karten-Editor
einstellen – YAML ist nicht erforderlich.

## Hinweise

- Die Karte liest Werte über die Home-Assistant-History-API. Stelle sicher,
  dass die verwendeten Entitäten vom Recorder erfasst werden (Standard, außer
  explizit ausgeschlossen).
- Fehlt an einem Zieltag ein Messwert, bleibt der entsprechende Balken leer,
  statt einen falschen Wert zu interpolieren.
- Die BMI-Berechnung folgt der WHO-Standardformel (Gewicht in kg / Körpergröße
  in m²) und verwendet für Erwachsene dieselben Grenzwerte unabhängig vom
  Geschlecht.

## Lizenz

MIT

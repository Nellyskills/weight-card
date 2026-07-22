# Nellyskills Weight Card

A Home Assistant Lovelace card for tracking body weight and body fat — a compact tile showing your last measurement, and a tap-to-open detail view with auto-scaling history charts, optional BMI, and a visual editor.

## Screenshots

### Tile with weight, body fat and BMI

![Weight Card – Tile](card-collapsed.jpg)

### Detail view with history charts

![Weight Card – Detail view](card-detail.jpg)

## Features

- ⚖️ Compact tile showing your last measured weight and body fat, tap to open the full history view
- 📊 Auto-scaling bar charts for weight & body fat, with clean comma-formatted value labels and a left-hand scale
- ◀️▶️ Page back through older measurement periods
- 🗓️ Configurable measuring frequency — daily, weekly (pick the weekday) or monthly (pick the day of month)
- 📏 Optional BMI display (WHO formula) once a height is set — no gender needed, per WHO guidance for adults
- 🔢 Configurable weight unit — kg, lb or st
- ✍️ Optional manual entry — type values straight into the detail view, no physical scale required (writes to an `input_number` helper)
- 🎨 Fully adapts to your Home Assistant theme (light & dark)
- ⚙️ Built-in visual editor — no YAML required

## Installation

### HACS (recommended)

1. Open HACS → Frontend
2. Click the three-dot menu → **Custom repositories**
3. Add `https://github.com/Nellyskills/nellyskills-weight-card` → Category: **Dashboard**
4. Search for **Nellyskills Weight Card** and install
5. Reload your browser

### Manual

1. Download `nellyskills-weight-card.js` from the [latest release](https://github.com/Nellyskills/nellyskills-weight-card/releases/latest)
2. Copy it to `config/www/nellyskills-weight-card.js`
3. Go to **Settings → Dashboards → Resources** and add:
   ```
   URL: /local/nellyskills-weight-card.js
   Type: JavaScript Module
   ```
4. Hard reload your browser (Ctrl+Shift+R)

## Usage

Add the card via the visual editor or paste YAML manually.

### Minimal config

```yaml
type: custom:nellyskills-weight-card
weight_entity: sensor.withings_weight
```

### Full example

```yaml
type: custom:nellyskills-weight-card
title: Weight
weight_entity: sensor.withings_weight
body_fat_entity: sensor.withings_body_fat
weight_unit: kg
height_cm: 178
frequency: weekly
weekday: 1
manual_entry: false
```

## Configuration

| Option             | Required | Default   | Description                                                                                       |
|---------------------|:--------:|-----------|-----------------------------------------------------------------------------------------------------|
| `weight_entity`     | ✅       | —         | Sensor (or `input_number`) entity holding the weight value                                          |
| `body_fat_entity`   | ❌       | —         | Sensor (or `input_number`) entity holding the body fat percentage                                    |
| `title`             | ❌       | `Körpergewicht` | Card title                                                                                     |
| `weight_unit`       | ❌       | `kg`      | Display unit: `kg`, `lb` or `st`                                                                     |
| `height_cm`         | ❌       | —         | Height in cm; enables the BMI line (WHO formula) under the weight value                              |
| `frequency`         | ❌       | `weekly`  | `daily`, `weekly` or `monthly`                                                                        |
| `weekday`           | ❌       | `1`       | Only with `frequency: weekly` — 1 (Monday) to 7 (Sunday)                                              |
| `day_of_month`      | ❌       | `1`       | Only with `frequency: monthly` — day of month (1–31)                                                  |
| `manual_entry`      | ❌       | `false`   | Adds a small input box (kg/%) in the detail view. Requires `weight_entity`/`body_fat_entity` to be `input_number` helpers, since only those can be written to |

## License

MIT © [Nellyskills](https://github.com/Nellyskills)

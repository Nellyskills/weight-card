/* Nellyskills Weight Card
 * Zeigt zuletzt gemessenes Gewicht + optional Koerperfett.
 * Klick oeffnet Detailansicht mit Balkendiagramm (Verlauf), Seiten-Navigation
 * und automatisch skalierter Achse. Frequenz (taeglich/woechentlich/monatlich)
 * konfigurierbar ueber den visuellen Editor.
 */

const WEEKDAY_NAMES_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WEEKDAY_NAMES_LONG = [
  "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"
];
const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"
];

const POINTS_PER_PAGE = 8;

function deNum(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return value.toFixed(decimals).replace(".", ",");
}

function isoDateOnly(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function endOfDay(d) {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

/* jsGetDay: 0=So,1=Mo...6=Sa -> wir rechnen intern mit 1=Mo..7=So */
function isoWeekday(d) {
  const jsDay = d.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

/* ---------- Zielzeitpunkte je Frequenz + Seite berechnen ---------- */

function computeTargets(config, pageOffset) {
  const now = new Date();
  const targets = [];

  if (config.frequency === "daily") {
    // Seite = Kalenderwoche (Mo-So). pageOffset 0 = aktuelle Woche.
    const currentIsoWeekday = isoWeekday(now);
    const monday = new Date(now);
    monday.setDate(now.getDate() - (currentIsoWeekday - 1) - pageOffset * 7);
    monday.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      targets.push(endOfDay(d));
    }
  } else if (config.frequency === "weekly") {
    const targetWeekday = config.weekday || 1; // 1=Mo..7=So
    const d = new Date(now);
    // naechsten (oder heutigen) Zieltag in dieser Woche finden, dann zurueckrechnen
    const diffToTarget = targetWeekday - isoWeekday(d);
    d.setDate(d.getDate() + diffToTarget);
    if (d > now) d.setDate(d.getDate() - 7);
    d.setDate(d.getDate() - pageOffset * 7 * POINTS_PER_PAGE);
    for (let i = POINTS_PER_PAGE - 1; i >= 0; i--) {
      const t = new Date(d);
      t.setDate(d.getDate() - i * 7);
      targets.push(endOfDay(t));
    }
  } else if (config.frequency === "monthly") {
    const targetDom = config.day_of_month || 1;
    const base = new Date(now.getFullYear(), now.getMonth(), targetDom);
    if (base > now) base.setMonth(base.getMonth() - 1);
    base.setMonth(base.getMonth() - pageOffset * POINTS_PER_PAGE);
    for (let i = POINTS_PER_PAGE - 1; i >= 0; i--) {
      const t = new Date(base.getFullYear(), base.getMonth() - i, targetDom);
      targets.push(endOfDay(t));
    }
  }
  return targets;
}

function formatXLabel(config, date) {
  if (config.frequency === "daily") return WEEKDAY_NAMES_SHORT[isoWeekday(date) - 1];
  if (config.frequency === "weekly") return `${date.getDate()}.${date.getMonth() + 1}.`;
  return MONTH_NAMES_SHORT[date.getMonth()];
}

function formatHeaderLabel(config, targets) {
  const first = targets[0];
  const last = targets[targets.length - 1];
  const dm = (d) => `${d.getDate()}. ${MONTH_NAMES_SHORT[d.getMonth()]}`;
  const range = `${dm(first)} – ${dm(last)}`;
  if (config.frequency === "daily") return { range, sub: "täglich" };
  if (config.frequency === "weekly") {
    return { range, sub: `jeden ${WEEKDAY_NAMES_LONG[(config.weekday || 1) - 1]}` };
  }
  return { range, sub: `monatlich, jeweils am ${config.day_of_month || 1}.` };
}

function toKg(value, unit) {
  if (unit === "lb") return value * 0.453592;
  if (unit === "st") return value * 6.35029;
  return value;
}

function calcBmi(weightValue, weightUnit, heightCm) {
  if (!heightCm || heightCm <= 0 || weightValue === null || weightValue === undefined) return null;
  const kg = toKg(weightValue, weightUnit);
  const heightM = heightCm / 100;
  return kg / (heightM * heightM);
}

function bmiCategory(bmi) {
  if (bmi < 18.5) return "Untergewicht";
  if (bmi < 25) return "Normalgewicht";
  if (bmi < 30) return "Übergewicht";
  return "Adipositas";
}

/* ---------- History laden ---------- */

async function fetchHistoryValues(hass, entityId, targets) {
  if (!entityId) return targets.map(() => null);
  const bufferMs = 5 * 24 * 60 * 60 * 1000;
  const start = new Date(targets[0].getTime() - bufferMs);
  const end = new Date(targets[targets.length - 1].getTime() + 60 * 60 * 1000);
  let entries = [];
  try {
    const path = `history/period/${start.toISOString()}?filter_entity_id=${entityId}&end_time=${end.toISOString()}`;
    const result = await hass.callApi("GET", path);
    entries = (result && result[0]) || [];
  } catch (err) {
    return targets.map(() => null);
  }
  const maxLookbackMs = 3 * 24 * 60 * 60 * 1000;
  return targets.map((target) => {
    let best = null;
    for (const e of entries) {
      const t = new Date(e.last_changed).getTime();
      if (t <= target.getTime() && target.getTime() - t <= maxLookbackMs) {
        const val = parseFloat(e.state);
        if (!Number.isNaN(val) && (!best || t > best.t)) best = { t, val };
      }
    }
    return best ? best.val : null;
  });
}

/* ---------- SVG Balkendiagramm ---------- */

function renderBarChartSvg(values, xLabels, color) {
  const width = 400;
  const height = 150;
  const padTop = 22;
  const padBottom = 20;
  const padLeft = 28;
  const padRight = 8;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const known = values.filter((v) => v !== null);
  if (known.length === 0) {
    return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:${height}px;">
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="12" fill="var(--secondary-text-color)">Keine Daten</text>
    </svg>`;
  }

  const min = Math.min(...known);
  const max = Math.max(...known);
  const range = Math.max(max - min, 1);
  const pad = Math.max(range * 0.25, 1);
  let yMin = Math.floor(min - pad);
  let yMax = Math.ceil(max + pad);
  if (yMin === yMax) yMax = yMin + 1;

  const yToPx = (v) => padTop + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const n = values.length;
  const slot = plotW / n;
  const barW = Math.min(slot * 0.55, 26);

  const tickCount = 4;
  let ticks = "";
  for (let i = 0; i < tickCount; i++) {
    const v = yMin + ((yMax - yMin) * i) / (tickCount - 1);
    const y = yToPx(v);
    ticks += `<text x="${padLeft - 6}" y="${y + 3}" text-anchor="end" font-size="10" fill="var(--secondary-text-color)">${Math.round(v)}</text>`;
  }

  let bars = "";
  let labels = "";
  values.forEach((v, i) => {
    const cx = padLeft + slot * i + slot / 2;
    labels += `<text x="${cx}" y="${height - 4}" text-anchor="middle" font-size="11" fill="var(--secondary-text-color)">${xLabels[i]}</text>`;
    if (v === null) {
      const y0 = yToPx(yMin);
      bars += `<rect x="${cx - barW / 2}" y="${y0 - 3}" width="${barW}" height="3" rx="2" fill="var(--divider-color)"></rect>`;
      return;
    }
    const barTop = yToPx(v);
    const barHeight = padTop + plotH - barTop;
    bars += `<rect x="${cx - barW / 2}" y="${barTop}" width="${barW}" height="${Math.max(barHeight, 2)}" rx="6" fill="${color}"></rect>`;
    bars += `<text x="${cx}" y="${barTop - 7}" text-anchor="middle" font-size="11" font-weight="500" fill="var(--primary-text-color)">${deNum(v)}</text>`;
  });

  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:${height}px;">
    ${ticks}
    ${bars}
    ${labels}
  </svg>`;
}

/* =================== CARD =================== */

class NellyskillsWeightCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._pageOffset = 0;
    this._lastWeightChanged = null;
  }

  setConfig(config) {
    if (!config.weight_entity) {
      throw new Error("Bitte eine Gewicht-Entität auswählen");
    }
    this._config = config;
    if (!this._built) this._buildShell();
    this._applyStaticConfig();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) return;
    const stateObj = hass.states[this._config.weight_entity];
    const changedAt = stateObj ? stateObj.last_changed : null;
    if (changedAt !== this._lastWeightChanged) {
      this._lastWeightChanged = changedAt;
      this._refreshSummary();
    }
  }

  getCardSize() {
    return 3;
  }

  static getConfigElement() {
    return document.createElement("nellyskills-weight-card-editor");
  }

  static getStubConfig() {
    return { weight_entity: "", frequency: "weekly", weekday: 1 };
  }

  _buildShell() {
    this._built = true;
    this.shadowRoot.innerHTML = `
      <style>
        ha-card { cursor: pointer; }
        .content { padding: 16px; }
        .header { display:flex; align-items:center; gap:8px; color: var(--secondary-text-color); font-size:13px; margin-bottom:12px; }
        .header ha-icon { --mdc-icon-size: 18px; }
        .metrics { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
        .metric { }
        .metric.hidden { display:none; }
        .metric + .metric { border-left: 1px solid var(--divider-color); padding-left:12px; }
        .label { font-size:13px; color: var(--secondary-text-color); margin:0 0 4px; }
        .value { font-size:24px; font-weight:500; margin:0; color: var(--primary-text-color); }
        .delta { font-size:12px; margin:4px 0 0; }
        .delta.down { color: var(--success-color, #4caf50); }
        .delta.up { color: var(--error-color, #db4437); }
        .delta.flat { color: var(--secondary-text-color); }
        .bmi { font-size:11px; color: var(--secondary-text-color); margin:2px 0 0; }

        .overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5);
          display:none; align-items:center; justify-content:center; z-index:600;
        }
        .overlay.open { display:flex; }
        .dialog {
          background: var(--card-background-color, #fff); border-radius:12px;
          padding:20px; width: min(480px, 92vw); max-height:88vh; overflow-y:auto;
        }
        .dlg-nav { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; }
        .dlg-nav button {
          background:none; border:none; cursor:pointer; width:32px; height:32px;
          display:flex; align-items:center; justify-content:center; color: var(--primary-text-color);
        }
        .dlg-nav button[disabled] { opacity:0.3; cursor:default; }
        .dlg-nav .period { text-align:center; }
        .dlg-nav .period .range { font-size:14px; font-weight:500; margin:0; color: var(--primary-text-color); }
        .dlg-nav .period .sub { font-size:12px; color: var(--secondary-text-color); margin:2px 0 0; }
        .chart-block { margin-top:18px; }
        .chart-title-row { display:flex; align-items:baseline; justify-content:space-between; margin:0 0 2px; }
        .chart-title-row .name { font-size:13px; color: var(--secondary-text-color); margin:0; }
        .chart-title-row .delta-text { font-size:12px; margin:0; }
      </style>
      <ha-card>
        <div class="content" id="tap-area">
          <div class="header"><ha-icon icon="mdi:scale-bathroom"></ha-icon><span id="title-text"></span></div>
          <div class="metrics">
            <div class="metric" id="weight-metric">
              <p class="label">Gewicht</p>
              <p class="value" id="weight-value">–</p>
              <p class="delta" id="weight-delta"></p>
              <p class="bmi" id="weight-bmi"></p>
            </div>
            <div class="metric" id="fat-metric">
              <p class="label">Körperfett</p>
              <p class="value" id="fat-value">–</p>
              <p class="delta" id="fat-delta"></p>
            </div>
          </div>
        </div>
      </ha-card>
      <div class="overlay" id="overlay">
        <div class="dialog">
          <div class="dlg-nav">
            <button id="prev-btn" aria-label="Zurück"><ha-icon icon="mdi:chevron-left"></ha-icon></button>
            <div class="period">
              <p class="range" id="period-range"></p>
              <p class="sub" id="period-sub"></p>
            </div>
            <button id="next-btn" aria-label="Vor"><ha-icon icon="mdi:chevron-right"></ha-icon></button>
          </div>
          <div class="chart-block">
            <div class="chart-title-row">
              <p class="name" id="weight-chart-label">Gewicht</p>
              <p class="delta-text" id="weight-chart-delta"></p>
            </div>
            <div id="weight-chart-container"></div>
          </div>
          <div class="chart-block" id="fat-chart-block">
            <div class="chart-title-row">
              <p class="name">Körperfett (%)</p>
              <p class="delta-text" id="fat-chart-delta"></p>
            </div>
            <div id="fat-chart-container"></div>
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.getElementById("tap-area").addEventListener("click", () => this._openDialog());
    this.shadowRoot.getElementById("overlay").addEventListener("click", (ev) => {
      if (ev.target.id === "overlay") this._closeDialog();
    });
    this.shadowRoot.getElementById("prev-btn").addEventListener("click", () => this._page(1));
    this.shadowRoot.getElementById("next-btn").addEventListener("click", () => this._page(-1));
  }

  _applyStaticConfig() {
    const root = this.shadowRoot;
    root.getElementById("title-text").textContent = this._config.title || "Körpergewicht";
    const unit = this._config.weight_unit || "kg";
    root.getElementById("weight-chart-label").textContent = `Gewicht (${unit})`;
    const hasFat = !!this._config.body_fat_entity;
    root.getElementById("fat-metric").classList.toggle("hidden", !hasFat);
    root.getElementById("fat-chart-block").style.display = hasFat ? "" : "none";
  }

  async _refreshSummary() {
    if (!this._hass || !this._config) return;
    const root = this.shadowRoot;
    const targets = computeTargets(this._config, 0);
    const showFat = !!this._config.body_fat_entity;

    const [weightValues, fatValues] = await Promise.all([
      fetchHistoryValues(this._hass, this._config.weight_entity, targets),
      fetchHistoryValues(this._hass, this._config.body_fat_entity, targets),
    ]);

    const current = weightValues[weightValues.length - 1];
    const weightUnit = this._config.weight_unit || "kg";
    root.getElementById("weight-value").textContent = current !== null && current !== undefined ? `${deNum(current)} ${weightUnit}` : "–";
    if (showFat) {
      const currentFat = fatValues[fatValues.length - 1];
      root.getElementById("fat-value").textContent = currentFat !== null && currentFat !== undefined ? `${deNum(currentFat)} %` : "–";
    }

    this._setDelta("weight-delta", weightValues, weightUnit);
    if (showFat) this._setDelta("fat-delta", fatValues, "%");

    const bmiEl = root.getElementById("weight-bmi");
    const bmi = calcBmi(current, weightUnit, this._config.height_cm);
    bmiEl.textContent = bmi !== null ? `BMI ${deNum(bmi)} · ${bmiCategory(bmi)}` : "";
  }

  _setDelta(elementId, values, unit) {
    const el = this.shadowRoot.getElementById(elementId);
    const known = values.filter((v) => v !== null);
    if (known.length < 2) { el.textContent = ""; return; }
    const last = known[known.length - 1];
    const prev = known[known.length - 2];
    const diff = last - prev;
    el.classList.remove("up", "down", "flat");
    if (Math.abs(diff) < 0.05) {
      el.classList.add("flat");
      el.textContent = "keine Veränderung";
    } else {
      el.classList.add(diff < 0 ? "down" : "up");
      el.textContent = `${diff > 0 ? "+" : ""}${deNum(diff)} ${unit} zur letzten Messung`;
    }
  }

  _openDialog() {
    this._pageOffset = 0;
    this.shadowRoot.getElementById("overlay").classList.add("open");
    this._renderDialog();
  }

  _closeDialog() {
    this.shadowRoot.getElementById("overlay").classList.remove("open");
  }

  _page(delta) {
    const newOffset = this._pageOffset + delta;
    if (newOffset < 0) return;
    this._pageOffset = newOffset;
    this._renderDialog();
  }

  async _renderDialog() {
    if (!this._hass || !this._config) return;
    const root = this.shadowRoot;
    const targets = computeTargets(this._config, this._pageOffset);
    const xLabels = targets.map((t) => formatXLabel(this._config, t));
    const header = formatHeaderLabel(this._config, targets);
    root.getElementById("period-range").textContent = header.range;
    root.getElementById("period-sub").textContent = header.sub;
    root.getElementById("next-btn").disabled = this._pageOffset === 0;

    const showFat = !!this._config.body_fat_entity;
    const [weightValues, fatValues] = await Promise.all([
      fetchHistoryValues(this._hass, this._config.weight_entity, targets),
      fetchHistoryValues(this._hass, this._config.body_fat_entity, targets),
    ]);

    root.getElementById("weight-chart-container").innerHTML = renderBarChartSvg(weightValues, xLabels, "#2a78d6");
    this._setPeriodDeltaText("weight-chart-delta", weightValues, this._config.weight_unit || "kg");

    if (showFat) {
      root.getElementById("fat-chart-container").innerHTML = renderBarChartSvg(fatValues, xLabels, "#eb6834");
      this._setPeriodDeltaText("fat-chart-delta", fatValues, "%");
    }
  }

  _setPeriodDeltaText(elementId, values, unit) {
    const el = this.shadowRoot.getElementById(elementId);
    const known = values.filter((v) => v !== null);
    if (known.length < 2) { el.textContent = ""; return; }
    const diff = known[known.length - 1] - known[0];
    el.classList.remove("weight-delta-color");
    el.style.color = diff <= 0 ? "var(--success-color, #4caf50)" : "var(--error-color, #db4437)";
    el.textContent = `${diff > 0 ? "+" : ""}${deNum(diff)} ${unit} im Zeitraum`;
  }
}

customElements.define("nellyskills-weight-card", NellyskillsWeightCard);

/* =================== EDITOR =================== */

class NellyskillsWeightCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    this._config = { ...config };
    if (!this._built) this._buildShell();
    this._syncValues();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._weightPicker) this._weightPicker.hass = hass;
    if (this._fatPicker) this._fatPicker.hass = hass;
  }

  _buildShell() {
    this._built = true;
    this.shadowRoot.innerHTML = `
      <style>
        .form { display:flex; flex-direction:column; gap:16px; padding:8px 0; }
        .field label { display:block; font-size:13px; color: var(--secondary-text-color); margin-bottom:6px; }
        .text-input, select {
          width:100%; box-sizing:border-box; height:40px; padding:0 10px;
          border-radius:8px; border:1px solid var(--divider-color);
          background: var(--card-background-color, #fff); color: var(--primary-text-color); font-size:14px;
        }
        .row { display:flex; gap:12px; }
        .row > div { flex:1; }
        .hidden { display:none; }
      </style>
      <div class="form">
        <div class="field">
          <label>Titel (optional)</label>
          <input class="text-input" id="title-input" type="text" />
        </div>
        <div class="field">
          <label>Gewicht-Entität</label>
          <div id="weight-picker-slot"></div>
        </div>
        <div class="field">
          <label>Körperfett-Entität (optional)</label>
          <div id="fat-picker-slot"></div>
        </div>
        <div class="field">
          <label>Gewichtseinheit</label>
          <select id="unit-select">
            <option value="kg">kg</option>
            <option value="lb">lb</option>
            <option value="st">st</option>
          </select>
        </div>
        <div class="field">
          <label>Körpergröße in cm (optional, für BMI-Anzeige)</label>
          <input class="text-input" id="height-input" type="number" min="50" max="250" />
        </div>
        <div class="field">
          <label>Wie oft wiegst du dich?</label>
          <select id="frequency-select">
            <option value="daily">Täglich</option>
            <option value="weekly">Wöchentlich</option>
            <option value="monthly">Monatlich</option>
          </select>
        </div>
        <div class="field" id="weekday-field">
          <label>An welchem Wochentag?</label>
          <select id="weekday-select">
            <option value="1">Montag</option>
            <option value="2">Dienstag</option>
            <option value="3">Mittwoch</option>
            <option value="4">Donnerstag</option>
            <option value="5">Freitag</option>
            <option value="6">Samstag</option>
            <option value="7">Sonntag</option>
          </select>
        </div>
        <div class="field" id="dom-field">
          <label>An welchem Tag im Monat?</label>
          <input class="text-input" id="dom-input" type="number" min="1" max="31" />
        </div>
      </div>
    `;

    this._weightPicker = document.createElement("ha-entity-picker");
    this._weightPicker.includeDomains = ["sensor"];
    this._weightPicker.required = true;
    this.shadowRoot.getElementById("weight-picker-slot").appendChild(this._weightPicker);
    this._weightPicker.addEventListener("value-changed", (ev) => {
      this._updateConfig("weight_entity", ev.detail.value);
    });

    this._fatPicker = document.createElement("ha-entity-picker");
    this._fatPicker.includeDomains = ["sensor"];
    this.shadowRoot.getElementById("fat-picker-slot").appendChild(this._fatPicker);
    this._fatPicker.addEventListener("value-changed", (ev) => {
      this._updateConfig("body_fat_entity", ev.detail.value);
    });

    this.shadowRoot.getElementById("title-input").addEventListener("input", (ev) => {
      this._updateConfig("title", ev.target.value);
    });
    this.shadowRoot.getElementById("unit-select").addEventListener("change", (ev) => {
      this._updateConfig("weight_unit", ev.target.value);
    });
    this.shadowRoot.getElementById("height-input").addEventListener("input", (ev) => {
      this._updateConfig("height_cm", parseFloat(ev.target.value) || null);
    });
    this.shadowRoot.getElementById("frequency-select").addEventListener("change", (ev) => {
      this._updateConfig("frequency", ev.target.value);
      this._toggleFrequencyFields(ev.target.value);
    });
    this.shadowRoot.getElementById("weekday-select").addEventListener("change", (ev) => {
      this._updateConfig("weekday", parseInt(ev.target.value, 10));
    });
    this.shadowRoot.getElementById("dom-input").addEventListener("input", (ev) => {
      this._updateConfig("day_of_month", parseInt(ev.target.value, 10) || 1);
    });
  }

  _toggleFrequencyFields(frequency) {
    this.shadowRoot.getElementById("weekday-field").classList.toggle("hidden", frequency !== "weekly");
    this.shadowRoot.getElementById("dom-field").classList.toggle("hidden", frequency !== "monthly");
  }

  _syncValues() {
    const c = this._config;
    this.shadowRoot.getElementById("title-input").value = c.title || "";
    this._weightPicker.value = c.weight_entity || "";
    this._fatPicker.value = c.body_fat_entity || "";
    this.shadowRoot.getElementById("unit-select").value = c.weight_unit || "kg";
    this.shadowRoot.getElementById("height-input").value = c.height_cm || "";
    const freq = c.frequency || "weekly";
    this.shadowRoot.getElementById("frequency-select").value = freq;
    this.shadowRoot.getElementById("weekday-select").value = String(c.weekday || 1);
    this.shadowRoot.getElementById("dom-input").value = c.day_of_month || 1;
    this._toggleFrequencyFields(freq);
  }

  _updateConfig(key, value) {
    if (!this._config) return;
    const newConfig = JSON.parse(JSON.stringify(this._config));
    newConfig[key] = value;
    this._config = newConfig;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: newConfig } }));
  }
}

customElements.define("nellyskills-weight-card-editor", NellyskillsWeightCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "nellyskills-weight-card",
  name: "Nellyskills Weight Card",
  description: "Gewicht & Körperfett mit Verlaufsdiagramm, konfigurierbarer Messfrequenz.",
});
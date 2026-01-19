/* =========================
   Quote Intake Tool (app.js)
   - localStorage persistence
   - license state selector
   - save/open JSON file (File System Access API + fallback)
========================= */

const STORAGE_KEY = "quote_intake_v1";
const FILE_HANDLE_KEY = "quote_intake_file_handle_v1"; // not always storable depending on browser

const driverCountEl = document.getElementById("driverCount");
const vehicleCountEl = document.getElementById("vehicleCount");
const driversEl = document.getElementById("drivers");
const vehiclesEl = document.getElementById("vehicles");

const custNameEl = document.getElementById("custName");
const custPhoneEl = document.getElementById("custPhone");
const custEmailEl = document.getElementById("custEmail");

const jsonBoxEl = document.getElementById("jsonBox");
const saveStatusEl = document.getElementById("saveStatus");

const btnNew = document.getElementById("btnNew");
const btnOpen = document.getElementById("btnOpen");
const btnSave = document.getElementById("btnSave");
const btnSaveAs = document.getElementById("btnSaveAs");
const btnDownload = document.getElementById("btnDownload");
const btnImport = document.getElementById("btnImport");

const toastEl = document.getElementById("toast");

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"
];

/* ---------- Toast ---------- */
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove("show"), 1400);
}

/* ---------- Clipboard ---------- */
async function copy(text) {
  const value = String(text ?? "").trim();
  if (!value) return toast("Nothing to copy");
  try {
    await navigator.clipboard.writeText(value);
    toast("Copied!");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = value;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    toast("Copied!");
  }
}

/* ---------- Select populate ---------- */
function populateSelect(select, max, defaultVal = 0) {
  select.innerHTML = "";
  for (let i = 0; i <= max; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    select.appendChild(opt);
  }
  select.value = defaultVal;
}

/* ---------- VIN helpers ---------- */
function sanitizeVin(raw) {
  return String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

async function decodeVIN(vin) {
  const v = sanitizeVin(vin);
  if (v.length !== 17) return { ok: false, message: "VIN must be 17 characters" };

  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(v)}?format=json`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const r = data?.Results?.[0] || {};
    const text = `${r.ModelYear || ""} ${r.Make || ""} ${r.Model || ""}`.trim();
    return { ok: true, message: text || "Decoded (partial)" };
  } catch {
    return { ok: false, message: "Network error decoding VIN" };
  }
}

/* ---------- Snapshot current UI into data ---------- */
function snapshotDriversFromUI() {
  const cards = [...driversEl.querySelectorAll(".card[data-driver-index]")];
  return cards.map(card => ({
    name: card.querySelector('[data-field="name"]').value || "",
    dob: card.querySelector('[data-field="dob"]').value || "",
    licenseState: card.querySelector('[data-field="licenseState"]').value || "",
    license: card.querySelector('[data-field="license"]').value || ""
  }));
}

function snapshotVehiclesFromUI() {
  const cards = [...vehiclesEl.querySelectorAll(".card[data-vehicle-index]")];
  return cards.map(card => ({
    vin: sanitizeVin(card.querySelector('[data-field="vin"]').value || ""),
    decoded: card.querySelector('[data-field="decoded"]').textContent || "—"
  }));
}

function getFormData() {
  return {
    customer: {
      name: custNameEl.value || "",
      phone: custPhoneEl.value || "",
      email: custEmailEl.value || ""
    },
    counts: {
      drivers: Number(driverCountEl.value || 0),
      vehicles: Number(vehicleCountEl.value || 0)
    },
    drivers: snapshotDriversFromUI(),
    vehicles: snapshotVehiclesFromUI(),
    meta: {
      version: 1,
      updatedAt: new Date().toISOString()
    }
  };
}

/* ---------- Apply data to UI ---------- */
function setFormData(data) {
  if (!data || typeof data !== "object") return;

  custNameEl.value = data?.customer?.name ?? "";
  custPhoneEl.value = data?.customer?.phone ?? "";
  custEmailEl.value = data?.customer?.email ?? "";

  const dCount = Number(data?.counts?.drivers ?? 0);
  const vCount = Number(data?.counts?.vehicles ?? 0);

  driverCountEl.value = String(dCount);
  vehicleCountEl.value = String(vCount);

  // Render with seed arrays
  renderDrivers(dCount, data.drivers || []);
  renderVehicles(vCount, data.vehicles || []);

  scheduleAutosave("Loaded");
}

/* ---------- Cards ---------- */
function stateOptionsHtml(selected) {
  return US_STATES.map(s => {
    const sel = (s === selected) ? "selected" : "";
    return `<option value="${s}" ${sel}>${s}</option>`;
  }).join("");
}

function driverCard(index, seed) {
  const div = document.createElement("div");
  div.className = "card";
  div.dataset.driverIndex = index;

  div.innerHTML = `
    <div class="card-header">
      <strong>Driver ${index + 1}</strong>
      <div class="actions">
        <button type="button" data-action="copyLicense">Copy License</button>
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label>Name</label>
        <input data-field="name" autocomplete="off">
      </div>
      <div class="field">
        <label>DOB</label>
        <input data-field="dob" type="date">
      </div>
      <div class="field">
        <label>License State</label>
        <select data-field="licenseState">
          <option value="">—</option>
          ${stateOptionsHtml(seed?.licenseState || "")}
        </select>
      </div>
      <div class="field">
        <label>License #</label>
        <input data-field="license" autocomplete="off">
      </div>
    </div>
  `;

  div.querySelector('[data-field="name"]').value = seed?.name || "";
  div.querySelector('[data-field="dob"]').value = seed?.dob || "";
  div.querySelector('[data-field="license"]').value = seed?.license || "";

  div.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.action === "copyLicense") {
      const state = div.querySelector('[data-field="licenseState"]').value;
      const lic = div.querySelector('[data-field="license"]').value;
      const combined = [state, lic].filter(Boolean).join(" ");
      copy(combined);
    }
  });

  return div;
}

function vehicleCard(index, seed) {
  const div = document.createElement("div");
  div.className = "card";
  div.dataset.vehicleIndex = index;

  div.innerHTML = `
    <div class="card-header">
      <strong>Vehicle ${index + 1}</strong>
      <div class="actions">
        <button type="button" data-action="copyVin">Copy VIN</button>
        <button type="button" data-action="decodeVin">Decode VIN</button>
        <a href="#" data-action="openNhtsa" class="muted">Open NHTSA</a>
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label>VIN</label>
        <input data-field="vin" autocomplete="off" maxlength="24">
      </div>
      <div class="field" style="min-width: 260px;">
        <label>Decoded (Year Make Model)</label>
        <div class="decoded" data-field="decoded">—</div>
      </div>
    </div>
  `;

  const vinInput = div.querySelector('[data-field="vin"]');
  const decodedEl = div.querySelector('[data-field="decoded"]');

  vinInput.value = sanitizeVin(seed?.vin || "");
  decodedEl.textContent = seed?.decoded || "—";

  async function doDecode() {
    const vin = sanitizeVin(vinInput.value);
    vinInput.value = vin;
    decodedEl.textContent = "Decoding...";
    const r = await decodeVIN(vin);
    decodedEl.textContent = r.message;
    scheduleAutosave("Auto-saved");
  }

  div.addEventListener("click", async (e) => {
    const el = e.target.closest("button, a");
    if (!el) return;

    const action = el.dataset.action;
    const vin = sanitizeVin(vinInput.value);

    if (action === "copyVin") {
      copy(vin);
    } else if (action === "decodeVin") {
      await doDecode();
    } else if (action === "openNhtsa") {
      e.preventDefault();
      if (vin.length !== 17) return toast("Enter 17-character VIN first");
      const url = `https://vpic.nhtsa.dot.gov/decoder/Decoder?VIN=${encodeURIComponent(vin)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  });

  // Optional: decode on blur if VIN is valid
  vinInput.addEventListener("blur", async () => {
    const vin = sanitizeVin(vinInput.value);
    if (vin.length === 17) await doDecode();
  });

  return div;
}

/* ---------- Render while preserving existing data ---------- */
function renderDrivers(count, seedArray) {
  const prev = seedArray?.length ? seedArray : snapshotDriversFromUI();
  driversEl.innerHTML = "";
  for (let i = 0; i < count; i++) {
    driversEl.appendChild(driverCard(i, prev[i] || {}));
  }
}

function renderVehicles(count, seedArray) {
  const prev = seedArray?.length ? seedArray : snapshotVehiclesFromUI();
  vehiclesEl.innerHTML = "";
  for (let i = 0; i < count; i++) {
    vehiclesEl.appendChild(vehicleCard(i, prev[i] || {}));
  }
}

/* ---------- localStorage persistence ---------- */
let autosaveTimer = null;

function scheduleAutosave(statusText = "Auto-saved locally") {
  saveStatusEl.textContent = statusText;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    const data = getFormData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    saveStatusEl.textContent = "Auto-saved locally";
  }, 150);
}

function loadFromLocalStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/* ---------- File Save/Open (best way) ---------- */
let fileHandle = null;

function fileApiSupported() {
  return typeof window.showOpenFilePicker === "function" &&
         typeof window.showSaveFilePicker === "function";
}

async function saveToHandle(handle, dataObj) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(dataObj, null, 2));
  await writable.close();
}

async function saveAsFile() {
  const data = getFormData();

  if (!fileApiSupported()) {
    toast("File save not supported here. Use Download JSON instead.");
    return;
  }

  const handle = await window.showSaveFilePicker({
    suggestedName: safeFilenameFromCustomer(data),
    types: [{ description: "Quote Intake JSON", accept: { "application/json": [".json"] } }]
  });

  await saveToHandle(handle, data);
  fileHandle = handle;
  toast("Saved");
}

async function saveFile() {
  const data = getFormData();

  if (!fileApiSupported()) {
    toast("File save not supported here. Use Download JSON instead.");
    return;
  }

  if (!fileHandle) {
    await saveAsFile();
    return;
  }

  await saveToHandle(fileHandle, data);
  toast("Saved");
}

async function openFile() {
  if (!fileApiSupported()) {
    toast("File open not supported here. Use Import JSON instead.");
    return;
  }

  const [handle] = await window.showOpenFilePicker({
    types: [{ description: "Quote Intake JSON", accept: { "application/json": [".json"] } }],
    multiple: false
  });

  const file = await handle.getFile();
  const text = await file.text();
  const obj = JSON.parse(text);

  fileHandle = handle;
  setFormData(obj);
  toast("Opened");
}

/* ---------- Download/Import fallback ---------- */
function safeFilenameFromCustomer(data) {
  const name = (data?.customer?.name || "intake").trim().replace(/[^\w\- ]+/g, "");
  const date = new Date().toISOString().slice(0, 10);
  return `${name || "intake"}_${date}.json`;
}

function downloadJson() {
  const data = getFormData();
  const text = JSON.stringify(data, null, 2);
  jsonBoxEl.value = text;

  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = safeFilenameFromCustomer(data);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);

  toast("Downloaded JSON");
}

function importFromJsonBox() {
  const raw = (jsonBoxEl.value || "").trim();
  if (!raw) return toast("Paste JSON into the box first");
  try {
    const obj = JSON.parse(raw);
    fileHandle = null; // importing breaks link to any existing file
    setFormData(obj);
    toast("Imported");
  } catch {
    toast("Invalid JSON");
  }
}

/* ---------- New intake ---------- */
function newIntake() {
  fileHandle = null;

  const blank = {
    customer: { name: "", phone: "", email: "" },
    counts: { drivers: 1, vehicles: 1 },
    drivers: [{ name: "", dob: "", licenseState: "", license: "" }],
    vehicles: [{ vin: "", decoded: "—" }],
    meta: { version: 1, updatedAt: new Date().toISOString() }
  };

  setFormData(blank);
  toast("New intake");
}

/* ---------- Event wiring ---------- */
function wireAutosaveListeners() {
  // Any input/select change triggers autosave
  document.addEventListener("input", (e) => {
    if (e.target.matches("input, textarea, select")) {
      scheduleAutosave("Typing...");
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.matches("input, textarea, select")) {
      scheduleAutosave("Changed");
    }
  });
}

function init() {
  populateSelect(driverCountEl, 10, 1);
  populateSelect(vehicleCountEl, 10, 1);

  // Render initial
  renderDrivers(1, []);
  renderVehicles(1, []);

  // Count changes: preserve existing typed data
  driverCountEl.addEventListener("change", (e) => {
    renderDrivers(Number(e.target.value));
    scheduleAutosave("Updated drivers");
  });

  vehicleCountEl.addEventListener("change", (e) => {
    renderVehicles(Number(e.target.value));
    scheduleAutosave("Updated vehicles");
  });

  // Buttons
  btnNew.addEventListener("click", newIntake);
  btnOpen.addEventListener("click", () => openFile().catch(() => toast("Open cancelled")));
  btnSave.addEventListener("click", () => saveFile().catch(() => toast("Save cancelled")));
  btnSaveAs.addEventListener("click", () => saveAsFile().catch(() => toast("Save As cancelled")));
  btnDownload.addEventListener("click", downloadJson);
  btnImport.addEventListener("click", importFromJsonBox);

  // File API availability hint
  if (!fileApiSupported()) {
    saveStatusEl.textContent = "Auto-saved locally (file save limited in this browser)";
  }

  // Load last autosaved draft
  const saved = loadFromLocalStorage();
  if (saved) {
    setFormData(saved);
    toast("Restored last draft (local)");
  } else {
    scheduleAutosave("Auto-saved locally");
  }

  wireAutosaveListeners();
}

init();

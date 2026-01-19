/* =========================
   Quote Intake Tool (app.js)
   - Tabbed interface: Auto, Home, Business
   - Unified state management (customer/auto/home/business)
   - localStorage persistence
   - save/open JSON file (File System Access API + fallback)
========================= */

const STORAGE_KEY = "quote_intake_v2";
const FILE_HANDLE_KEY = "quote_intake_file_handle_v2";

// Customer fields
const custNameEl = document.getElementById("custName");
const custPhoneEl = document.getElementById("custPhone");
const custEmailEl = document.getElementById("custEmail");
const custStreetEl = document.getElementById("custStreet");
const custCityEl = document.getElementById("custCity");
const custStateEl = document.getElementById("custState");
const custZipEl = document.getElementById("custZip");

// Auto tab fields
const driverCountEl = document.getElementById("driverCount");
const vehicleCountEl = document.getElementById("vehicleCount");
const driversEl = document.getElementById("drivers");
const vehiclesEl = document.getElementById("vehicles");

// Tab containers
const panelAutoEl = document.getElementById("panel-auto");
const panelHomeEl = document.getElementById("panel-home");
const panelBusinessEl = document.getElementById("panel-business");
const homeContentEl = document.getElementById("homeContent");
const businessContentEl = document.getElementById("businessContent");
const tabsContainerEl = document.getElementById("tabsContainer");

// JSON and status
const jsonBoxEl = document.getElementById("jsonBox");
const saveStatusEl = document.getElementById("saveStatus");

// Buttons
const btnNew = document.getElementById("btnNew");
const btnOpen = document.getElementById("btnOpen");
const btnSave = document.getElementById("btnSave");
const btnSaveAs = document.getElementById("btnSaveAs");
const btnDownload = document.getElementById("btnDownload");
const btnImport = document.getElementById("btnImport");

const toastEl = document.getElementById("toast");

// Tab buttons will be queried dynamically via event delegation

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"
];

// Global app state - single source of truth
let appState = getDefaultAppState();

/* ---------- Default State ---------- */
function getDefaultAppState() {
  return {
    customer: {
      name: "",
      phone: "",
      email: "",
      address: {
        street: "",
        city: "",
        state: "",
        zip: ""
      }
    },
    auto: {
      driverCount: 1,
      vehicleCount: 1,
      drivers: [],
      vehicles: []
    },
    home: {
      propertyAddress: "",
      city: "",
      state: "",
      zip: "",
      yearBuilt: "",
      squareFeet: "",
      constructionType: "",
      roofType: "",
      roofAge: "",
      numberOfStories: "",
      dwellingCoverage: "",
      deductible: "",
      priorCarrier: "",
      priorCarrierExpiration: "",
      claimsLast5Years: "",
      claimsNotes: "",
      occupancy: "",
      securityAlarms: "",
      hydrantDistance: "",
      fireStationDistance: "",
      mortgageeName: "",
      mortgageeLoanNumber: ""
    },
    business: {
      businessName: "",
      entityType: "",
      taxId: "",
      yearsInBusiness: "",
      naics: "",
      sic: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      workersComp: {
        payrollEstimate: "",
        numberOfEmployees: "",
        classCodes: "",
        priorCarrier: "",
        priorCarrierExpiration: "",
        claims: "",
        claimsNotes: ""
      },
      generalLiability: {
        salesRevenueEstimate: "",
        subcontractorsUsed: "",
        descriptionOfOperations: "",
        priorCarrier: "",
        priorCarrierExpiration: ""
      }
    },
    meta: {
      version: 2,
      updatedAt: new Date().toISOString()
    },
    lastActiveTab: "auto"
  };
}

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

/* ---------- Tab Switching ---------- */
function setActiveTab(tabName) {
  // Validate tab name
  if (!["auto", "home", "business"].includes(tabName)) {
    tabName = "auto";
  }

  // Update tab buttons
  const tabButtons = document.querySelectorAll(".tab[data-tab]");
  tabButtons.forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Hide all panels
  const panels = document.querySelectorAll(".tab-panel");
  panels.forEach(panel => {
    panel.classList.add("hidden");
  });

  // Show target panel
  const targetPanel = document.getElementById(`panel-${tabName}`);
  if (targetPanel) {
    targetPanel.classList.remove("hidden");
  }

  // Save current UI state before switching
  getAppStateFromUI();
  
  // Store active tab in state
  appState.lastActiveTab = tabName;
  saveToLocalStorage();

  // Render the new tab (data is already in appState)
  renderTab(tabName);
}

function renderTab(tabName) {
  if (tabName === "auto") {
    renderAutoTab();
  } else if (tabName === "home") {
    renderHomeTab();
  } else if (tabName === "business") {
    renderBusinessTab();
  }
}

/* ---------- Bind Tab Events (Event Delegation) ---------- */
function bindTabEvents() {
  // Use event delegation on stable parent - works even if tabs are re-rendered
  if (tabsContainerEl) {
    tabsContainerEl.addEventListener("click", (e) => {
      const tabButton = e.target.closest(".tab[data-tab]");
      if (tabButton && tabButton.dataset.tab) {
        e.preventDefault();
        setActiveTab(tabButton.dataset.tab);
      }
    });
  }
}

/* ---------- State Management: Get from UI ---------- */
function getAppStateFromUI() {
  // Customer
  appState.customer = {
    name: custNameEl?.value || "",
    phone: custPhoneEl?.value || "",
    email: custEmailEl?.value || "",
    address: {
      street: custStreetEl?.value || "",
      city: custCityEl?.value || "",
      state: custStateEl?.value || "",
      zip: custZipEl?.value || ""
    }
  };

  // Auto tab (if visible)
  if (panelAutoEl && !panelAutoEl.classList.contains("hidden")) {
    appState.auto.driverCount = Number(driverCountEl.value || 0);
    appState.auto.vehicleCount = Number(vehicleCountEl.value || 0);
    appState.auto.drivers = snapshotDriversFromUI();
    appState.auto.vehicles = snapshotVehiclesFromUI();
  }

  // Home tab (if visible)
  if (panelHomeEl && !panelHomeEl.classList.contains("hidden")) {
    const homeInputs = homeContentEl.querySelectorAll("input, select, textarea");
    homeInputs.forEach(input => {
      const field = input.dataset.field;
      if (field && appState.home.hasOwnProperty(field)) {
        appState.home[field] = input.value || "";
      }
    });
  }

  // Business tab (if visible)
  if (panelBusinessEl && !panelBusinessEl.classList.contains("hidden")) {
    const businessInputs = businessContentEl.querySelectorAll("input, select, textarea");
    businessInputs.forEach(input => {
      const field = input.dataset.field;
      if (field?.startsWith("wc_")) {
        const wcField = field.replace("wc_", "");
        if (appState.business.workersComp.hasOwnProperty(wcField)) {
          appState.business.workersComp[wcField] = input.value || "";
        }
      } else if (field?.startsWith("gl_")) {
        const glField = field.replace("gl_", "");
        if (appState.business.generalLiability.hasOwnProperty(glField)) {
          appState.business.generalLiability[glField] = input.value || "";
        }
      } else if (field && appState.business.hasOwnProperty(field)) {
        appState.business[field] = input.value || "";
      }
    });
  }

  appState.meta.updatedAt = new Date().toISOString();
}

/* ---------- State Management: Apply to UI ---------- */
function applyAppStateToUI(state) {
  if (!state || typeof state !== "object") return;

  // Migrate old format if needed
  state = migrateOldFormat(state);

  // Customer
  if (custNameEl) custNameEl.value = state.customer?.name ?? "";
  if (custPhoneEl) custPhoneEl.value = state.customer?.phone ?? "";
  if (custEmailEl) custEmailEl.value = state.customer?.email ?? "";
  
  // Customer address
  const address = state.customer?.address || {};
  if (custStreetEl) custStreetEl.value = address.street ?? "";
  if (custCityEl) custCityEl.value = address.city ?? "";
  if (custStateEl) {
    custStateEl.value = address.state ?? "";
    // Populate state dropdown if not already done
    if (custStateEl.options.length <= 1) {
      populateStateDropdown(custStateEl, address.state);
    }
  }
  if (custZipEl) custZipEl.value = address.zip ?? "";

  // Auto
  if (state.auto) {
    appState.auto.driverCount = Number(state.auto.driverCount ?? state.counts?.drivers ?? 1);
    appState.auto.vehicleCount = Number(state.auto.vehicleCount ?? state.counts?.vehicles ?? 1);
    appState.auto.drivers = state.auto.drivers || state.drivers || [];
    appState.auto.vehicles = state.auto.vehicles || state.vehicles || [];
  }

  // Home
  if (state.home) {
    Object.keys(state.home).forEach(key => {
      if (appState.home.hasOwnProperty(key)) {
        appState.home[key] = state.home[key] ?? "";
      }
    });
  }

  // Business
  if (state.business) {
    Object.keys(state.business).forEach(key => {
      if (key === "workersComp" && state.business.workersComp) {
        Object.keys(state.business.workersComp).forEach(wcKey => {
          if (appState.business.workersComp.hasOwnProperty(wcKey)) {
            appState.business.workersComp[wcKey] = state.business.workersComp[wcKey] ?? "";
          }
        });
      } else if (key === "generalLiability" && state.business.generalLiability) {
        Object.keys(state.business.generalLiability).forEach(glKey => {
          if (appState.business.generalLiability.hasOwnProperty(glKey)) {
            appState.business.generalLiability[glKey] = state.business.generalLiability[glKey] ?? "";
          }
        });
      } else if (appState.business.hasOwnProperty(key)) {
        appState.business[key] = state.business[key] ?? "";
      }
    });
  }

  // Restore last active tab or default to auto
  const activeTab = state.lastActiveTab || "auto";
  setActiveTab(activeTab);
}

/* ---------- Populate State Dropdown ---------- */
function populateStateDropdown(selectEl, selectedValue = "") {
  if (!selectEl || selectEl.options.length > 1) return; // Already populated
  selectEl.innerHTML = '<option value="">—</option>';
  US_STATES.forEach(state => {
    const option = document.createElement("option");
    option.value = state;
    option.textContent = state;
    if (state === selectedValue) option.selected = true;
    selectEl.appendChild(option);
  });
}

/* ---------- Backwards Compatibility: Migrate Old Format ---------- */
function migrateOldFormat(data) {
  // If it's old format (has counts/drivers/vehicles at root)
  if (data.counts || (data.drivers && !data.auto)) {
    const defaultState = getDefaultAppState();
    return {
      customer: {
        ...defaultState.customer,
        ...(data.customer || {})
      },
      auto: {
        driverCount: data.counts?.drivers ?? data.drivers?.length ?? 1,
        vehicleCount: data.counts?.vehicles ?? data.vehicles?.length ?? 1,
        drivers: data.drivers || [],
        vehicles: data.vehicles || []
      },
      home: defaultState.home,
      business: defaultState.business,
      meta: { version: 2, updatedAt: new Date().toISOString() },
      lastActiveTab: data.lastActiveTab || "auto"
    };
  }
  
  // Ensure customer.address exists in migrated data
  if (data.customer && !data.customer.address) {
    data.customer.address = getDefaultAppState().customer.address;
  }
  
  // Ensure lastActiveTab exists
  if (!data.lastActiveTab) {
    data.lastActiveTab = "auto";
  }
  
  return data;
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

/* ---------- Snapshot Auto Data from UI ---------- */
function snapshotDriversFromUI() {
  const cards = [...driversEl.querySelectorAll(".card[data-driver-index]")];
  return cards.map(card => ({
    name: card.querySelector('[data-field="name"]')?.value || "",
    dob: card.querySelector('[data-field="dob"]')?.value || "",
    licenseState: card.querySelector('[data-field="licenseState"]')?.value || "",
    license: card.querySelector('[data-field="license"]')?.value || ""
  }));
}

function snapshotVehiclesFromUI() {
  const cards = [...vehiclesEl.querySelectorAll(".card[data-vehicle-index]")];
  return cards.map(card => ({
    vin: sanitizeVin(card.querySelector('[data-field="vin"]')?.value || ""),
    decoded: card.querySelector('[data-field="decoded"]')?.textContent || "—"
  }));
}

/* ---------- Render Auto Tab ---------- */
function renderAutoTab() {
  const state = appState.auto;
  
  driverCountEl.value = String(state.driverCount);
  vehicleCountEl.value = String(state.vehicleCount);

  renderDrivers(state.driverCount, state.drivers || []);
  renderVehicles(state.vehicleCount, state.vehicles || []);
}

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

  vinInput.addEventListener("blur", async () => {
    const vin = sanitizeVin(vinInput.value);
    if (vin.length === 17) await doDecode();
  });

  return div;
}

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

/* ---------- Render Home Tab ---------- */
function renderHomeTab() {
  const state = appState.home;
  
  homeContentEl.innerHTML = `
    <div class="card">
      <div class="card-header">
        <strong>Property Information</strong>
      </div>
      
      <div class="row">
        <div class="field" style="flex: 2;">
          <label>Property Address</label>
          <input data-field="propertyAddress" value="${state.propertyAddress || ""}" autocomplete="off">
        </div>
        <div class="field">
          <label>City</label>
          <input data-field="city" value="${state.city || ""}" autocomplete="off">
        </div>
        <div class="field">
          <label>State</label>
          <select data-field="state">
            <option value="">—</option>
            ${stateOptionsHtml(state.state || "")}
          </select>
        </div>
        <div class="field">
          <label>ZIP</label>
          <input data-field="zip" value="${state.zip || ""}" autocomplete="off" maxlength="10">
        </div>
      </div>

      <div class="row" style="margin-top: 12px">
        <div class="field">
          <label>Year Built</label>
          <input data-field="yearBuilt" type="number" value="${state.yearBuilt || ""}" min="1800" max="2100">
        </div>
        <div class="field">
          <label>Square Feet</label>
          <input data-field="squareFeet" type="number" value="${state.squareFeet || ""}" min="0">
        </div>
        <div class="field">
          <label>Construction Type</label>
          <select data-field="constructionType">
            <option value="">—</option>
            <option value="Frame" ${state.constructionType === "Frame" ? "selected" : ""}>Frame</option>
            <option value="Brick" ${state.constructionType === "Brick" ? "selected" : ""}>Brick</option>
            <option value="Stucco" ${state.constructionType === "Stucco" ? "selected" : ""}>Stucco</option>
            <option value="Stone" ${state.constructionType === "Stone" ? "selected" : ""}>Stone</option>
            <option value="Concrete Block" ${state.constructionType === "Concrete Block" ? "selected" : ""}>Concrete Block</option>
            <option value="Other" ${state.constructionType === "Other" ? "selected" : ""}>Other</option>
          </select>
        </div>
        <div class="field">
          <label>Number of Stories</label>
          <input data-field="numberOfStories" type="number" value="${state.numberOfStories || ""}" min="1" max="10">
        </div>
      </div>

      <div class="row" style="margin-top: 12px">
        <div class="field">
          <label>Roof Type</label>
          <select data-field="roofType">
            <option value="">—</option>
            <option value="Asphalt Shingle" ${state.roofType === "Asphalt Shingle" ? "selected" : ""}>Asphalt Shingle</option>
            <option value="Metal" ${state.roofType === "Metal" ? "selected" : ""}>Metal</option>
            <option value="Tile" ${state.roofType === "Tile" ? "selected" : ""}>Tile</option>
            <option value="Wood Shake" ${state.roofType === "Wood Shake" ? "selected" : ""}>Wood Shake</option>
            <option value="Slate" ${state.roofType === "Slate" ? "selected" : ""}>Slate</option>
            <option value="Other" ${state.roofType === "Other" ? "selected" : ""}>Other</option>
          </select>
        </div>
        <div class="field">
          <label>Roof Age (years)</label>
          <input data-field="roofAge" type="number" value="${state.roofAge || ""}" min="0" max="100">
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 12px">
      <div class="card-header">
        <strong>Coverage & Prior Policy</strong>
      </div>

      <div class="row">
        <div class="field">
          <label>Dwelling Coverage (A)</label>
          <input data-field="dwellingCoverage" type="number" value="${state.dwellingCoverage || ""}" min="0" placeholder="$">
        </div>
        <div class="field">
          <label>Deductible</label>
          <input data-field="deductible" type="number" value="${state.deductible || ""}" min="0" placeholder="$">
        </div>
        <div class="field">
          <label>Prior Carrier</label>
          <input data-field="priorCarrier" value="${state.priorCarrier || ""}" autocomplete="off">
        </div>
        <div class="field">
          <label>Prior Carrier Expiration</label>
          <input data-field="priorCarrierExpiration" type="date" value="${state.priorCarrierExpiration || ""}">
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 12px">
      <div class="card-header">
        <strong>Additional Information</strong>
      </div>

      <div class="row">
        <div class="field">
          <label>Claims in Last 5 Years</label>
          <select data-field="claimsLast5Years">
            <option value="">—</option>
            <option value="Yes" ${state.claimsLast5Years === "Yes" ? "selected" : ""}>Yes</option>
            <option value="No" ${state.claimsLast5Years === "No" ? "selected" : ""}>No</option>
          </select>
        </div>
        <div class="field">
          <label>Occupancy</label>
          <select data-field="occupancy">
            <option value="">—</option>
            <option value="Primary" ${state.occupancy === "Primary" ? "selected" : ""}>Primary</option>
            <option value="Secondary" ${state.occupancy === "Secondary" ? "selected" : ""}>Secondary</option>
            <option value="Rental" ${state.occupancy === "Rental" ? "selected" : ""}>Rental</option>
          </select>
        </div>
        <div class="field">
          <label>Security Alarms</label>
          <input data-field="securityAlarms" value="${state.securityAlarms || ""}" autocomplete="off" placeholder="e.g., Smoke, Burglar">
        </div>
      </div>

      <div class="row" style="margin-top: 12px">
        <div class="field">
          <label>Hydrant Distance (miles)</label>
          <input data-field="hydrantDistance" type="number" value="${state.hydrantDistance || ""}" min="0" step="0.1">
        </div>
        <div class="field">
          <label>Fire Station Distance (miles)</label>
          <input data-field="fireStationDistance" type="number" value="${state.fireStationDistance || ""}" min="0" step="0.1">
        </div>
      </div>

      <div class="row" style="margin-top: 12px">
        <div class="field" style="flex: 1">
          <label>Claims Notes</label>
          <textarea data-field="claimsNotes" placeholder="Details about claims...">${state.claimsNotes || ""}</textarea>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 12px">
      <div class="card-header">
        <strong>Mortgagee Information</strong>
        <div class="actions">
          <button type="button" data-action="copyLoanNumber">Copy Loan #</button>
        </div>
      </div>

      <div class="row">
        <div class="field" style="flex: 2">
          <label>Mortgagee Name</label>
          <input data-field="mortgageeName" value="${state.mortgageeName || ""}" autocomplete="off">
        </div>
        <div class="field" style="flex: 1">
          <label>Loan Number</label>
          <input data-field="mortgageeLoanNumber" value="${state.mortgageeLoanNumber || ""}" autocomplete="off">
        </div>
      </div>
    </div>
  `;

  // Wire up copy buttons
  homeContentEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "copyLoanNumber") {
      const loanNum = homeContentEl.querySelector('[data-field="mortgageeLoanNumber"]')?.value || "";
      copy(loanNum);
    }
  });
}

/* ---------- Render Business Tab ---------- */
function renderBusinessTab() {
  const state = appState.business;
  const wc = state.workersComp;
  const gl = state.generalLiability;
  
  businessContentEl.innerHTML = `
    <div class="card">
      <div class="card-header">
        <strong>Business Information</strong>
        <div class="actions">
          <button type="button" data-action="copyTaxId">Copy Tax ID (EIN)</button>
        </div>
      </div>

      <div class="row">
        <div class="field" style="flex: 2">
          <label>Business Name</label>
          <input data-field="businessName" value="${state.businessName || ""}" autocomplete="off">
        </div>
        <div class="field">
          <label>Entity Type</label>
          <select data-field="entityType">
            <option value="">—</option>
            <option value="LLC" ${state.entityType === "LLC" ? "selected" : ""}>LLC</option>
            <option value="S-Corp" ${state.entityType === "S-Corp" ? "selected" : ""}>S-Corp</option>
            <option value="C-Corp" ${state.entityType === "C-Corp" ? "selected" : ""}>C-Corp</option>
            <option value="Sole Prop" ${state.entityType === "Sole Prop" ? "selected" : ""}>Sole Prop</option>
            <option value="Partnership" ${state.entityType === "Partnership" ? "selected" : ""}>Partnership</option>
          </select>
        </div>
        <div class="field">
          <label>Tax ID (EIN)</label>
          <input data-field="taxId" value="${state.taxId || ""}" autocomplete="off" placeholder="XX-XXXXXXX">
        </div>
        <div class="field">
          <label>Years in Business</label>
          <input data-field="yearsInBusiness" type="number" value="${state.yearsInBusiness || ""}" min="0">
        </div>
      </div>

      <div class="row" style="margin-top: 12px">
        <div class="field">
          <label>NAICS Code</label>
          <input data-field="naics" value="${state.naics || ""}" autocomplete="off">
        </div>
        <div class="field">
          <label>SIC Code</label>
          <input data-field="sic" value="${state.sic || ""}" autocomplete="off">
        </div>
      </div>

      <div class="row" style="margin-top: 12px">
        <div class="field" style="flex: 2">
          <label>Business Address</label>
          <input data-field="address" value="${state.address || ""}" autocomplete="off">
        </div>
        <div class="field">
          <label>City</label>
          <input data-field="city" value="${state.city || ""}" autocomplete="off">
        </div>
        <div class="field">
          <label>State</label>
          <select data-field="state">
            <option value="">—</option>
            ${stateOptionsHtml(state.state || "")}
          </select>
        </div>
        <div class="field">
          <label>ZIP</label>
          <input data-field="zip" value="${state.zip || ""}" autocomplete="off" maxlength="10">
        </div>
      </div>

      <div class="row" style="margin-top: 12px">
        <div class="field">
          <label>Contact Name</label>
          <input data-field="contactName" value="${state.contactName || ""}" autocomplete="off">
        </div>
        <div class="field">
          <label>Contact Phone</label>
          <input data-field="contactPhone" value="${state.contactPhone || ""}" autocomplete="off">
        </div>
        <div class="field">
          <label>Contact Email</label>
          <input data-field="contactEmail" type="email" value="${state.contactEmail || ""}" autocomplete="off">
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 12px">
      <div class="card-header">
        <strong>Workers Compensation</strong>
      </div>

      <div class="row">
        <div class="field">
          <label>Annual Payroll Estimate</label>
          <input data-field="wc_payrollEstimate" type="number" value="${wc.payrollEstimate || ""}" min="0" placeholder="$">
        </div>
        <div class="field">
          <label>Number of Employees</label>
          <input data-field="wc_numberOfEmployees" type="number" value="${wc.numberOfEmployees || ""}" min="0">
        </div>
        <div class="field" style="flex: 2">
          <label>Class Codes</label>
          <input data-field="wc_classCodes" value="${wc.classCodes || ""}" autocomplete="off" placeholder="e.g., 8810, 8018">
        </div>
      </div>

      <div class="row" style="margin-top: 12px">
        <div class="field">
          <label>Prior Carrier</label>
          <input data-field="wc_priorCarrier" value="${wc.priorCarrier || ""}" autocomplete="off">
        </div>
        <div class="field">
          <label>Prior Carrier Expiration</label>
          <input data-field="wc_priorCarrierExpiration" type="date" value="${wc.priorCarrierExpiration || ""}">
        </div>
        <div class="field">
          <label>Claims</label>
          <select data-field="wc_claims">
            <option value="">—</option>
            <option value="Yes" ${wc.claims === "Yes" ? "selected" : ""}>Yes</option>
            <option value="No" ${wc.claims === "No" ? "selected" : ""}>No</option>
          </select>
        </div>
      </div>

      <div class="row" style="margin-top: 12px">
        <div class="field" style="flex: 1">
          <label>Claims Notes</label>
          <textarea data-field="wc_claimsNotes" placeholder="Details about workers comp claims...">${wc.claimsNotes || ""}</textarea>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 12px">
      <div class="card-header">
        <strong>General Liability</strong>
      </div>

      <div class="row">
        <div class="field">
          <label>Annual Sales/Revenue Estimate</label>
          <input data-field="gl_salesRevenueEstimate" type="number" value="${gl.salesRevenueEstimate || ""}" min="0" placeholder="$">
        </div>
        <div class="field">
          <label>Subcontractors Used</label>
          <select data-field="gl_subcontractorsUsed">
            <option value="">—</option>
            <option value="Yes" ${gl.subcontractorsUsed === "Yes" ? "selected" : ""}>Yes</option>
            <option value="No" ${gl.subcontractorsUsed === "No" ? "selected" : ""}>No</option>
          </select>
        </div>
      </div>

      <div class="row" style="margin-top: 12px">
        <div class="field" style="flex: 1">
          <label>Description of Operations</label>
          <textarea data-field="gl_descriptionOfOperations" placeholder="Describe what the business does...">${gl.descriptionOfOperations || ""}</textarea>
        </div>
      </div>

      <div class="row" style="margin-top: 12px">
        <div class="field">
          <label>Prior Carrier</label>
          <input data-field="gl_priorCarrier" value="${gl.priorCarrier || ""}" autocomplete="off">
        </div>
        <div class="field">
          <label>Prior Carrier Expiration</label>
          <input data-field="gl_priorCarrierExpiration" type="date" value="${gl.priorCarrierExpiration || ""}">
        </div>
      </div>
    </div>
  `;

  // Wire up copy buttons
  businessContentEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "copyTaxId") {
      const taxId = businessContentEl.querySelector('[data-field="taxId"]')?.value || "";
      copy(taxId);
    }
  });
}

/* ---------- localStorage persistence ---------- */
let autosaveTimer = null;

function scheduleAutosave(statusText = "Auto-saved locally") {
  saveStatusEl.textContent = statusText;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    getAppStateFromUI();
    saveToLocalStorage();
    saveStatusEl.textContent = "Auto-saved locally";
  }, 150);
}

function saveToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function loadFromLocalStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return migrateOldFormat(parsed);
  } catch {
    return null;
  }
}

/* ---------- JSON Export/Import ---------- */
function exportJSON() {
  getAppStateFromUI();
  return JSON.parse(JSON.stringify(appState)); // Deep clone
}

function importJSON(data) {
  const migrated = migrateOldFormat(data);
  // Merge into appState
  Object.assign(appState, migrated);
  // Ensure nested objects exist
  if (!appState.home) appState.home = getDefaultAppState().home;
  if (!appState.business) appState.business = getDefaultAppState().business;
  if (!appState.business.workersComp) appState.business.workersComp = getDefaultAppState().business.workersComp;
  if (!appState.business.generalLiability) appState.business.generalLiability = getDefaultAppState().business.generalLiability;
  applyAppStateToUI(appState);
}

/* ---------- File Save/Open ---------- */
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
  getAppStateFromUI();
  const data = exportJSON();

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
  if (!fileApiSupported()) {
    toast("File save not supported here. Use Download JSON instead.");
    return;
  }

  if (!fileHandle) {
    await saveAsFile();
    return;
  }

  getAppStateFromUI();
  const data = exportJSON();
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
  importJSON(obj);
  toast("Opened");
}

function safeFilenameFromCustomer(data) {
  const name = (data?.customer?.name || "intake").trim().replace(/[^\w\- ]+/g, "");
  const date = new Date().toISOString().slice(0, 10);
  return `${name || "intake"}_${date}.json`;
}

function downloadJson() {
  getAppStateFromUI();
  const data = exportJSON();
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
    fileHandle = null;
    importJSON(obj);
    toast("Imported");
  } catch {
    toast("Invalid JSON");
  }
}

/* ---------- New intake ---------- */
function newIntake() {
  fileHandle = null;
  appState = getDefaultAppState();
  applyAppStateToUI(appState);
  toast("New intake");
}

/* ---------- Event wiring ---------- */
function wireAutosaveListeners() {
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
  // Populate state dropdown for customer address
  populateStateDropdown(custStateEl);
  
  populateSelect(driverCountEl, 10, 1);
  populateSelect(vehicleCountEl, 10, 1);

  // Bind tab events using event delegation (once, stable)
  bindTabEvents();

  // Auto count changes
  driverCountEl.addEventListener("change", (e) => {
    getAppStateFromUI();
    appState.auto.driverCount = Number(e.target.value);
    renderDrivers(appState.auto.driverCount, appState.auto.drivers);
    scheduleAutosave("Updated drivers");
  });

  vehicleCountEl.addEventListener("change", (e) => {
    getAppStateFromUI();
    appState.auto.vehicleCount = Number(e.target.value);
    renderVehicles(appState.auto.vehicleCount, appState.auto.vehicles);
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
    importJSON(saved);
    toast("Restored last draft (local)");
  } else {
    // Default to auto tab
    setActiveTab("auto");
    scheduleAutosave("Auto-saved locally");
  }

  wireAutosaveListeners();
}

init();

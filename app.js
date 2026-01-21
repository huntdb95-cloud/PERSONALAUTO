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
const btnImportFile = document.getElementById("btnImportFile");
const btnImport = document.getElementById("btnImport");
const fileImportEl = document.getElementById("fileImport");

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
    meta: {
      version: 1,
      updatedAt: new Date().toISOString()
    },
    lastActiveTab: "auto",
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
      counts: {
        drivers: 0,
        vehicles: 0
      },
      drivers: [],
      vehicles: []
    },
    home: {
      propertyAddress: {
        street: "",
        city: "",
        state: "",
        zip: ""
      },
      yearBuilt: "",
      squareFeet: "",
      constructionType: "",
      roofType: "",
      roofAge: "",
      stories: "",
      dwellingCoverageA: "",
      deductible: "",
      priorCarrier: "",
      expirationDate: "",
      claimsLast5Years: "",
      claimsNotes: "",
      occupancy: "",
      securityNotes: "",
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
      address: {
        street: "",
        city: "",
        state: "",
        zip: ""
      },
      contact: {
        name: "",
        phone: "",
        email: ""
      },
      workersComp: {
        payrollEstimate: "",
        numEmployees: "",
        classCodes: "",
        priorCarrier: "",
        expirationDate: "",
        claims: "",
        claimsNotes: ""
      },
      generalLiability: {
        salesEstimate: "",
        subcontractorsUsed: "",
        operationsDescription: "",
        priorCarrier: "",
        expirationDate: ""
      }
    }
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
    appState.auto.counts.drivers = Number(driverCountEl?.value || 0);
    appState.auto.counts.vehicles = Number(vehicleCountEl?.value || 0);
    appState.auto.drivers = snapshotDriversFromUI();
    appState.auto.vehicles = snapshotVehiclesFromUI();
  }

  // Home tab (if visible)
  if (panelHomeEl && !panelHomeEl.classList.contains("hidden")) {
    const homeInputs = homeContentEl.querySelectorAll("input, select, textarea");
    homeInputs.forEach(input => {
      const field = input.dataset.field;
      if (!field) return;
      
      // Handle propertyAddress nested fields
      if (field === "propertyStreet") {
        appState.home.propertyAddress.street = input.value || "";
      } else if (field === "propertyCity") {
        appState.home.propertyAddress.city = input.value || "";
      } else if (field === "propertyState") {
        appState.home.propertyAddress.state = input.value || "";
      } else if (field === "propertyZip") {
        appState.home.propertyAddress.zip = input.value || "";
      } else if (appState.home.hasOwnProperty(field)) {
        appState.home[field] = input.value || "";
      }
    });
  }

  // Business tab (if visible)
  if (panelBusinessEl && !panelBusinessEl.classList.contains("hidden")) {
    const businessInputs = businessContentEl.querySelectorAll("input, select, textarea");
    businessInputs.forEach(input => {
      const field = input.dataset.field;
      if (!field) return;
      
      // Handle address nested fields
      if (field === "businessStreet") {
        appState.business.address.street = input.value || "";
      } else if (field === "businessCity") {
        appState.business.address.city = input.value || "";
      } else if (field === "businessState") {
        appState.business.address.state = input.value || "";
      } else if (field === "businessZip") {
        appState.business.address.zip = input.value || "";
      } else if (field === "contactName") {
        appState.business.contact.name = input.value || "";
      } else if (field === "contactPhone") {
        appState.business.contact.phone = input.value || "";
      } else if (field === "contactEmail") {
        appState.business.contact.email = input.value || "";
        } else if (field?.startsWith("wc_")) {
        const wcField = field.replace("wc_", "");
        // Map old field names to new schema
        const mappedField = wcField === "numberOfEmployees" ? "numEmployees" :
                           wcField === "priorCarrierExpiration" ? "expirationDate" : wcField;
        if (appState.business.workersComp.hasOwnProperty(mappedField)) {
          appState.business.workersComp[mappedField] = input.value || "";
        }
      } else if (field?.startsWith("gl_")) {
        const glField = field.replace("gl_", "");
        // Map old field names to new schema
        const mappedField = glField === "salesRevenueEstimate" ? "salesEstimate" :
                           glField === "descriptionOfOperations" ? "operationsDescription" :
                           glField === "priorCarrierExpiration" ? "expirationDate" : glField;
        if (appState.business.generalLiability.hasOwnProperty(mappedField)) {
          appState.business.generalLiability[mappedField] = input.value || "";
        }
      } else if (appState.business.hasOwnProperty(field)) {
        appState.business[field] = input.value || "";
      }
    });
  }

  appState.meta.updatedAt = new Date().toISOString();
}

/* ---------- State Management: Apply to UI ---------- */
function applyAppStateToUI(state) {
  if (!state || typeof state !== "object") return;

  // Normalize imported state first
  const normalizedState = normalizeImportedState(state);
  
  // Update appState from normalized state
  appState = normalizedState;

  // Customer
  if (custNameEl) custNameEl.value = appState.customer.name || "";
  if (custPhoneEl) custPhoneEl.value = appState.customer.phone || "";
  if (custEmailEl) custEmailEl.value = appState.customer.email || "";
  
  // Customer address
  const customerAddress = appState.customer.address || {};
  if (custStreetEl) custStreetEl.value = customerAddress.street || "";
  if (custCityEl) custCityEl.value = customerAddress.city || "";
  if (custStateEl) {
    custStateEl.value = customerAddress.state || "";
    // Populate state dropdown if not already done
    if (custStateEl.options.length <= 1) {
      populateStateDropdown(custStateEl, customerAddress.state);
    }
  }
  if (custZipEl) custZipEl.value = customerAddress.zip || "";

  // Auto: Set counts and render with seed arrays
  const driverCount = appState.auto.counts.drivers || 0;
  const vehicleCount = appState.auto.counts.vehicles || 0;
  
  if (driverCountEl) driverCountEl.value = String(driverCount);
  if (vehicleCountEl) vehicleCountEl.value = String(vehicleCount);
  
  // Render drivers/vehicles using seed arrays from state (NOT from UI)
  renderDrivers(driverCount, appState.auto.drivers || []);
  renderVehicles(vehicleCount, appState.auto.vehicles || []);

  // Home: Render home tab (will set all fields from state)
  renderHomeTab();

  // Business: Render business tab (will set all fields from state)
  renderBusinessTab();

  // Restore last active tab or default to auto
  const activeTab = appState.lastActiveTab || "auto";
  setActiveTab(activeTab);
}

/* ---------- Set App State and Refresh UI ---------- */
function setAppStateAndRefresh(state) {
  applyAppStateToUI(state);
  saveToLocalStorage();
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

/* ---------- Normalize Imported State ---------- */
function normalizeImportedState(importedObj) {
  if (!importedObj || typeof importedObj !== "object") {
    return getDefaultAppState();
  }

  const defaultState = getDefaultAppState();
  const normalized = JSON.parse(JSON.stringify(defaultState)); // Deep clone defaults

  // Merge imported data, preserving structure
  if (importedObj.customer) {
    normalized.customer = {
      name: importedObj.customer.name ?? normalized.customer.name,
      phone: importedObj.customer.phone ?? normalized.customer.phone,
      email: importedObj.customer.email ?? normalized.customer.email,
      address: {
        street: importedObj.customer.address?.street ?? normalized.customer.address.street,
        city: importedObj.customer.address?.city ?? normalized.customer.address.city,
        state: importedObj.customer.address?.state ?? normalized.customer.address.state,
        zip: importedObj.customer.address?.zip ?? normalized.customer.address.zip
      }
    };
  }

  // Auto: handle old format migration
  if (importedObj.auto) {
    normalized.auto = {
      counts: {
        drivers: importedObj.auto.counts?.drivers ?? importedObj.auto.driverCount ?? importedObj.counts?.drivers ?? (importedObj.auto.drivers?.length ?? 0),
        vehicles: importedObj.auto.counts?.vehicles ?? importedObj.auto.vehicleCount ?? importedObj.counts?.vehicles ?? (importedObj.auto.vehicles?.length ?? 0)
      },
      drivers: importedObj.auto.drivers ?? importedObj.drivers ?? [],
      vehicles: importedObj.auto.vehicles ?? importedObj.vehicles ?? []
    };
  } else if (importedObj.counts || importedObj.drivers) {
    // Old format: counts/drivers/vehicles at root
    normalized.auto = {
      counts: {
        drivers: importedObj.counts?.drivers ?? importedObj.drivers?.length ?? 0,
        vehicles: importedObj.counts?.vehicles ?? importedObj.vehicles?.length ?? 0
      },
      drivers: importedObj.drivers ?? [],
      vehicles: importedObj.vehicles ?? []
    };
  }

  // Home: handle flat structure migration
  if (importedObj.home) {
    const home = importedObj.home;
    normalized.home = {
      propertyAddress: {
        street: home.propertyAddress?.street ?? home.propertyAddress ?? normalized.home.propertyAddress.street,
        city: home.propertyAddress?.city ?? home.city ?? normalized.home.propertyAddress.city,
        state: home.propertyAddress?.state ?? home.state ?? normalized.home.propertyAddress.state,
        zip: home.propertyAddress?.zip ?? home.zip ?? normalized.home.propertyAddress.zip
      },
      yearBuilt: home.yearBuilt ?? normalized.home.yearBuilt,
      squareFeet: home.squareFeet ?? normalized.home.squareFeet,
      constructionType: home.constructionType ?? normalized.home.constructionType,
      roofType: home.roofType ?? normalized.home.roofType,
      roofAge: home.roofAge ?? normalized.home.roofAge,
      stories: home.stories ?? home.numberOfStories ?? normalized.home.stories,
      dwellingCoverageA: home.dwellingCoverageA ?? home.dwellingCoverage ?? normalized.home.dwellingCoverageA,
      deductible: home.deductible ?? normalized.home.deductible,
      priorCarrier: home.priorCarrier ?? normalized.home.priorCarrier,
      expirationDate: home.expirationDate ?? home.priorCarrierExpiration ?? normalized.home.expirationDate,
      claimsLast5Years: home.claimsLast5Years ?? normalized.home.claimsLast5Years,
      claimsNotes: home.claimsNotes ?? normalized.home.claimsNotes,
      occupancy: home.occupancy ?? normalized.home.occupancy,
      securityNotes: home.securityNotes ?? home.securityAlarms ?? normalized.home.securityNotes,
      mortgageeName: home.mortgageeName ?? normalized.home.mortgageeName,
      mortgageeLoanNumber: home.mortgageeLoanNumber ?? normalized.home.mortgageeLoanNumber
    };
  }

  // Business: handle flat structure migration
  if (importedObj.business) {
    const biz = importedObj.business;
    normalized.business = {
      businessName: biz.businessName ?? normalized.business.businessName,
      entityType: biz.entityType ?? normalized.business.entityType,
      taxId: biz.taxId ?? normalized.business.taxId,
      yearsInBusiness: biz.yearsInBusiness ?? normalized.business.yearsInBusiness,
      naics: biz.naics ?? normalized.business.naics,
      sic: biz.sic ?? normalized.business.sic,
      address: {
        street: biz.address?.street ?? (typeof biz.address === "string" ? biz.address : "") ?? normalized.business.address.street,
        city: biz.address?.city ?? biz.city ?? normalized.business.address.city,
        state: biz.address?.state ?? biz.state ?? normalized.business.address.state,
        zip: biz.address?.zip ?? biz.zip ?? normalized.business.address.zip
      },
      contact: {
        name: biz.contact?.name ?? biz.contactName ?? normalized.business.contact.name,
        phone: biz.contact?.phone ?? biz.contactPhone ?? normalized.business.contact.phone,
        email: biz.contact?.email ?? biz.contactEmail ?? normalized.business.contact.email
      },
      workersComp: {
        payrollEstimate: biz.workersComp?.payrollEstimate ?? biz.workersComp?.payroll ?? normalized.business.workersComp.payrollEstimate,
        numEmployees: biz.workersComp?.numEmployees ?? biz.workersComp?.numberOfEmployees ?? normalized.business.workersComp.numEmployees,
        classCodes: biz.workersComp?.classCodes ?? normalized.business.workersComp.classCodes,
        priorCarrier: biz.workersComp?.priorCarrier ?? normalized.business.workersComp.priorCarrier,
        expirationDate: biz.workersComp?.expirationDate ?? biz.workersComp?.priorCarrierExpiration ?? normalized.business.workersComp.expirationDate,
        claims: biz.workersComp?.claims ?? normalized.business.workersComp.claims,
        claimsNotes: biz.workersComp?.claimsNotes ?? normalized.business.workersComp.claimsNotes
      },
      generalLiability: {
        salesEstimate: biz.generalLiability?.salesEstimate ?? biz.generalLiability?.salesRevenueEstimate ?? normalized.business.generalLiability.salesEstimate,
        subcontractorsUsed: biz.generalLiability?.subcontractorsUsed ?? normalized.business.generalLiability.subcontractorsUsed,
        operationsDescription: biz.generalLiability?.operationsDescription ?? biz.generalLiability?.descriptionOfOperations ?? normalized.business.generalLiability.operationsDescription,
        priorCarrier: biz.generalLiability?.priorCarrier ?? normalized.business.generalLiability.priorCarrier,
        expirationDate: biz.generalLiability?.expirationDate ?? biz.generalLiability?.priorCarrierExpiration ?? normalized.business.generalLiability.expirationDate
      }
    };
  }

  // Meta and lastActiveTab
  normalized.lastActiveTab = importedObj.lastActiveTab ?? "auto";
  normalized.meta.updatedAt = new Date().toISOString();

  return normalized;
}

/* ---------- Backwards Compatibility: Migrate Old Format ---------- */
function migrateOldFormat(data) {
  return normalizeImportedState(data);
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
  const state = appState.auto || {};
  const driverCount = Number(state.counts?.drivers ?? state.driverCount ?? 0) || 0;
  const vehicleCount = Number(state.counts?.vehicles ?? state.vehicleCount ?? 0) || 0;

  if (!state.counts) state.counts = { drivers: 0, vehicles: 0 };
  state.counts.drivers = driverCount;
  state.counts.vehicles = vehicleCount;

  if (driverCountEl) driverCountEl.value = String(driverCount);
  if (vehicleCountEl) vehicleCountEl.value = String(vehicleCount);

  renderDrivers(driverCount, state.drivers || []);
  renderVehicles(vehicleCount, state.vehicles || []);
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
  const propAddr = state.propertyAddress || {};
  
  homeContentEl.innerHTML = `
    <div class="card">
      <div class="card-header">
        <strong>Property Information</strong>
      </div>
      
      <div class="row">
        <div class="field" style="flex: 2;">
          <label>Property Address</label>
          <input data-field="propertyStreet" value="${propAddr.street || ""}" autocomplete="street-address">
        </div>
        <div class="field">
          <label>City</label>
          <input data-field="propertyCity" value="${propAddr.city || ""}" autocomplete="address-level2">
        </div>
        <div class="field">
          <label>State</label>
          <select data-field="propertyState">
            <option value="">—</option>
            ${stateOptionsHtml(propAddr.state || "")}
          </select>
        </div>
        <div class="field">
          <label>ZIP</label>
          <input data-field="propertyZip" value="${propAddr.zip || ""}" autocomplete="postal-code" maxlength="10">
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
        <input data-field="stories" type="number" value="${state.stories || ""}" min="1" max="10">
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
          <input data-field="dwellingCoverageA" type="number" value="${state.dwellingCoverageA || ""}" min="0" placeholder="$">
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
          <input data-field="expirationDate" type="date" value="${state.expirationDate || ""}">
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
          <label>Security Notes</label>
          <input data-field="securityNotes" value="${state.securityNotes || ""}" autocomplete="off" placeholder="e.g., Smoke, Burglar">
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
  if (!businessContentEl) {
    console.error("businessContentEl element not found");
    return;
  }
  
  const state = appState.business || {};
  const wc = state.workersComp || {};
  const gl = state.generalLiability || {};
  const bizAddr = state.address || {};
  const contact = state.contact || {};
  
  businessContentEl.innerHTML = `
    <div class="card">
      <div class="card-header">
        <strong>Business Information</strong>
        <div class="actions">
          <button type="button" data-action="copyTaxId">Copy EIN</button>
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
          <input data-field="businessStreet" value="${bizAddr.street || ""}" autocomplete="street-address">
        </div>
        <div class="field">
          <label>City</label>
          <input data-field="businessCity" value="${bizAddr.city || ""}" autocomplete="address-level2">
        </div>
        <div class="field">
          <label>State</label>
          <select data-field="businessState">
            <option value="">—</option>
            ${stateOptionsHtml(bizAddr.state || "")}
          </select>
        </div>
        <div class="field">
          <label>ZIP</label>
          <input data-field="businessZip" value="${bizAddr.zip || ""}" autocomplete="postal-code" maxlength="10">
        </div>
      </div>

      <div class="row" style="margin-top: 12px">
        <div class="field">
          <label>Contact Name</label>
          <input data-field="contactName" value="${contact.name || ""}" autocomplete="off">
        </div>
        <div class="field">
          <label>Contact Phone</label>
          <input data-field="contactPhone" value="${contact.phone || ""}" autocomplete="off">
        </div>
        <div class="field">
          <label>Contact Email</label>
          <input data-field="contactEmail" type="email" value="${contact.email || ""}" autocomplete="off">
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 12px">
      <div class="card-header">
        <strong>Workers Compensation</strong>
        <div class="actions">
          <button type="button" data-action="copyPayroll">Copy Payroll</button>
        </div>
      </div>

      <div class="row">
        <div class="field">
          <label>Annual Payroll Estimate</label>
          <input data-field="wc_payrollEstimate" type="number" value="${wc.payrollEstimate || ""}" min="0" placeholder="$">
        </div>
        <div class="field">
          <label>Number of Employees</label>
          <input data-field="wc_numEmployees" type="number" value="${wc.numEmployees || ""}" min="0">
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
          <input data-field="wc_expirationDate" type="date" value="${wc.expirationDate || ""}">
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
        <div class="actions">
          <button type="button" data-action="copySales">Copy Sales Estimate</button>
        </div>
      </div>

      <div class="row">
        <div class="field">
          <label>Annual Sales/Revenue Estimate</label>
          <input data-field="gl_salesEstimate" type="number" value="${gl.salesEstimate || ""}" min="0" placeholder="$">
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
          <textarea data-field="gl_operationsDescription" placeholder="Describe what the business does...">${gl.operationsDescription || ""}</textarea>
        </div>
      </div>

      <div class="row" style="margin-top: 12px">
        <div class="field">
          <label>Prior Carrier</label>
          <input data-field="gl_priorCarrier" value="${gl.priorCarrier || ""}" autocomplete="off">
        </div>
        <div class="field">
          <label>Prior Carrier Expiration</label>
          <input data-field="gl_expirationDate" type="date" value="${gl.expirationDate || ""}">
        </div>
      </div>
    </div>
  `;
  
  // Copy buttons are handled via event delegation in the document-level listener
}

/* ---------- Handle Business Copy Buttons (Event Delegation) ---------- */
function handleBusinessCopyButtons(e) {
  if (!e.target.matches("[data-action]")) return;
  const action = e.target.dataset.action;
  const panel = e.target.closest("#panel-business");
  if (!panel) return;
  
  if (action === "copyTaxId") {
    const taxId = panel.querySelector('[data-field="taxId"]')?.value || "";
    copy(taxId);
  } else if (action === "copyPayroll") {
    const payroll = panel.querySelector('[data-field="wc_payrollEstimate"]')?.value || "";
    copy(payroll);
  } else if (action === "copySales") {
    const sales = panel.querySelector('[data-field="gl_salesEstimate"]')?.value || "";
    copy(sales);
  }
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
  try {
    if (!data || typeof data !== "object") {
      console.warn("Invalid import data:", data);
      toast("Invalid import data: must be an object");
      return false;
    }
    
    console.log("Importing JSON data:", data);
    
    // Use setAppStateAndRefresh which properly normalizes and applies state
    setAppStateAndRefresh(data);
    
    console.log("Import successful, appState:", appState);
    return true;
  } catch (error) {
    console.error("Import error:", error, error.stack);
    toast("Error importing JSON: " + (error.message || "Unknown error"));
    return false;
  }
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
    toast("File open not supported here. Use Import File… instead.");
    return;
  }

  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: "Quote Intake JSON", accept: { "application/json": [".json"] } }],
      multiple: false
    });

    const file = await handle.getFile();
    const text = await file.text();
    const obj = JSON.parse(text);

    fileHandle = handle;
    if (importJSON(obj)) {
      toast("Opened");
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      toast("Error opening file: " + (error.message || "Unknown error"));
    }
    // AbortError means user cancelled - don't show error
  }
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
  if (!raw) {
    toast("Paste JSON into the box first");
    return;
  }
  try {
    const obj = JSON.parse(raw);
    fileHandle = null;
    if (importJSON(obj)) {
      toast("Imported");
    }
  } catch (error) {
    toast("Invalid JSON: " + (error.message || "Parse error"));
  }
}

/* ---------- File Import Handler ---------- */
async function importFromFile() {
  if (!fileImportEl) return;
  
  fileImportEl.click();
}

async function handleFileImport(event) {
  const file = event.target.files?.[0];
  if (!file) return; // User cancelled
  
  // Reset input so same file can be selected again
  event.target.value = "";

  try {
    // Use file.text() for modern browsers, fallback to FileReader
    let text;
    if (file.text) {
      text = await file.text();
    } else {
      text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }

    const obj = JSON.parse(text);
    fileHandle = null; // Importing breaks link to existing file
    
    if (importJSON(obj)) {
      toast("Imported from file");
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      toast("Error importing file: " + (error.message || "Invalid JSON"));
    }
    // AbortError means user cancelled - don't show error
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
    appState.auto.counts.drivers = Number(e.target.value);
    renderDrivers(appState.auto.counts.drivers, appState.auto.drivers);
    scheduleAutosave("Updated drivers");
  });

  vehicleCountEl.addEventListener("change", (e) => {
    getAppStateFromUI();
    appState.auto.counts.vehicles = Number(e.target.value);
    renderVehicles(appState.auto.counts.vehicles, appState.auto.vehicles);
    scheduleAutosave("Updated vehicles");
  });
  
  // Render all tabs initially (ensures Business tab has content)
  renderAutoTab();
  renderHomeTab();
  renderBusinessTab();

  // Buttons
  btnNew.addEventListener("click", newIntake);
  btnOpen.addEventListener("click", () => openFile().catch(() => {}));
  btnSave.addEventListener("click", () => saveFile().catch(() => {}));
  btnSaveAs.addEventListener("click", () => saveAsFile().catch(() => {}));
  btnDownload.addEventListener("click", downloadJson);
  btnImportFile.addEventListener("click", importFromFile);
  btnImport.addEventListener("click", importFromJsonBox);
  
  // File input change handler
  if (fileImportEl) {
    fileImportEl.addEventListener("change", handleFileImport);
  }

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

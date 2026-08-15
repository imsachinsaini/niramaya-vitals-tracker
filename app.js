const STORAGE_KEY = "niramaya.vitals.entries.v2";
const PATIENTS_KEY = "niramaya.patients.v1";
const SETTINGS_KEY = "niramaya.sync.settings.v1";

const form = document.querySelector("#vitalsForm");
const editingId = document.querySelector("#editingId");
const measuredAt = document.querySelector("#measuredAt");
const patientName = document.querySelector("#patientName");
const viewPatientSelect = document.querySelector("#viewPatientSelect");
const rangeSelect = document.querySelector("#rangeSelect");
const customFrom = document.querySelector("#customFrom");
const customTo = document.querySelector("#customTo");
const customFromWrap = document.querySelector("#customFromWrap");
const customToWrap = document.querySelector("#customToWrap");
const trendsDetails = document.querySelector("#trendsDetails");
const systolic = document.querySelector("#systolic");
const diastolic = document.querySelector("#diastolic");
const spo2 = document.querySelector("#spo2");
const pulse = document.querySelector("#pulse");
const temperature = document.querySelector("#temperature");
const notes = document.querySelector("#notes");
const nowButton = document.querySelector("#nowButton");
const saveButton = document.querySelector("#saveButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const latestStatus = document.querySelector("#latestStatus");
const latestBp = document.querySelector("#latestBp");
const latestSpo2 = document.querySelector("#latestSpo2");
const latestPulse = document.querySelector("#latestPulse");
const entryCount = document.querySelector("#entryCount");
const historyBody = document.querySelector("#historyBody");
const emptyState = document.querySelector("#emptyState");
const exportButton = document.querySelector("#exportButton");
const clearButton = document.querySelector("#clearButton");
const syncButton = document.querySelector("#syncButton");
const saveSettingsButton = document.querySelector("#saveSettingsButton");
const testEndpointButton = document.querySelector("#testEndpointButton");
const sheetUrl = document.querySelector("#sheetUrl");
const accessCode = document.querySelector("#accessCode");
const rememberAccess = document.querySelector("#rememberAccess");
const syncStatus = document.querySelector("#syncStatus");
const installButton = document.querySelector("#installButton");

const charts = {
  bp: document.querySelector("#bpChart"),
  spo2: document.querySelector("#spo2Chart"),
  pulse: document.querySelector("#pulseChart"),
  temp: document.querySelector("#tempChart")
};

let entries = loadJson(STORAGE_KEY, []);
let patients = [];
let settings = loadJson(SETTINGS_KEY, { sheetUrl: "", accessCode: "", rememberAccess: false });
let selectedRange = "24";
let selectedViewPatient = "";
let deferredInstallPrompt = null;
let chartHitPoints = new Map();
let chartTooltip = null;

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function localDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function istDateTimeValue(value) {
  return `${value}:00+05:30`;
}

function makeId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function selectedPatient() {
  return patientName.value.trim();
}

function viewPatient() {
  return selectedViewPatient || patients[0] || "";
}

function entriesForViewPatient() {
  return entries.filter((entry) => entry.patient === viewPatient());
}

function sortedEntries(list = entries) {
  return [...list].sort((a, b) => new Date(a.measuredAt) - new Date(b.measuredAt));
}

function latestEntry() {
  return [...entriesForViewPatient()].sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt))[0];
}

function classify(entry) {
  if (entry.systolic >= 160 || entry.diastolic >= 110 || entry.spo2 < 92) {
    return {
      level: "danger",
      label: "Urgent",
      message: "Very high BP or low SpO2. Follow the doctor's emergency instructions."
    };
  }
  if (entry.systolic >= 140 || entry.diastolic >= 90 || entry.spo2 < 95 || entry.pulse >= 120 || entry.pulse < 50 || entry.temperature >= 100.4) {
    return {
      level: "warning",
      label: "Watch",
      message: "Outside common comfort range. Recheck and follow your doctor's guidance."
    };
  }
  return {
    level: "ok",
    label: "Logged",
    message: "Latest reading saved."
  };
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatFullDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function numericValue(input) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : null;
}

function normalizeEntry(raw) {
  return {
    id: raw.id || makeId(),
    patient: raw.patient || "Unnamed patient",
    measuredAt: raw.measuredAt || new Date().toISOString(),
    systolic: Number(raw.systolic),
    diastolic: Number(raw.diastolic),
    spo2: Number(raw.spo2),
    pulse: Number(raw.pulse),
    temperature: raw.temperature === "" || raw.temperature == null ? null : Number(raw.temperature),
    notes: raw.notes || "",
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
}

function mergeEntries(incoming) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  for (const item of incoming.map(normalizeEntry)) {
    const current = byId.get(item.id);
    if (!current || new Date(item.updatedAt) >= new Date(current.updatedAt)) {
      byId.set(item.id, item);
    }
  }
  entries = [...byId.values()];
  refreshPatients();
  saveJson(STORAGE_KEY, entries);
  saveJson(PATIENTS_KEY, patients);
}

function refreshPatients() {
  const saved = loadJson(PATIENTS_KEY, []);
  const entryPatients = entries.map((entry) => entry.patient).filter(Boolean);
  patients = [...new Set([...saved, ...entryPatients])]
    .filter((patient) => patient !== "Mother" || entryPatients.includes("Mother"))
    .sort();
  if (selectedViewPatient && !patients.includes(selectedViewPatient)) {
    selectedViewPatient = "";
  }
}

function renderPatients() {
  const current = viewPatient();
  viewPatientSelect.innerHTML = "";
  if (!patients.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No patients yet";
    viewPatientSelect.appendChild(option);
    viewPatientSelect.disabled = true;
    selectedViewPatient = "";
    return;
  }
  viewPatientSelect.disabled = false;
  for (const patient of patients) {
    const option = document.createElement("option");
    option.value = patient;
    option.textContent = patient;
    viewPatientSelect.appendChild(option);
  }
  if (patients.includes(current)) {
    viewPatientSelect.value = current;
    selectedViewPatient = current;
  } else if (patients.length) {
    viewPatientSelect.value = patients[0];
    selectedViewPatient = patients[0];
  }
}

function resetForm(patient = selectedPatient()) {
  form.reset();
  editingId.value = "";
  measuredAt.value = localDateTimeValue();
  patientName.value = patient || "";
  saveButton.textContent = "Save reading";
  cancelEditButton.hidden = true;
}

function updateSummary() {
  const list = entriesForViewPatient();
  const latest = latestEntry();
  entryCount.textContent = list.length;

  if (!viewPatient()) {
    latestBp.textContent = "--/--";
    latestSpo2.textContent = "--%";
    latestPulse.textContent = "--";
    latestStatus.className = "alert-strip";
    latestStatus.innerHTML = "<strong>No patient yet</strong><span>Save the first reading to begin tracking trends.</span>";
    return;
  }

  if (!latest) {
    latestBp.textContent = "--/--";
    latestSpo2.textContent = "--%";
    latestPulse.textContent = "--";
    latestStatus.className = "alert-strip";
    latestStatus.innerHTML = `<strong>${escapeHtml(viewPatient())}</strong><span>No readings yet for this patient.</span>`;
    return;
  }

  const state = classify(latest);
  latestBp.textContent = `${latest.systolic}/${latest.diastolic}`;
  latestSpo2.textContent = `${latest.spo2}%`;
  latestPulse.textContent = String(latest.pulse);
  latestStatus.className = `alert-strip ${state.level}`;
  latestStatus.innerHTML = `<strong>${escapeHtml(state.label)}</strong><span>${escapeHtml(state.message)} Latest for ${escapeHtml(latest.patient)}: ${formatFullDateTime(latest.measuredAt)}.</span>`;
}

function renderHistory() {
  const newestFirst = [...entries].sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt));
  historyBody.innerHTML = "";
  emptyState.hidden = newestFirst.length > 0;

  for (const entry of newestFirst) {
    const state = classify(entry);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(entry.patient)}</td>
      <td>${formatDateTime(entry.measuredAt)}</td>
      <td><span class="pill ${state.level}">${entry.systolic}/${entry.diastolic}</span></td>
      <td>${entry.spo2}%</td>
      <td>${entry.pulse}</td>
      <td>${entry.temperature ? `${entry.temperature} F` : "--"}</td>
      <td>${escapeHtml(entry.notes || "")}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-edit="${entry.id}">Edit</button>
          <button type="button" data-delete="${entry.id}">Delete</button>
        </div>
      </td>
    `;
    historyBody.appendChild(row);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function filteredForChart() {
  const all = sortedEntries(entriesForViewPatient());
  if (selectedRange === "all") return all;

  if (selectedRange === "custom") {
    const fromTime = customFrom.value ? new Date(`${customFrom.value}T00:00:00`).getTime() : -Infinity;
    const toTime = customTo.value ? new Date(`${customTo.value}T23:59:59`).getTime() : Infinity;
    return all.filter((entry) => {
      const time = new Date(entry.measuredAt).getTime();
      return time >= fromTime && time <= toTime;
    });
  }

  const hours = Number(selectedRange);
  const newest = all[all.length - 1];
  if (!newest) return [];

  const cutoff = new Date(newest.measuredAt).getTime() - hours * 60 * 60 * 1000;
  return all.filter((entry) => new Date(entry.measuredAt).getTime() >= cutoff);
}

function renderAllCharts() {
  const data = filteredForChart();
  renderLineChart(charts.bp, data, [
    { key: "systolic", label: "Systolic", color: "#b42318" },
    { key: "diastolic", label: "Diastolic", color: "#f79009" }
  ], "mmHg");
  renderLineChart(charts.spo2, data, [
    { key: "spo2", label: "SpO2", color: "#027a48" }
  ], "%", { minFloor: 88, maxCeil: 100 });
  renderLineChart(charts.pulse, data, [
    { key: "pulse", label: "Pulse", color: "#126b72" }
  ], "/min");
  renderLineChart(charts.temp, data.filter((entry) => entry.temperature), [
    { key: "temperature", label: "Temp", color: "#6941c6" }
  ], "F", { minFloor: 94, maxCeil: 104 });
}

function renderLineChart(canvas, data, series, unit, bounds = {}) {
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(320, Math.floor(rect.width * ratio));
  canvas.height = Math.max(200, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const width = rect.width;
  const height = rect.height;
  const pad = { top: 14, right: 14, bottom: 34, left: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  chartHitPoints.set(canvas, []);

  const values = data.flatMap((entry) => series.map((item) => entry[item.key]).filter((value) => Number.isFinite(value)));
  if (data.length === 0 || values.length === 0) {
    ctx.fillStyle = "#667085";
    ctx.font = "700 14px system-ui";
    ctx.fillText(viewPatient() ? "No readings yet" : "Select a patient", pad.left, height / 2);
    return;
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const min = bounds.minFloor ?? Math.floor((rawMin - 5) / 5) * 5;
  const max = bounds.maxCeil ?? Math.ceil((rawMax + 5) / 5) * 5;
  const firstTime = new Date(data[0].measuredAt).getTime();
  const lastTime = new Date(data[data.length - 1].measuredAt).getTime();
  const timeSpan = Math.max(1, lastTime - firstTime);

  function xFor(value) {
    return pad.left + ((new Date(value).getTime() - firstTime) / timeSpan) * plotW;
  }

  function yFor(value) {
    return pad.top + (1 - (value - min) / (max - min || 1)) * plotH;
  }

  ctx.strokeStyle = "#d9e4ef";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#667085";
  ctx.font = "700 11px system-ui";
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (plotH / 4) * i;
    const label = max - ((max - min) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.fillText(`${Number(label.toFixed(1))}`, 8, y + 4);
  }

  for (const item of series) {
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    data.forEach((entry, index) => {
      const x = xFor(entry.measuredAt);
      const y = yFor(entry[item.key]);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = item.color;
    data.forEach((entry) => {
      const x = xFor(entry.measuredAt);
      const y = yFor(entry[item.key]);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      chartHitPoints.get(canvas).push({
        x,
        y,
        label: item.label,
        value: entry[item.key],
        unit,
        time: entry.measuredAt
      });
    });
  }

  let legendX = pad.left;
  for (const item of series) {
    ctx.fillStyle = item.color;
    ctx.fillRect(legendX, height - 22, 10, 10);
    ctx.fillStyle = "#17202a";
    ctx.font = "700 12px system-ui";
    ctx.fillText(`${item.label} ${unit}`, legendX + 15, height - 13);
    legendX += item.label.length > 8 ? 112 : 86;
  }
}

function showChartTooltip(canvas, point, clientX, clientY) {
  if (!chartTooltip) {
    chartTooltip = document.createElement("div");
    chartTooltip.className = "chart-tooltip";
    document.body.appendChild(chartTooltip);
  }
  chartTooltip.innerHTML = `
    <strong>${escapeHtml(point.label)}: ${escapeHtml(point.value)} ${escapeHtml(point.unit)}</strong>
    <span>${escapeHtml(formatFullDateTime(point.time))}</span>
  `;
  chartTooltip.style.left = `${Math.min(window.innerWidth - 190, Math.max(8, clientX + 10))}px`;
  chartTooltip.style.top = `${Math.max(8, clientY - 58)}px`;
  chartTooltip.hidden = false;
  clearTimeout(chartTooltip.hideTimer);
  chartTooltip.hideTimer = setTimeout(() => {
    chartTooltip.hidden = true;
  }, 3500);
}

function handleChartPoint(event) {
  const canvas = event.currentTarget;
  const points = chartHitPoints.get(canvas) || [];
  if (!points.length) return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const point of points) {
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }
  if (nearest && nearestDistance <= 22) {
    showChartTooltip(canvas, nearest, event.clientX, event.clientY);
  }
}

function renderSettings() {
  sheetUrl.value = settings.sheetUrl || "";
  rememberAccess.checked = Boolean(settings.rememberAccess);
  accessCode.value = settings.rememberAccess ? settings.accessCode || "" : "";
  syncStatus.textContent = settings.sheetUrl
    ? "Google Sheet sync is configured. New saves will sync when internet is available."
    : "Local backup is active. Vercel sync is automatic when configured.";
}

function normalizeSheetUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/dev(\?|$)/, "/exec$1");
}

function render() {
  renderPatients();
  updateSummary();
  renderHistory();
  renderAllCharts();
}

async function syncWithSheet(showAlert = false) {
  const url = normalizeSheetUrl(settings.sheetUrl);
  const code = (accessCode.value || settings.accessCode || "").trim();

  syncStatus.textContent = "Syncing with Google Sheet...";
  try {
    if (canUseVercelSync()) {
      await syncViaVercel();
      if (showAlert) alert("Sync complete.");
      return;
    }
    if (!url) {
      if (showAlert) alert("Add the Google Apps Script URL first.");
      return;
    }
    if (!code) {
      if (showAlert) alert("Enter the access code for the sheet.");
      return;
    }
    await testEndpoint(url);
    await postToSheet(url, { action: "sync", accessCode: code, entries });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await readFromSheet(url, code);
    if (showAlert) alert("Sync complete.");
  } catch (error) {
    syncStatus.textContent = "Sync failed. Check the Apps Script URL, access code, deployment access, and internet.";
    if (showAlert) alert(error.message || "Sync failed.");
  }
}

function canUseVercelSync() {
  return location.hostname.endsWith(".vercel.app");
}

async function syncViaVercel() {
  const response = await fetch("/api/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action: "sync", entries })
  });
  const result = await parseJsonResponse(response, "Vercel sync did not return JSON.");
  if (!result.ok) {
    throw new Error(result.error || "Vercel sync failed.");
  }
  mergeEntries(result.entries || []);
  render();
  syncStatus.textContent = `Synced ${entries.length} readings at ${new Date().toLocaleTimeString()}.`;
}

async function parseJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${fallbackMessage} This usually means the app is not running on Vercel or the API is not deployed.`);
  }
}

function testEndpoint(url) {
  return jsonpRequest(url, { action: "ping" }, 8000).then((result) => {
    if (!result || !result.ok) {
      throw new Error(result && result.error ? result.error : "Endpoint test failed.");
    }
    return result;
  });
}

function postToSheet(url, payload) {
  return new Promise((resolve) => {
    const iframeName = `niramaya_sync_${Date.now()}`;
    const iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.hidden = true;

    const syncForm = document.createElement("form");
    syncForm.method = "POST";
    syncForm.action = url;
    syncForm.target = iframeName;
    syncForm.hidden = true;

    const payloadInput = document.createElement("input");
    payloadInput.name = "payload";
    payloadInput.value = JSON.stringify(payload);
    syncForm.appendChild(payloadInput);

    document.body.appendChild(iframe);
    document.body.appendChild(syncForm);
    iframe.addEventListener("load", () => {
      setTimeout(() => {
        iframe.remove();
        syncForm.remove();
        resolve();
      }, 100);
    }, { once: true });

    syncForm.submit();
    setTimeout(resolve, 1800);
  });
}

function readFromSheet(url, code) {
  return jsonpRequest(url, { action: "read", accessCode: code, t: Date.now() }, 10000).then((result) => {
    if (!result || !result.ok) {
      throw new Error(result && result.error ? result.error : "Google Sheet read failed.");
    }
    mergeEntries(result.entries || []);
    render();
    syncStatus.textContent = `Synced ${entries.length} readings at ${new Date().toLocaleTimeString()}.`;
  });
}

function jsonpRequest(url, params = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const callbackName = `niramayaRead_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const separator = url.includes("?") ? "&" : "?";
    const query = new URLSearchParams({
      ...params,
      callback: callbackName
    });
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("No response from the Google Apps Script URL."));
    }, timeoutMs);

    window[callbackName] = (result) => {
      cleanup();
      resolve(result);
    };

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    script.onerror = () => {
      cleanup();
      reject(new Error("Could not reach the Google Apps Script URL."));
    };
    script.src = `${url}${separator}${query.toString()}`;
    document.body.appendChild(script);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const patient = selectedPatient();
  if (!patient) {
    alert("Enter patient name before saving.");
    patientName.focus();
    return;
  }

  const entry = normalizeEntry({
    id: editingId.value || makeId(),
    patient,
    measuredAt: istDateTimeValue(measuredAt.value),
    systolic: numericValue(systolic),
    diastolic: numericValue(diastolic),
    spo2: numericValue(spo2),
    pulse: numericValue(pulse),
    temperature: numericValue(temperature),
    notes: notes.value.trim(),
    updatedAt: new Date().toISOString()
  });

  if (editingId.value) {
    entries = entries.map((item) => (item.id === editingId.value ? entry : item));
  } else {
    entries.push(entry);
  }

  refreshPatients();
  patients = [...new Set([...patients, entry.patient])].sort();
  selectedViewPatient = entry.patient;
  saveJson(STORAGE_KEY, entries);
  saveJson(PATIENTS_KEY, patients);
  resetForm(entry.patient);
  render();
  await syncWithSheet(false);
});

historyBody.addEventListener("click", (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;

  if (editId) {
    const entry = entries.find((item) => item.id === editId);
    if (!entry) return;
    editingId.value = entry.id;
    patientName.value = entry.patient;
    measuredAt.value = localDateTimeValue(new Date(entry.measuredAt));
    systolic.value = entry.systolic;
    diastolic.value = entry.diastolic;
    spo2.value = entry.spo2;
    pulse.value = entry.pulse;
    temperature.value = entry.temperature || "";
    notes.value = entry.notes || "";
    saveButton.textContent = "Update reading";
    cancelEditButton.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (deleteId && confirm("Delete this local reading? Sync deletion is not included in this first shared version.")) {
    entries = entries.filter((item) => item.id !== deleteId);
    saveJson(STORAGE_KEY, entries);
    render();
  }
});

nowButton.addEventListener("click", () => {
  measuredAt.value = localDateTimeValue();
});
cancelEditButton.addEventListener("click", resetForm);

viewPatientSelect.addEventListener("change", () => {
  selectedViewPatient = viewPatientSelect.value;
  render();
});

rangeSelect.addEventListener("change", () => {
  selectedRange = rangeSelect.value;
  const isCustom = selectedRange === "custom";
  customFromWrap.hidden = !isCustom;
  customToWrap.hidden = !isCustom;
  renderAllCharts();
});

customFrom.addEventListener("change", renderAllCharts);
customTo.addEventListener("change", renderAllCharts);
trendsDetails.addEventListener("toggle", () => {
  if (trendsDetails.open) requestAnimationFrame(renderAllCharts);
});

saveSettingsButton.addEventListener("click", () => {
  settings = {
    sheetUrl: normalizeSheetUrl(sheetUrl.value),
    accessCode: rememberAccess.checked ? accessCode.value.trim() : "",
    rememberAccess: rememberAccess.checked
  };
  saveJson(SETTINGS_KEY, settings);
  renderSettings();
  syncWithSheet(true);
});

testEndpointButton.addEventListener("click", async () => {
  const url = normalizeSheetUrl(sheetUrl.value || settings.sheetUrl);
  if (!url) {
    alert("Add the Google Apps Script URL first.");
    return;
  }
  syncStatus.textContent = "Testing Google Apps Script URL...";
  try {
    await testEndpoint(url);
    syncStatus.textContent = "Endpoint is reachable. Now save sync settings or press Sync now.";
    alert("Google Apps Script URL is reachable.");
  } catch (error) {
    syncStatus.textContent = "Endpoint is not reachable. Check deployment access and use the /exec URL.";
    alert(error.message || "Endpoint test failed.");
  }
});

syncButton.addEventListener("click", () => syncWithSheet(true));

exportButton.addEventListener("click", () => {
  if (!entries.length) {
    alert("No readings to export yet.");
    return;
  }

  const rows = sortedEntries(entries).map((entry) => [
    entry.patient,
    formatFullDateTime(entry.measuredAt),
    entry.systolic,
    entry.diastolic,
    entry.spo2,
    entry.pulse,
    entry.temperature || "",
    entry.notes || ""
  ]);
  const csv = [
    ["Patient", "Date Time", "Systolic BP", "Diastolic BP", "SpO2", "Pulse", "Temperature F", "Notes"],
    ...rows
  ].map((row) => row.map(csvCell).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `niramaya-vitals-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

clearButton.addEventListener("click", () => {
  if (!entries.length) return;
  if (confirm("Clear only this device's local copy? The Google Sheet will remain unchanged.")) {
    entries = [];
    saveJson(STORAGE_KEY, entries);
    resetForm();
    render();
  }
});

window.addEventListener("resize", renderAllCharts);
Object.values(charts).forEach((canvas) => {
  canvas.addEventListener("click", handleChartPoint);
  canvas.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    handleChartPoint({
      currentTarget: canvas,
      clientX: touch.clientX,
      clientY: touch.clientY
    });
  }, { passive: true });
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

renderSettings();
refreshPatients();
renderPatients();
resetForm();
render();
syncWithSheet(false);

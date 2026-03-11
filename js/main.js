let allSystems = [];
const activeSystems = new Set();
let currentSystem = "";
let hasConnected = false;

const filterState = new Set();
const lowBatteryWarnings = new Set();

const fileDropBox = document.querySelector(".file-drop-box");
const fileInput = document.getElementById("fileInput");

serverLauncherUrl = "VRServerLauncher.cgi"
deviceServerUrl = "VRDeviceServer.cgi";
compositingServerUrl = "VRCompositingServer.cgi";

const getServerStatusInterval = 3000;
const pingResumeDelayAfterConnect = 5000; // ms to wait after connection before resuming regular pings

let getStatusUpdates = true;   // global flag (default ON)
let showEmptyEnvironmentDropdown = false; // show dropdown even when no environments are available
let showLogo = false; // show the sidebar logo (set to true when a real logo is available)
let localhostOnly = true; // when true, only Local Host systems can be modified or have servers started/stopped

function sendButton(buttonNumber) {
  if (buttonNumber === 1) {
    // Toggle the global variable
    getStatusUpdates = !getStatusUpdates;
    console.log(`🔄 getStatusUpdates is now: ${getStatusUpdates ? "ON" : "OFF"}`);
	
    // Optional: Update button label to reflect state
    const btn = document.getElementById(`btn-1`);
    if (btn) {
      btn.textContent = getStatusUpdates ? "Disable Status Requests" : "Enable Status Requests";
    }

    // Optional: Log to console box
    autoUpdateConsole(
      { name: currentSystem },
      "toggleStatusUpdates",
      `getStatusUpdates is now: ${getStatusUpdates ? "ON" : "OFF"}`
    );
  }
  else if (buttonNumber === 2) {
    // Start servers — only allowed on Local Host
    if (currentSystem !== "Local Host") {
      autoUpdateConsole(
        { name: currentSystem },
        "startServers",
        "Server controls are only available on Local Host",
        "warning"
      );
      return;
    }
    const system = allSystems.find((d) => d.name === currentSystem);
    if (system) {
      startAndCheckServers(system);
    } else {
      console.log(`System ${currentSystem} not found`);
    }
  }
  else {
    console.log(`Button ${buttonNumber} pressed — no action yet.`);
    autoUpdateConsole(
      { name: currentSystem },
      `button${buttonNumber}`,
      "No action assigned yet."
    );
  }
}

// File drag-and-drop handlers
// CURRENTLY NOT USED — file drop elements commented out in HTML
fileDropBox?.addEventListener("dragover", (e) => {
  e.preventDefault();
  fileDropBox.classList.add("dragover");
});

fileDropBox?.addEventListener("dragleave", () => {
  fileDropBox.classList.remove("dragover");
});

fileDropBox?.addEventListener("drop", (e) => {
  e.preventDefault();
  fileDropBox.classList.remove("dragover");

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
});

fileInput?.addEventListener("change", () => {
  if (fileInput.files.length > 0) {
    handleFile(fileInput.files[0]);
  }
});

function handleFile(file) {
  console.log("📄 File received:", file.name, file);

  // Example: log to console area
  autoUpdateConsole(
    { name: currentSystem },
    "upload",
    `Received file: ${file.name} (${file.size} bytes)`
  );

  // TODO: process file here
}

// Returns list of systems normalized and standardized with latest updates
function normalizeSystems(rawSystems) {
  return rawSystems.map((d, index) => {
    const normalizedDevices = {};

    // Loop over all devices in this system
    for (const [key, device] of Object.entries(d.devices || {})) {
      normalizedDevices[key] = {
        connected: device?.connected || false,
        tracked: device?.tracked || false,
        battery: device?.battery ?? -1,
        hasBattery: device?.hasBattery || false,
        canPowerOff: device?.canPowerOff || false,
        powerFeatureIndexes: device?.powerFeatureIndexes || [],
        hapticFeedbackIndexes: device?.hapticFeedbackIndexes || [],
        buttonsPressed: device?.buttonsPressed || [],
        orientation: device?.orientation || [],
        position: device?.position || [],
      };
    }

    return {
      name: d.name,
      connected: !!normalizedDevices?.hmd?.connected, // fallback to headset connected if available
      ip: d.ip || "N/A",
      colorClass: `rig-${index % 6}`,
      devices: normalizedDevices,
      environments: [],
      serversRunning: false,
      isConnecting: false,
    };
  });
}

//Saves systems to local storage
function saveSystemsToLocalStorage() {
  const toSave = allSystems.map((d) => ({
    name: d.name,
    ip: d.ip,
    serverLauncherPort: d.serverLauncherPort,
    deviceServerPort: d.deviceServerPort,
    compositingServerPort: d.compositingServerPort
  }));
  localStorage.setItem("savedSystems", JSON.stringify(toSave));
}

// Gets the address of a system's server launcher
// ex): http://192.0.0.1:8080/ServerLauncher.cgi
function getServerLauncherEndpoint(system) {
  return `http://${system.ip}:${system.serverLauncherPort}/${serverLauncherUrl}`;
}
// Gets the address of a system using the global url combined with the local data of the system
// ex): http://192.0.0.1:8081/VRDeviceServer.cgi
function getDeviceServerEndpoint(system) {
  return `http://${system.ip}:${system.deviceServerPort}/${deviceServerUrl}`;
}

// Gets adress of the VR compositingServer
function getCompositingServerEndpoint(system) {
  return `http://${system.ip}:${system.compositingServerPort}/${compositingServerUrl}`;
}

// Shows a modal form with configurable fields for user input
function showFormModal({ title, submitLabel = "Save", fields, colorClass = "", onSubmit }) {
  const existing = document.getElementById("formModal");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "formModal";
  overlay.className = "form-modal-overlay";

  const card = document.createElement("div");
  card.className = "form-modal-card";
  if (colorClass) card.dataset.colorClass = colorClass;

  const h = document.createElement("h3");
  h.className = "form-modal-title";
  h.textContent = title;
  card.appendChild(h);

  const inputs = {};
  fields.forEach((f) => {
    const row = document.createElement("div");
    row.className = "form-modal-row";

    const label = document.createElement("label");
    label.textContent = f.label;
    label.htmlFor = `fmf-${f.key}`;

    const input = document.createElement("input");
    input.type = f.type || "text";
    input.id = `fmf-${f.key}`;
    input.value = f.default !== undefined ? f.default : "";
    input.placeholder = f.placeholder || "";

    row.appendChild(label);
    row.appendChild(input);
    card.appendChild(row);
    inputs[f.key] = input;
  });

  const buttons = document.createElement("div");
  buttons.className = "form-modal-buttons";

  const cancel = document.createElement("button");
  cancel.className = "form-modal-cancel";
  cancel.textContent = "Cancel";
  cancel.type = "button";
  cancel.onclick = () => overlay.remove();

  const submit = document.createElement("button");
  submit.className = "form-modal-submit";
  submit.textContent = submitLabel;
  submit.type = "button";
  submit.onclick = () => {
    const values = {};
    for (const [key, el] of Object.entries(inputs)) {
      values[key] = el.value.trim();
    }
    overlay.remove();
    onSubmit(values);
  };

  buttons.appendChild(cancel);
  buttons.appendChild(submit);
  card.appendChild(buttons);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  Object.values(inputs)[0]?.focus();

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit.click();
    if (e.key === "Escape") overlay.remove();
  });
}

// Add system to list of systems
function addSystem() {
  // Find first color index not already in use; fall back to cycling if all 6 taken
  const usedColors = new Set(allSystems.map(s => s.colorClass));
  const availableIndex = [0, 1, 2, 3, 4, 5].find(i => !usedColors.has(`rig-${i}`));
  const newColorClass = `rig-${availableIndex !== undefined ? availableIndex : allSystems.length % 6}`;

  // Find next default name not already in use
  const usedNames = new Set(allSystems.map(s => s.name));
  let nameIndex = allSystems.length;
  let defaultName = `Rig ${String.fromCharCode(65 + nameIndex)}`;
  while (usedNames.has(defaultName)) {
    nameIndex++;
    defaultName = `Rig ${String.fromCharCode(65 + nameIndex)}`;
  }

  showFormModal({
    title: "Add System",
    submitLabel: "Add",
    colorClass: newColorClass,
    fields: [
      { key: "name", label: "Name", default: defaultName, placeholder: defaultName },
      { key: "ip", label: "IP Address", default: "192.168.1.15", placeholder: "192.168.1.15" },
      { key: "port", label: "Launcher Port", default: "8080", placeholder: "8080" },
    ],
    onSubmit: ({ name, ip, port }) => {
      const newName = name || defaultName;
      if (
        newName.toLowerCase() === "local host" ||
        newName.toLowerCase() === "localhost"
      ) {
        alert("The name 'Local Host' is reserved and cannot be used.");
        return;
      }
      const newSystem = {
        name: newName,
        ip: ip || "",
        serverLauncherPort: port || "8080",
        deviceServerPort: "",
        compositingServerPort: "",
        connected: false,
        launcherAlive: false,
        servers: [],
        colorClass: newColorClass,
        devices: {},
      };
      allSystems.push(newSystem);
      updateInterface();
      autoUpdateConsole(newSystem, "add", `Added system '${newName}'`);
      saveSystemsToLocalStorage();
      checkLauncherAlive(newSystem);
    },
  });
}

// Remove system from list of systems
// Protects the Local Host from deletion
function removeSystem(systemName, skipConfirm = false) {
  if (systemName === "Local Host") {
    alert("Cannot remove 'Local Host'. It is a protected system.");
    return;
  }

  if (!skipConfirm) {
    const confirmed = confirm(`Are you sure you want to remove "${systemName}"?`);
    if (!confirmed) return;
  }

  // Clean up name-based references
  activeSystems.delete(systemName);
  filterState.delete(systemName);

  allSystems = allSystems.filter((d) => d.name !== systemName);

  // If the removed system is currently selected, switch to Local Host
  if (currentSystem === systemName) {
    changeSystem("Local Host");
  }

  updateInterface();

  autoUpdateConsole(
    { name: systemName },
    "remove",
    `System '${systemName}' removed.`
  );
	
  // Gray out all previous messages from this system
document.querySelectorAll(".log-entry .label").forEach((labelEl) => {
  if (labelEl.textContent.trim() === systemName) {
    labelEl.closest(".log-entry")?.classList.add("log-deleted");
  }
});

  saveSystemsToLocalStorage();
}

// New shutdown function that targets the launcher to stop servers
function shutdownSystem(system) {
  const confirmed = window.confirm(`Are you sure you want to shut down ${system.name}?`);
  if (!confirmed) return;

  autoUpdateConsole(system, "shutdown", "Sending shutdown command to launcher...");

  const endpoint = getServerLauncherEndpoint(system);

  fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "stopServers" }),
  }, 3000)
    .then((r) => r.json())
    .then((data) => {
      if (data?.status === "Success") {
        autoUpdateConsole(system, "shutdown", "✓ Servers stopped successfully");
        
        // Reset system state
        system.connected = false;
        system.launcherAlive = false;
        system.devices = {};
        system.servers = [];
        
        // Remove from active systems
        activeSystems.delete(system.name);
        
        // Update UI
        updateSystemUI(system);
        
      } else {
        autoUpdateConsole(system, "shutdown", `⚠️ ${data?.message || "Shutdown failed"}`, "error");
      }
    })
    .catch((err) => {
      if (err.name === "AbortError") {
        autoUpdateConsole(system, "shutdown", "Timed out sending shutdown command", "error");
      } else {
        autoUpdateConsole(system, "shutdown", `Failed to send shutdown: ${err.message}`, "error");
      }
    });
}

// Confirms and then shuts down a system
function confirmAndShutdown(system) {
  const confirmed = window.confirm(`Are you sure you want to turn off ${system.name}?`);
  if (!confirmed) return;

  stopLauncherServers(system);

  // Mark system as disconnected
  system.connected = false;
  system.launcherAlive = false;
  system.devices = {};
  system.servers = [];
  system.headset = 0;
  system.left = 0;
  system.right = 0;
  system.headset_connected = false;
  system.left_connected = false;
  system.right_connected = false;

  activeSystems.delete(system.name);
  updateSystemUI(system);

  autoUpdateConsole(system, "shutdown", "🛑 Shutdown command sent. Marked as disconnected.");
}

// Gets color of the system theme from css
function getSystemColor(system, muted = false) {
  const varName = `--${system.colorClass || "rig-0"}${muted ? "-muted" : ""}`;
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim() || "#999"
  );
}

// Changes which system we are talking to
// Possibly wanna rename to change system
function changeSystem(name) {
  currentSystem = name;
  updateInterface();

  const system = allSystems.find((d) => d.name === name);
  
  // Update sidebar border animation and offline state
  const sidebar = document.querySelector('.sidebar');
  if (system) {
    sidebar.dataset.colorClass = system.colorClass;
    
    // Three sidebar states: unreachable (gray), offline (muted rig), or online (full rig)
    const sidebarUnreachable = !system.launcherAlive;
    const sidebarOffline = system.launcherAlive && !system.connected;
    sidebar.classList.toggle('unreachable', sidebarUnreachable);
    sidebar.classList.toggle('offline', sidebarOffline);
    
    // Update file drop box state
    updateFileDropState(system);

    // Update environment dropdown from cached data (fetched once on first connect)
    updateEnvironmentDropdown(system);

    // Update command prompt color class
    const commandPrompt = document.getElementById('commandPrompt');
    if (commandPrompt) {
      // Remove all rig classes
      commandPrompt.classList.remove('rig-0', 'rig-1', 'rig-2', 'rig-3', 'rig-4', 'rig-5');
      // Add current system's color class
      commandPrompt.classList.add(system.colorClass);
    }
  } else {
    sidebar.removeAttribute('data-color-class');
    sidebar.classList.remove('offline');
    sidebar.classList.remove('unreachable');

    // Remove color class from command prompt
    const commandPrompt = document.getElementById('commandPrompt');
    if (commandPrompt) {
      commandPrompt.classList.remove('rig-0', 'rig-1', 'rig-2', 'rig-3', 'rig-4', 'rig-5');
    }

    // Hide environment selector when no system selected
    const envSelector = document.getElementById('environmentSelector');
    if (envSelector) envSelector.style.display = 'none';
  }
}

// Updates the file drop box enabled/disabled state
function updateFileDropState(system) {
  const fileDropBox = document.querySelector('.file-drop-box');
  const fileInput = document.getElementById('fileInput');
  
  if (!fileDropBox) return;
  
  // Disable if system is not connected
  if (!system || !system.connected) {
    fileDropBox.classList.add('disabled');
    if (fileInput) {
      fileInput.disabled = true;
    }
  } else {
    fileDropBox.classList.remove('disabled');
    if (fileInput) {
      fileInput.disabled = false;
    }
  }
}

// Updates the active target display and binds edit handlers
function updateDropdown() {
  const system = allSystems.find((d) => d.name === currentSystem);

  const nameEl = document.getElementById("currentSystemName");
  if (nameEl) {
    nameEl.textContent = currentSystem;
    if (system && currentSystem !== "Local Host") {
      nameEl.style.cursor = "pointer";
      nameEl.title = "Edit name";
      nameEl.onclick = (e) => {
        e.stopPropagation();
        showEditMenu(e, system, "name");
      };
    } else {
      nameEl.style.cursor = "default";
      nameEl.title = "";
      nameEl.onclick = null;
    }
  }

  const infoEl = document.getElementById("currentSystemInfo");
  if (infoEl) {
    infoEl.textContent = system ? `${system.ip}:${system.serverLauncherPort}` : "—";
    if (system) {
      infoEl.style.cursor = "pointer";
      infoEl.title = "Edit IP / Ports";
      infoEl.onclick = (e) => {
        e.stopPropagation();
        showEditMenu(e, system, "ipport");
      };
    } else {
      infoEl.onclick = null;
    }
  }
}

// Updates button logic based on the state
// Subject to heavy logic change as buttons change
function updateButtonStates() {
  const btn1 = document.getElementById("btn-1");
  if (btn1) {
    btn1.textContent = getStatusUpdates ? "Disable Status Requests" : "Enable Status Requests";
    btn1.classList.toggle("button-danger", getStatusUpdates);
  }

  const btn2 = document.getElementById("btn-2");
  if (btn2) {
    btn2.textContent = "Start Servers";
    btn2.disabled = false;
  }

  const btn3 = document.getElementById("btn-3");
  if (btn3) btn3.disabled = true;
}

// Updates the UI for the system widgets
function updateSystemUI(updatedSystem) {
  // Force a complete re-render by calling renderSystems
  // This ensures all device data, battery levels, and connection states are current
  renderSystems(allSystems);
  
  // Update dropdown to reflect any connection state changes
  updateDropdown();
  
  // Update the target label color
  changeTargetColor(updatedSystem.name);
  
  // Update button availability based on current system state
  updateButtonStates();
  
  // Update sidebar state if this is the current system
  if (updatedSystem.name === currentSystem) {
    const sidebar = document.querySelector('.sidebar');
    const sidebarUnreachable = !updatedSystem.launcherAlive;
    const sidebarOffline = updatedSystem.launcherAlive && !updatedSystem.connected;
    sidebar.classList.toggle('unreachable', sidebarUnreachable);
    sidebar.classList.toggle('offline', sidebarOffline);

    // Update file drop box state
    updateFileDropState(updatedSystem);
  }
}

// Updates console with new message
// Update autoUpdateConsole to reject unknown systems
function autoUpdateConsole(system, command, message, severity = "") {
  const consoleBox = document.getElementById("consoleOutput");

  // REJECT unknown systems - don't log them at all
  // Check by reference first (handles renamed systems), then fall back to name lookup
  const knownSystem = allSystems.includes(system) ? system : allSystems.find((d) => d.name === system.name);
  if (!knownSystem) {
    console.warn(`[REJECTED] Message from unknown system: ${system.name}`);
    return; // Exit early - don't log anything
  }

  const isAtBottom =
    Math.abs(
      consoleBox.scrollHeight - consoleBox.scrollTop - consoleBox.clientHeight
    ) < 5;

  const logEntry = document.createElement("div");

  const colorClass = knownSystem.colorClass;
  const isOffline = !knownSystem.launcherAlive;

  logEntry.classList.add("log-entry", colorClass);

  // Apply severity tag if needed
  if (severity === "success") {
    logEntry.classList.add("log-success");
  } else if (severity === "info") {
    logEntry.classList.add("log-info");
  } else if (severity === "warning") {
    logEntry.classList.add("log-warning");
  } else if (severity === "error") {
    logEntry.classList.add("log-error");
  } else if (severity === "critical") {
    logEntry.classList.add("log-critical");
  }

  // Label + (offline) badge
  const systemName = `<span class="label">${system.name}</span>`;
  const offlineNote = isOffline
    ? ` <span class="offline">(offline)</span>`
    : "";

  logEntry.innerHTML = `${systemName}${offlineNote} - ${command}<br>${message}`;

  // Apply system color to label
  const labelEl = logEntry.querySelector(".label");
  if (labelEl) {
    labelEl.style.color = getSystemColor(knownSystem);
  }

  // Append and re-filter
  consoleBox.appendChild(logEntry);
  applyConsoleFilter();

  if (isAtBottom) {
    setTimeout(() => {
      consoleBox.scrollTop = consoleBox.scrollHeight;
    }, 100);
  }

  updateInterface();
}

// Changes color of system
function changeTargetColor(systemName) {
  // This function is no longer needed with the new UI
  // The device selector doesn't use color coding
  // Keeping it as a no-op for backwards compatibility
}
  
// Formats the ports to be pretty printed; omits unknown ports
function formatPorts(p1, p2, p3) {
  p1 = Number(p1) || 0;
  p2 = Number(p2) || 0;
  p3 = Number(p3) || 0;

  if (!p2 && !p3) return `${p1}`;
  if (!p3) return p2 === p1 + 1 ? `${p1}-${p2}` : `${p1}/${p2}`;
  if (p2 === p1 + 1 && p3 === p2 + 1) return `${p1}-${p3}`;
  return `${p1}/${p2}/${p3}`;
}

function renderSystems(systems) {
  const container = document.getElementById("systemContainer");
  
  // Map existing cards by system name
  const existingCards = new Map(
    [...container.children].map(card => [card.dataset.system, card])
  );

  systems.forEach(system => {
    let card = existingCards.get(system.name);
    const isAlive = system.launcherAlive;
    const isConnected = system.connected;

    // =============================== 
    // CREATE CARD ONCE
    // =============================== 
    if (!card) {
      card = document.createElement("div");
      card.className = "system-card";
      card.dataset.system = system.name;
      card._sections = {}; // Store references to sections
      container.appendChild(card);
      card._needsFullRebuild = true;
    }

    // =============================== 
    // UPDATE CARD STATE (always cheap)
    // =============================== 
    // Three visual states:
    // - unreachable: can't contact launcher (fully gray)
    // - disconnected: launcher alive but servers stopped (faded rig color)
    // - connected: everything running (full rig color)
    const serversUp = isAlive && isConnected && system.serversRunning !== false;
    const launcherOnly = isAlive && !serversUp;
    card.classList.toggle("connected", serversUp);
    card.classList.toggle("disconnected", launcherOnly);
    card.classList.toggle("unreachable", !isAlive);
    card.classList.toggle("selected", system.name === currentSystem);
    
    // Update color class
    card.classList.forEach(c => {
      if (c.startsWith("rig-")) card.classList.remove(c);
    });
    card.classList.add(system.colorClass);

    card.onclick = () => changeSystem(system.name);

    // =============================== 
    // DETECT WHAT CHANGED
    // =============================== 
    const prev = card._prevState || {};
    const needsHeaderRebuild = 
      !prev.name || prev.name !== system.name ||
      prev.ip !== system.ip ||
      prev.ports !== `${system.serverLauncherPort}-${system.deviceServerPort}-${system.compositingServerPort}` ||
      prev.isAlive !== isAlive ||
      prev.currentSystem !== currentSystem;

    const needsServersRebuild = 
      !prev.servers ||
      prev.servers.length !== (system.servers?.length || 0) ||
      prev.servers.some((s, i) => 
        !system.servers?.[i] ||
        s.name !== system.servers[i].name ||
        s.isRunning !== system.servers[i].isRunning ||
        s.status !== system.servers[i].status
      );

    const needsDevicesRebuild = 
      !prev.devices ||
      prev.devices.length !== Object.keys(system.devices || {}).length ||
      prev.devices.some((d, i) => {
        const [key, device] = Object.entries(system.devices || {})[i] || [];
        return !device || 
          d.key !== key ||
          d.name !== device.name ||
          d.connected !== device.connected ||
          d.hasBattery !== device.hasBattery;
      });

    const needsShutdownRebuild = 
      prev.isAlive !== isAlive ||
      prev.isConnected !== isConnected ||
      prev.colorClass !== system.colorClass;

    // Check for battery-only changes (can be updated without rebuild)
    const batteryOnlyChange = 
      !needsDevicesRebuild &&
      prev.devices?.some((d, i) => {
        const device = Object.values(system.devices || {})[i];
        return device && d.battery !== device.battery;
      });

    // =============================== 
    // FAST PATH: Update battery only
    // =============================== 
    if (batteryOnlyChange && card._sections.devices && !card._needsFullRebuild) {
      Object.entries(system.devices || {}).forEach(([key, device], i) => {
        if (device?.connected && device.hasBattery && device.battery >= 0) {
          const deviceItem = card._sections.devices.querySelectorAll('.device-item')[i];
          if (deviceItem) {
            const fill = deviceItem.querySelector('.battery-fill');
            const percent = deviceItem.querySelector('.battery-percent');
            if (fill && percent) {
              fill.style.width = `${device.battery}%`;
              percent.textContent = `${device.battery}%`;
            }
          }
        }
      });
      
      // Update state and return early
      card._prevState = {
        name: system.name,
        ip: system.ip,
        ports: `${system.serverLauncherPort}-${system.deviceServerPort}-${system.compositingServerPort}`,
        isAlive,
        isConnected,
        currentSystem,
        colorClass: system.colorClass,
        servers: system.servers?.map(s => ({
          name: s.name,
          isRunning: s.isRunning,
          status: s.status
        })) || [],
        devices: Object.entries(system.devices || {}).map(([k, d]) => ({
          key: k,
          name: d?.name,
          connected: d?.connected,
          battery: d?.battery,
          hasBattery: d?.hasBattery
        }))
      };
      return;
    }

    // =============================== 
    // REBUILD ONLY CHANGED SECTIONS
    // =============================== 
    
    // ---------- HEADER ---------- 
    if (needsHeaderRebuild || card._needsFullRebuild) {
      const header = document.createElement("div");
      header.className = "card-header";

      const titleSection = document.createElement("div");
      titleSection.className = "title-section";

      const labelSpan = document.createElement("span");
      labelSpan.className = "system-title";
      labelSpan.textContent = system.name;

      if (system.name !== "Local Host" && system.name === currentSystem) {
        labelSpan.style.cursor = "pointer";
        labelSpan.title = "Edit name";
        labelSpan.onclick = e => {
          e.stopPropagation();
          showEditMenu(e, system, "name");
        };
      } else {
        labelSpan.classList.add("inactive-field");
      }

      if (!isAlive) {
        const offline = document.createElement("span");
        offline.textContent = " (unreachable)";
        offline.className = "offline-badge";
        labelSpan.appendChild(offline);
      }

      titleSection.append(labelSpan);
      header.appendChild(titleSection);

      if (system.name !== "Local Host") {
        const removeBtn = document.createElement("button");
        removeBtn.className = `remove-btn ${system.colorClass}`;
        removeBtn.textContent = "×";
        removeBtn.title = "Remove system";
        removeBtn.onclick = e => {
          e.stopPropagation();
          removeSystem(system.name);
        };
        header.appendChild(removeBtn);
      }

      if (card._sections.header) {
        card.replaceChild(header, card._sections.header);
      } else {
        card.appendChild(header);
      }
      card._sections.header = header;

      // Rebuild divider too
      const divider = Object.assign(document.createElement("div"), { 
        className: "card-divider" 
      });
      if (card._sections.divider) {
        card.replaceChild(divider, card._sections.divider);
      } else {
        card.insertBefore(divider, card._sections.header?.nextSibling || null);
      }
      card._sections.divider = divider;
    }

    // ---------- UNREACHABLE MESSAGE ----------
    // Show error message when launcher is not reachable (no power button)
    if (!isAlive) {
      if (!card._sections.unreachableMsg || card._needsFullRebuild) {
        const msg = document.createElement("div");
        msg.className = "unreachable-message";
        msg.innerHTML = `
          <span class="unreachable-icon">&#9888;</span>
          <span>VRServerLauncher unreachable</span>
        `;
        msg.onclick = e => {
          e.stopPropagation();
          autoUpdateConsole(system, "isAlive", "Attempting to contact launcher...");
          checkLauncherAlive(system);
        };
        msg.style.cursor = "pointer";
        msg.title = "Click to retry connection";

        if (card._sections.unreachableMsg) {
          card.replaceChild(msg, card._sections.unreachableMsg);
        } else {
          const insertAfter = card._sections.divider || card._sections.header;
          card.insertBefore(msg, insertAfter?.nextSibling || null);
        }
        card._sections.unreachableMsg = msg;
      }
      // Remove connect zone if present
      if (card._sections.connectZone) {
        card.removeChild(card._sections.connectZone);
        delete card._sections.connectZone;
        delete card._connectZoneMode;
      }
    } else {
      // Remove unreachable message when launcher is alive
      if (card._sections.unreachableMsg) {
        card.removeChild(card._sections.unreachableMsg);
        delete card._sections.unreachableMsg;
      }
    }

    // ---------- CONNECT ZONE ----------
    // Show power button when launcher is alive but servers are stopped
    // When localhostOnly is true, only Local Host gets server controls
    const isLocalHost = system.name === "Local Host";
    const canControl = isLocalHost || !localhostOnly;
    const serversAllStopped = isAlive && system.servers?.length > 0 && system.servers.every(s => !s.isRunning);

    if (canControl && isAlive && serversAllStopped) {
      if (!card._sections.connectZone || card._needsFullRebuild || card._connectZoneMode !== 'start') {
        const zone = document.createElement("div");
        zone.className = "connect-zone";
        zone.innerHTML = `
          <div class="connect-btn-wrap">
            <svg class="connect-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
              <line x1="12" y1="2" x2="12" y2="12"/>
            </svg>
          </div>
        `;

        zone.querySelector(".connect-btn-wrap").onclick = e => {
          e.stopPropagation();
          startAndCheckServers(system);
        };

        if (card._sections.connectZone) {
          card.replaceChild(zone, card._sections.connectZone);
        } else {
          const insertAfter = card._sections.unreachableMsg || card._sections.divider || card._sections.header;
          card.insertBefore(zone, insertAfter?.nextSibling || null);
        }

        card._sections.connectZone = zone;
        card._connectZoneMode = 'start';
      }

    } else if (card._sections.connectZone) {
      card.removeChild(card._sections.connectZone);
      delete card._sections.connectZone;
      delete card._connectZoneMode;
    }

    // ---------- SERVERS ----------
    // Only show server status when at least one server is running
	if (isAlive && system.servers?.length && system.servers.some(s => s.isRunning)) {
	  if (needsServersRebuild || card._needsFullRebuild) {
		const section = document.createElement("div");
		section.className = "server-section";

		const title = document.createElement("div");
		title.className = "section-title";
		title.textContent = "Servers";
		section.appendChild(title);

		system.servers.forEach((server) => {
		  const item = document.createElement("div");
		  item.className = "server-item";

		  let statusClass = "status-unknown";
		  if (!server.isRunning) {
			statusClass = "status-stopped";
		  } else if (server.status === "online") {
			statusClass = "status-online";
		  } else {
			statusClass = "status-error";
		  }

		  // Create elements like devices
		  const dot = document.createElement("span");
		  dot.className = `status-dot ${statusClass}`;

		  const name = document.createElement("span");
		  name.className = "server-name";
		  name.textContent = server.name;

		  item.append(dot, name);
		  section.appendChild(item);
		});

		if (card._sections.servers) {
		  card.replaceChild(section, card._sections.servers);
		} else {
		  const insertAfter = card._sections.connectZone || card._sections.divider || card._sections.header;
		  card.insertBefore(section, insertAfter?.nextSibling || null);
		}
		card._sections.servers = section;
	  }
	} else if (card._sections.servers) {
	  card.removeChild(card._sections.servers);
	  delete card._sections.servers;
	}

	// ---------- DEVICES ---------- 
	if (isConnected) {
	  if (needsDevicesRebuild || card._needsFullRebuild) {
		const section = document.createElement("div");
		section.className = "device-section";

		const title = document.createElement("div");
		title.className = "section-title";
		title.textContent = "Devices";
		section.appendChild(title);

		Object.entries(system.devices || {}).forEach(([key, device]) => {
		  const item = document.createElement("div");
		  item.className = "device-item";

		  item.addEventListener("click", (e) => {
		    // Device click ALWAYS wins
		    e.preventDefault();
		    e.stopPropagation();
		    e.stopImmediatePropagation();

		    // Switch system first
		    if (currentSystem !== system.name) {
			  changeSystem(system.name);
		    }
		  });

		  const dot = document.createElement("span");
		  dot.className = device?.connected 
			? "status-dot device-connected" 
			: "status-dot device-disconnected";

		  const name = document.createElement("span");
		  name.className = "device-name";
		  name.textContent = (device?.name || key).trim();

		  if (system.name === currentSystem) {
			name.style.cursor = "pointer";
			name.onclick = e => {
			  e.stopPropagation();
			  showEditMenu(e, system, key);
			};
		  } else {
			name.classList.add("inactive-field");
		  }

		  const info = document.createElement("div");
		  info.className = "device-info";

		  if (device?.connected && device.hasBattery && device.battery >= 0) {
			const bar = document.createElement("div");
			bar.className = "battery-bar";
			const fill = document.createElement("div");
			fill.className = "battery-fill";
			fill.style.width = `${device.battery}%`;
			bar.appendChild(fill);

			info.append(bar, Object.assign(document.createElement("span"), {
			  textContent: `${device.battery}%`,
			  className: "battery-percent"
			}));
		  } else {
			const statusText = document.createElement("span");
			statusText.className = "device-status-text";
			statusText.textContent = device?.connected ? "Connected" : "Not Connected";
			info.appendChild(statusText);
		  }

		  item.append(dot, name, info);
		  section.appendChild(item);
		});

		if (card._sections.devices) {
		  card.replaceChild(section, card._sections.devices);
		} else {
		  const insertAfter = card._sections.servers || card._sections.connectZone || card._sections.divider || card._sections.header;
		  card.insertBefore(section, insertAfter?.nextSibling || null);
		}
		card._sections.devices = section;
	  }
	} else if (card._sections.devices) {
	  card.removeChild(card._sections.devices);
	  delete card._sections.devices;
	}

    // ---------- SHUTDOWN ----------
    // Only show shutdown button when fully connected (servers running)
    // When localhostOnly is true, only Local Host gets server controls
    if (canControl && isAlive && isConnected) {
      if (needsShutdownRebuild || card._needsFullRebuild) {
        const wrap = document.createElement("div");
        wrap.className = "shutdown-container";

        const btn = document.createElement("button");
        btn.className = `shutdown-icon rig-${system.colorClass.at(-1)}-muted`;

        if (!isConnected) {
          btn.classList.add("disabled");
          btn.title = "Device server not connected";
        } else {
          btn.title = "Shut down system";
          btn.onclick = e => {
            e.stopPropagation();
            shutdownSystem(system);
          };
        }

        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
            <line x1="12" y1="2" x2="12" y2="12"></line>
          </svg>
        `;
        wrap.appendChild(btn);

        if (card._sections.shutdown) {
          card.replaceChild(wrap, card._sections.shutdown);
        } else {
          card.appendChild(wrap);
        }
        card._sections.shutdown = wrap;
      }
    } else if (card._sections.shutdown) {
      card.removeChild(card._sections.shutdown);
      delete card._sections.shutdown;
    }

    // =============================== 
    // SAVE STATE
    // =============================== 
    card._prevState = {
      name: system.name,
      ip: system.ip,
      ports: `${system.serverLauncherPort}-${system.deviceServerPort}-${system.compositingServerPort}`,
      isAlive,
      isConnected,
      currentSystem,
      colorClass: system.colorClass,
      servers: system.servers?.map(s => ({
        name: s.name,
        isRunning: s.isRunning,
        status: s.status
      })) || [],
      devices: Object.entries(system.devices || {}).map(([k, d]) => ({
        key: k,
        name: d?.name,
        connected: d?.connected,
        battery: d?.battery,
        hasBattery: d?.hasBattery
      }))
    };
    card._needsFullRebuild = false;
  });

  // Remove cards that no longer exist
  [...container.children].forEach(card => {
    if (!systems.find(s => s.name === card.dataset.system)) {
      card.remove();
    }
  });
  
  // =============================== 
  // ADD SYSTEM CARD (always last)
  // =============================== 
  let addCard = container.querySelector('.add-system-card');
  if (!addCard) {
    addCard = document.createElement("div");
    addCard.className = "add-system-card";
    addCard.title = "Add new system"; 
    addCard.onclick = addSystem;
    
    const plusIcon = document.createElement("div");
    plusIcon.className = "add-system-plus";
    plusIcon.textContent = "+";
    
    addCard.appendChild(plusIcon);
    container.appendChild(addCard);
  }
}

// Creates battery widgets a system
function createBattery(system, label, percent, isConnected, isTracked, hasBattery) {
  const row = document.createElement("div");
  row.className = "battery-row";

  const labelSpan = document.createElement("span");
  labelSpan.className = "battery-label";
  labelSpan.textContent = label;

  if (system.name === currentSystem) {
  labelSpan.style.cursor = "pointer";
  labelSpan.title = `Edit ${label}`;
  labelSpan.onclick = (e) => {
    e.stopPropagation();

    // 🚀 Just use the label (which is the device key!)
    const field = label;

    // console.log(`[DEBUG] label click → label='${label}', field='${field}'`);

    showEditMenu(e, system, field);
  };
} else {
  labelSpan.style.cursor = "default";
  labelSpan.title = "Select this system to edit";
  labelSpan.classList.add("inactive-field");
}

  const statusSpan = document.createElement("span");
  statusSpan.className = "battery-status";

  // Not Connected
  if (!isConnected) {
    statusSpan.textContent = "Not Connected";
    statusSpan.style.color = "gray";
    statusSpan.style.fontSize = ".8rem";
    statusSpan.style.marginLeft = "1rem";
    statusSpan.style.textAlign = "right";
    row.appendChild(labelSpan);
    row.appendChild(statusSpan);
  }

  // Connected
  else {
    row.appendChild(labelSpan);

    // No battery → just "Connected"
    if (!hasBattery) {
      statusSpan.textContent = "Connected";
      statusSpan.style.color = getSystemColor(system);
      statusSpan.style.fontSize = ".8rem";
      statusSpan.style.marginLeft = "1rem";
      statusSpan.style.fontWeight = "bold";
      statusSpan.style.textAlign = "right";
      row.appendChild(statusSpan);
    }

    // Has battery → show battery bar
    else {
      const container = document.createElement("div");
      container.className = "battery-bar-container";

      const bar = document.createElement("div");
      bar.className = "battery-bar";

      const fill = document.createElement("div");
      fill.className = "battery-fill";

      const fullSystem =
        allSystems.find((d) => d.name === system.name) || system;

      fill.style.width = `${percent}%`;
      fill.style.backgroundColor = getSystemColor(fullSystem);

      const pct = document.createElement("span");
      pct.className = "battery-percent";
      pct.textContent = `${percent}%`;
      pct.style.color = "var(--text-dark)";
      if (percent === 0) pct.classList.add("zero");

      bar.appendChild(fill);
      container.appendChild(bar);
      container.appendChild(pct);
      row.appendChild(container);
    }

    // Tracking dot for all connected devices
    const trackedDot = document.createElement("span");
    trackedDot.className = isTracked ? "tracked-dot tracked" : "tracked-dot";
    trackedDot.title = isTracked
      ? "Device tracked"
      : "Device connected (not tracked)";
    row.appendChild(trackedDot);
  }

  return row;
}

// Helper function to make the action menu visible when interacting with a system
function makeMenuVisible(menu) {
  menu.classList.remove("hidden");
  menu.classList.add("visible");
}

// Lets user edit system info
// popupWin: pass miniMonitorPopup when calling from the detached monitor
function showEditMenu(e, system, field, popupWin = null) {
  e.stopPropagation();

  const targetDoc = popupWin ? popupWin.document : document;
  const menu = targetDoc.getElementById(popupWin ? "popupActionMenu" : "actionMenu");
  if (!menu) return;
  menu.innerHTML = "";

  // console.log("========== showEditMenu ==========");
  // console.log(`[DEBUG] System: '${system.name}'`);
  // console.log(`[DEBUG] Field: '${field}'`);
  // console.log(`[DEBUG] Devices:`, Object.keys(system.devices || {}));

  // Reset for re-render
  makeMenuVisible(menu);

  const available = [];
  const isLocal = system.name === "Local Host";

  if (field === "name" && !isLocal) {
	// console.log("[DEBUG] Adding action: Rename");
	available.push("Rename");
  } else if (field === "ipport") {
    available.push("Edit Connection");
  } else {
    // Treat as device if exists
    const device = system.devices?.[field];
    if (device && device.connected) {
      // console.log("[DEBUG] Device found:", device);

      if (device.hapticFeedbackIndexes?.length > 0) {
        // console.log("[DEBUG] Device supports: Ping");
        available.push("Ping");
      } else {
        // console.log("[DEBUG] Device has NO hapticFeedbackIndexes.");
      }

      if (device.canPowerOff) {
        // console.log("[DEBUG] Device supports: Power Off");
        available.push("Power Off");
      } else {
        // console.log("[DEBUG] Device has NO canPowerOff.");
      }

    } else {
      // console.log(`[DEBUG] No matching device for field='${field}'`);
    }
  }

  // console.log(`[DEBUG] Final available actions:`, available);

  // Build buttons or show empty state
  if (available.length === 0) {
    // console.log("[DEBUG] No actions available - showing empty notice.");
    const emptyNotice = document.createElement("div");
    emptyNotice.textContent = "No actions available";
    emptyNotice.style.padding = "0.5rem";
    emptyNotice.style.fontSize = "0.8rem";
    emptyNotice.style.color = "gray";
    menu.appendChild(emptyNotice);
  } else {
    // console.log(`[DEBUG] Building ${available.length} button(s).`);
    available.forEach((action) => {
      // console.log(`[DEBUG] Creating button: ${action}`);
      const btn = document.createElement("button");
      btn.textContent = action;

      btn.onclick = () => {
        // console.log(`[DEBUG] Button clicked: ${action}`);
        menu.classList.add("hidden");

        switch (action) {
          case "Rename":
            renameSystem(system);
            break;
          case "Edit Connection":
            showEditConnectionModal(system);
            break;
          case "Ping": {
            const device = system.devices?.[field];
            const featureIndex = device?.hapticFeedbackIndexes?.[0];
            if (featureIndex != null) {
              // console.log(`[DEBUG] Sending Ping (featureIndex=${featureIndex})`);
              sendHapticTick(system, field, featureIndex);
            } else {
              console.warn("No haptic feedback index for Ping:", field);
            }
            break;
          }
          case "Power Off": {
            const device = system.devices?.[field];
            const powerIndex = device?.powerFeatureIndexes?.[0];
            if (powerIndex != null) {
              // console.log(`[DEBUG] Sending Power Off (powerIndex=${powerIndex})`);
              sendPowerOff(system, field, powerIndex);
            } else {
              console.warn("No power feature index for:", field);
            }
            break;
          }
        }
      };

      menu.appendChild(btn);
    });
  }

  // Position menu (fixed in popup, absolute+scroll in main)
  const rect = e.target.getBoundingClientRect();
  menu.style.top = `${rect.bottom + (popupWin ? 0 : window.scrollY)}px`;
  menu.style.left = `${rect.left + (popupWin ? 0 : window.scrollX)}px`;

  // console.log(`[DEBUG] Menu positioned at top=${menu.style.top}, left=${menu.style.left}`);
  //console.log("===================================");
}

// Fetch with timeout helper
function fetchWithTimeout(resource, options = {}, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  return fetch(resource, {
    ...options,
    signal: controller.signal
  }).finally(() => clearTimeout(id));
}

// Handles server response for commands
function handleServerResponse(system, command, data) {
	// Handls server response in our console
	if (data?.status === "Success") {
	  autoUpdateConsole(system, command, data.message || "Success.");
	} else {
	  const errorMsg = data?.message || "Error / Unknown failure.";
	  autoUpdateConsole(system, command, `⚠️ ${errorMsg}`, "error"); // ADD "error" HERE
	}
}

// Check if the VRServerLauncher daemon is reachable
// Does NOT start any servers — just confirms the launcher is alive, then queries status
function checkLauncherAlive(system) {
  if (!system) return;

  const endpoint = getServerLauncherEndpoint(system);

  autoUpdateConsole(system, "isAlive", `Checking launcher at ${endpoint}...`);

  fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "isAlive" }),
  }, 8000)
    .then((r) => r.json())
    .then((data) => {
      if (data?.isRunning === true) {
        system.launcherAlive = true;
        system.lastSeen = Date.now();

        autoUpdateConsole(system, "isAlive", "Launcher is alive ✓");

        // Fetch environments on first connect
        getEnvironments(system);

        // Check server states — only auto-start on Local Host
        const isLocal = system.name === "Local Host";
        getLauncherStatus(system, isLocal);
      } else {
        system.launcherAlive = false;
        autoUpdateConsole(system, "isAlive", `Launcher responded but isRunning=${data?.isRunning}`, "error");
      }

      updateSystemUI(system);
    })
    .catch((err) => {
      system.launcherAlive = false;

      if (err.name === "AbortError") {
        autoUpdateConsole(system, "isAlive", "Timed out contacting launcher (8s)", "error");
      } else if (err.name === "TypeError" && err.message.includes("Failed to fetch")) {
        autoUpdateConsole(system, "isAlive", "Network error - check if launcher is running and CORS is configured", "error");
      } else {
        autoUpdateConsole(system, "isAlive", `Failed to contact launcher: ${err.message}`, "error");
      }

      updateSystemUI(system);
    });
}

// Sends a haptic tick command to the system
function sendHapticTick(system, deviceName, featureIndex) {
  if (!system) {
    autoUpdateConsole({ name: "Unknown" }, "hapticTick", "System not found.", "error");
    return;
  }

  const device = system.devices?.[deviceName];
  if (!device) {
    autoUpdateConsole(system, "hapticTick", `Device '${deviceName}' not found.`, "error");
    return;
  }

  if (
    !device.hapticFeedbackIndexes ||
    device.hapticFeedbackIndexes.length === 0
  ) {
    autoUpdateConsole(system, "hapticTick", `Device '${deviceName}' has no haptic feedback features.`, "error");
    return;
  }

  if (!device.hapticFeedbackIndexes.includes(featureIndex)) {
    autoUpdateConsole(system, "hapticTick", `Feature index ${featureIndex} not available in device '${deviceName}'.`, "error");
    return;
  }

  const endpoint = getDeviceServerEndpoint(system);

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      command: "hapticTick",
      hapticFeatureIndex: featureIndex,
      duration: 300,
      frequency: 100,
      amplitude: 255,
    }),
  })
    .then((r) => r.json())
    .then((data) => {
      handleServerResponse(system, "hapticTick", data);
    })
    .catch((err) => {
      console.error(`HapticTick to '${deviceName}' in ${system.name} failed:`, err);
      autoUpdateConsole(system, "hapticTick", "Failed to send command", "error");
    });
}

function sendPowerOff(system, deviceName, featureIndex) {
  if (!system) {
    autoUpdateConsole({ name: "Unknown" }, "powerOff", "System not found.", "error");
    return;
  }

  const device = system.devices?.[deviceName];
  if (!device) {
    autoUpdateConsole(system, "powerOff", `Device '${deviceName}' not found.`, "error");
    return;
  }

  if (
    !device.powerFeatureIndexes ||
    device.powerFeatureIndexes.length === 0
  ) {
    autoUpdateConsole(system, "powerOff", `Device '${deviceName}' has no power off features.`, "error");
    return;
  }

  if (!device.powerFeatureIndexes.includes(featureIndex)) {
    autoUpdateConsole(system, "powerOff", `Feature index ${featureIndex} not available in device '${deviceName}'.`, "error");
    return;
  }

  const endpoint = getDeviceServerEndpoint(system);

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      command: "powerOff",
      powerFeatureIndex: featureIndex,
    }),
  })
    .then((r) => r.json())
    .then((data) => {
      handleServerResponse(system, "powerOff", data);
    })
    .catch((err) => {
      console.error(`PowerOff to '${deviceName}' in ${system.name} failed:`, err);
      autoUpdateConsole(system, "powerOff", "Failed to send command", "error");
    });
}

// Functions to change info about a system
function renameSystem(system) {
  showFormModal({
    title: "Rename System",
    submitLabel: "Rename",
    colorClass: system.colorClass || "",
    fields: [
      { key: "name", label: "Name", default: system.name, placeholder: "System name" }
    ],
    onSubmit: ({ name }) => {
      if (name && name !== system.name) {
        const oldName = system.name;

        // Update all name-based references before changing the name
        if (currentSystem === oldName) {
          currentSystem = name;
        }
        if (activeSystems.has(oldName)) {
          activeSystems.delete(oldName);
          activeSystems.add(name);
        }
        if (filterState.has(oldName)) {
          filterState.delete(oldName);
          filterState.add(name);
        }

        system.name = name;
        saveSystemsToLocalStorage();
        updateInterface();
      }
    },
  });
}

// Edit a system's connection details (IP and Launcher Port) in a single modal
function showEditConnectionModal(system) {
  const isLocalHost = system.name === "Local Host";
  const fields = [];
  if (!isLocalHost) {
    fields.push({ key: "ip", label: "IP Address", default: system.ip || "", placeholder: "192.168.1.15" });
  }
  fields.push({ key: "port", label: "Launcher Port", default: system.serverLauncherPort || "8080", placeholder: "8080" });

  showFormModal({
    title: "Edit Connection",
    submitLabel: "Save",
    colorClass: system.colorClass || "",
    fields,
    onSubmit: ({ ip, port }) => {
      if (!isLocalHost && ip) system.ip = ip;
      if (port) system.serverLauncherPort = port;
      saveSystemsToLocalStorage();
      updateInterface();
    },
  });
}

// Called by getServerStatus, updating system with data from the server
function updateSystemWithJsonData(system, jsonData) {
	if (!jsonData || !Array.isArray(jsonData.devices)) return;

	// Ensure devices object exists
	if (!system.devices) {
	  system.devices = {};
	}

	system.connected = true;

	for (const device of jsonData.devices) {
	  const deviceName = device.name?.trim() || `device_${Math.random().toString(36).substring(2, 8)}`;

	  // Safe key for object — you can also sanitize it here if needed
	  const key = deviceName.toLowerCase();

	  const commonInfo = {
		name: device.name,
		connected: !!device.isConnected,
		tracked: !!device.isTracked,
		hasBattery: !!device.hasBattery,
		canPowerOff: !!device.canPowerOff,
		powerFeatureIndexes:
		  device.canPowerOff && device.powerFeatureIndex != null
			? [device.powerFeatureIndex]
			: [],
		hapticFeedbackIndexes: Array.isArray(device.hapticFeatures)
		  ? device.hapticFeatures.map((hf) => hf.index)
		  : [],
		buttonsPressed:
		  device.buttons?.filter((b) => b.value).map((b) => b.name) || [],
		orientation: device.trackerState?.rotation || [],
		position: device.trackerState?.translation || [],
		battery: device.batteryLevel != null ? device.batteryLevel : -1,
	  };

	  // Save device by its name
	  system.devices[key] = commonInfo;
	}

	//console.log(JSON.stringify(system, null, 2));
}

// Calls to server about system status
function getDeviceServerStatus(system) {
  if (!system) return;

  const endpoint = getDeviceServerEndpoint(system);

  fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "getServerStatus" }),
  }, 3000) // 3000 ms timeout
    .then((r) => r.json())
    .then((data) => {
      const i = allSystems.findIndex((d) => d.name === system.name);
      if (i === -1) return;

      updateSystemWithJsonData(allSystems[i], data);

      // Mark as online
      allSystems[i].lastSeen = Date.now();

      // Add to activeSystems if success
      if (data?.status === "Success") {
        if (!activeSystems.has(system.name)) {
          console.log(`${system.name} added to activeSystems`);
          activeSystems.add(system.name);
        }
      }

      updateSystemUI(allSystems[i]);

      handleServerResponse(system, "getServerStatus", data);
    })
    .catch((err) => {
      if (err.name === "AbortError") {
        console.error(`Timeout contacting ${system.name}`);
        autoUpdateConsole(system, "getServerStatus", "Timed out contacting device", "error");
      } else {
        console.error(`Failed to contact ${system.name} (${system.ip}:${system.deviceServerPort}):`, err);
        autoUpdateConsole(system, "getServerStatus", "Failed to contact device — connection error", "error");
      }
    });
}

// Calls to compositing server about system status - DEPRECATED, use pingServerStatus instead
function getCompositingServerStatus(system) {
  if (!system) return;

  const endpoint = getCompositingServerEndpoint(system);

  fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "getServerStatus" }),
  }, 3000)
    .then((r) => r.json())
    .then((data) => {
      // Handle compositing-specific response
      handleServerResponse(system, "getCompositingStatus", data);
      
      // Add any compositing-specific UI updates here
    })
    .catch((err) => {
      if (err.name === "AbortError") {
        console.error(`Timeout contacting compositing server on ${system.name}`);
        autoUpdateConsole(system, "getCompositingStatus", "Timed out contacting compositing server", "error");
      } else {
        console.error(`Failed to contact compositing server on ${system.name}:`, err);
        autoUpdateConsole(system, "getCompositingStatus", "Failed to contact compositing server", "error");
      }
    });
}

// Start VR Compositor and VRRunDeviceTracker
// Returns a promise so callers can chain after the response
function startLauncherServers(system) {
  if (!system) return Promise.reject("No system");

  const endpoint = getServerLauncherEndpoint(system);

  return fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "startServers" }),
  }, 5000)
    .then(() => {
      autoUpdateConsole(system, "startServers", "Start command sent to launcher.");
    })
    .catch((err) => {
      if (err.name === "AbortError") {
        autoUpdateConsole(system, "startServers", "Timed out contacting launcher", "error");
      } else {
        autoUpdateConsole(system, "startServers", "Failed to contact launcher", "error");
      }
    });
}

// Stop VR Compositor and VRRunDeviceTracker
function stopLauncherServers(system) {
  if (!system) return;

  const endpoint = getServerLauncherEndpoint(system);

  fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "stopServers" }),
  }, 3000)
    .then(() => {
      autoUpdateConsole(system, "stopServers", "Stop command sent to launcher.");
    })
    .catch((err) => {
      if (err.name === "AbortError") {
        console.error(`Timeout stopping launcher servers on ${system.name}`);
        autoUpdateConsole(system, "stopServers", "Timed out contacting launcher", "error");
      } else {
        console.error(`Failed to stop servers on ${system.name}:`, err);
        autoUpdateConsole(system, "stopServers", "Failed to contact launcher", "error");
      }
    });
}

// Fetches available environments from VRServerLauncher and populates the dropdown
function getEnvironments(system) {
  if (!system) return;

  const endpoint = getServerLauncherEndpoint(system);

  // If launcher isn't alive, clear stored environments and update UI
  if (!system.launcherAlive) {
    system.environments = [];
    updateEnvironmentDropdown(system);
    return;
  }

  autoUpdateConsole(system, "getEnvironments", `Requesting environments from ${endpoint}...`);

  fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "getEnvironments" }),
  }, 3000)
    .then((r) => r.json())
    .then((data) => {
      const environments = data?.environments;

      if (!Array.isArray(environments) || environments.length === 0) {
        system.environments = [];
        autoUpdateConsole(system, "getEnvironments", "No environments found.");
      } else {
        system.environments = environments;
        autoUpdateConsole(system, "getEnvironments", `Found ${environments.length} environment(s).`);
      }

      // Only update the dropdown UI if this is the currently selected system
      updateEnvironmentDropdown(system);
    })
    .catch((err) => {
      system.environments = [];
      updateEnvironmentDropdown(system);
      if (err.name === "AbortError") {
        autoUpdateConsole(system, "getEnvironments", "Timed out fetching environments", "error");
      } else {
        autoUpdateConsole(system, "getEnvironments", "Failed to fetch environments", "error");
      }
    });
}

// Updates the environment dropdown UI based on the system's stored environments
function updateEnvironmentDropdown(system) {
  const selector = document.getElementById('environmentSelector');
  const dropdown = document.getElementById('environmentDropdown');
  if (!selector || !dropdown) return;

  // Only update UI if this system is currently selected
  if (system.name !== currentSystem) return;

  const environments = system.environments || [];

  if (environments.length === 0 && !showEmptyEnvironmentDropdown) {
    selector.style.display = 'none';
    return;
  }

  // Populate dropdown
  dropdown.innerHTML = '<option value="">Select environment...</option>';
  environments.forEach((env) => {
    const option = document.createElement('option');
    option.value = env.path;
    option.textContent = env.name;
    dropdown.appendChild(option);
  });

  selector.style.display = 'flex';
}

// Sends the selected environment file path to VRDeviceDaemon
function uploadEnvironment(system, environmentFilePath) {
  if (!system || !environmentFilePath) return;

  const endpoint = getDeviceServerEndpoint(system);

  autoUpdateConsole(system, "uploadEnvironment", `Uploading environment: ${environmentFilePath}...`);

  fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      command: "uploadEnvironment",
      environmentFilePath: environmentFilePath,
    }),
  }, 5000)
    .then((r) => r.json())
    .then((data) => {
      if (data?.status === "Success") {
        autoUpdateConsole(system, "uploadEnvironment", "Environment loaded successfully.", "success");
      } else {
        autoUpdateConsole(system, "uploadEnvironment", `Server responded: ${data?.message || "Unknown error"}`, "error");
      }
    })
    .catch((err) => {
      if (err.name === "AbortError") {
        autoUpdateConsole(system, "uploadEnvironment", "Timed out uploading environment", "error");
      } else {
        autoUpdateConsole(system, "uploadEnvironment", "Failed to upload environment", "error");
      }
    });
}

// Listen for environment dropdown changes
// Command history for console
const commandHistory = [];
let commandHistoryIndex = -1;

// Handle Enter, Up, Down keys in console input
document.getElementById('commandInput')?.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendConsoleCommand();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (commandHistory.length === 0) return;
    if (commandHistoryIndex < commandHistory.length - 1) {
      commandHistoryIndex++;
    }
    this.value = commandHistory[commandHistoryIndex];
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (commandHistoryIndex > 0) {
      commandHistoryIndex--;
      this.value = commandHistory[commandHistoryIndex];
    } else {
      commandHistoryIndex = -1;
      this.value = '';
    }
  }
});

document.getElementById('environmentDropdown')?.addEventListener('change', function () {
  const filePath = this.value;
  if (!filePath) return;

  const system = allSystems.find((d) => d.name === currentSystem);
  if (system) {
    uploadEnvironment(system, filePath);
  }
});

// Query the launcher for server list and their running state
// autoStart: if true, will automatically start servers that are stopped (used on page load)
function getLauncherStatus(system, autoStart = false) {
  if (!system) return;

  const endpoint = getServerLauncherEndpoint(system);

  fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "getServerStatus" }),
  }, 5000)
    .then((r) => r.json())
    .then((data) => {
      if (!Array.isArray(data.servers)) {
        updateSystemUI(system);
        return;
      }

      // Store server info, preserving lastStatus to reduce log spam
      system.servers = data.servers.map((srv, i) => ({
        ...srv,
        status: srv.isRunning ? 'checking...' : 'stopped',
        lastStatus: system.servers?.[i]?.lastStatus ?? null,
      }));

      // Update device/compositing ports from launcher response
      data.servers.forEach((srv, index) => {
        if (srv.port) {
          if (index === 0) system.deviceServerPort = String(srv.port);
          else if (index === 1) system.compositingServerPort = String(srv.port);
        }
      });

      const allStopped = data.servers.every(srv => !srv.isRunning);
      const anyStopped = data.servers.some(srv => !srv.isRunning);

      // Track whether servers are running on the system object
      system.serversRunning = !anyStopped;

      // If all servers are stopped — auto-start on page load, otherwise show power button
      if (allStopped) {
        system.connected = false;
        data.servers.forEach((srv, index) => {
          // Only log if this is a state change
          if (system.servers[index]?.lastStatus !== 'stopped') {
            autoUpdateConsole(system, "launcherStatus", `${srv.name}: stopped`, "warning");
            if (system.servers[index]) system.servers[index].lastStatus = 'stopped';
          }
        });

        if (autoStart && system.name === "Local Host") {
          autoUpdateConsole(system, "autoStart", "Servers stopped — auto-starting...");
          startAndCheckServers(system);
          return;
        }

        updateSystemUI(system);
        return;
      }

      // Ping each running server to verify it's actually responding
      data.servers.forEach((srv, index) => {
        if (!srv.isRunning) {
          // Only log stopped as warning if it's a state change
          if (system.servers[index]?.lastStatus !== 'stopped') {
            autoUpdateConsole(system, "launcherStatus", `${srv.name}: stopped`, "warning");
            if (system.servers[index]) system.servers[index].lastStatus = 'stopped';
          }
        }

        if (srv.isRunning) {
          const port = srv.port || (index === 0 ? system.deviceServerPort : system.compositingServerPort);
          const serverUrl = index === 0 ? deviceServerUrl : compositingServerUrl;
          const serverEndpoint = `http://${system.ip}:${port}/${serverUrl}`;
          pingServerStatus(system, index, serverEndpoint);
        } else {
          if (system.servers[index]) {
            system.servers[index].status = 'stopped';
          }
        }
      });

      updateSystemUI(system);
    })
    .catch((err) => {
      if (err.name === "AbortError") {
        autoUpdateConsole(system, "getLauncherStatus", "Timed out contacting launcher", "error");
      } else {
        autoUpdateConsole(system, "getLauncherStatus", "Failed to contact launcher — connection error", "error");
      }
    });
}

// Starts servers via the launcher, then verifies device server is up before checking compositor
function startAndCheckServers(system) {
  if (!system) return;

  // Suppress regular status pings while connecting
  system.isConnecting = true;

  autoUpdateConsole(system, "startServers", "Starting servers...");

  startLauncherServers(system).then(() => {
    autoUpdateConsole(system, "startServers", "Waiting for tracking driver...");

    // Poll for the device server (index 0) to come online first
    let attempts = 0;
    const maxAttempts = 10;
    const pollInterval = 1500;

    const waitForDeviceServer = () => {
      attempts++;
      const devicePort = system.deviceServerPort;
      const deviceEndpoint = `http://${system.ip}:${devicePort}/${deviceServerUrl}`;

      fetchWithTimeout(deviceEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ command: "getServerStatus" }),
      }, 3000)
        .then(r => r.json())
        .then(data => {
          if (data?.status === "Success") {
            autoUpdateConsole(system, "startServers", "Tracking driver is online ✓");
            system.connected = true;
            activeSystems.add(system.name);
            updateSystemWithJsonData(system, data);

            // Now wait a moment then check full launcher status (including compositor)
            autoUpdateConsole(system, "startServers", "Waiting for compositor...");
            setTimeout(() => {
              getLauncherStatus(system);
              // Resume regular pings after a delay
              setTimeout(() => { system.isConnecting = false; }, pingResumeDelayAfterConnect);
            }, 1500);
          } else if (attempts < maxAttempts) {
            setTimeout(waitForDeviceServer, pollInterval);
          } else {
            autoUpdateConsole(system, "startServers", "Tracking driver did not respond in time", "warning");
            getLauncherStatus(system);
            setTimeout(() => { system.isConnecting = false; }, pingResumeDelayAfterConnect);
          }
        })
        .catch(() => {
          if (attempts < maxAttempts) {
            setTimeout(waitForDeviceServer, pollInterval);
          } else {
            autoUpdateConsole(system, "startServers", "Tracking driver did not respond in time", "warning");
            getLauncherStatus(system);
            setTimeout(() => { system.isConnecting = false; }, pingResumeDelayAfterConnect);
          }
        });
    };

    // Give the launcher a moment to kick things off, then start polling
    setTimeout(waitForDeviceServer, 1500);
  });
}

// Ping individual server to get its status
// Ping individual server to get its status
function pingServerStatus(system, serverIndex, endpoint) {
  // Safety check - make sure servers array exists and has this index
  if (!system.servers || !system.servers[serverIndex]) {
    console.warn(`Server index ${serverIndex} doesn't exist for ${system.name}`);
    return;
  }

  const serverName = system.servers[serverIndex].name;
  console.log(`🔔 Pinging ${serverName} at ${endpoint} with command=getServerStatus`);

  fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "getServerStatus" }),
  }, 3000)
    .then((r) => {
      console.log(`✅ ${serverName} responded with status ${r.status}`);
      return r.json();
    })
    .then((data) => {
      console.log(`📦 ${serverName} data:`, data);
      
      // Re-check that server still exists (array might have changed)
      if (!system.servers || !system.servers[serverIndex]) {
        console.warn(`Server index ${serverIndex} no longer exists for ${system.name}`);
        return;
      }
      
      if (data?.status === "Success") {
        system.servers[serverIndex].status = 'online';
        system.servers[serverIndex].isRunning = true;

        // Only log if this is a new status change
        if (system.servers[serverIndex].lastStatus !== 'online') {
          autoUpdateConsole(system, "serverStatus", `${system.servers[serverIndex].name} is online ✓`);
          system.servers[serverIndex].lastStatus = 'online';
        }

        // Re-derive serversRunning from actual ping results
        const allOnline = system.servers.every(s => s.status === 'online' || s.isRunning);
        system.serversRunning = allOnline;

        // If this is the device server (index 0) and it's online, mark system as connected
        // and ALWAYS update device data (not just on first connection)
        if (serverIndex === 0) {
          system.connected = true;
          activeSystems.add(system.name);

          // Update with device data from the response - this refreshes device status
          updateSystemWithJsonData(system, data);

          // Update the UI to show the new device states
          updateSystemUI(system);
        }
      } else {
        system.servers[serverIndex].status = 'error';
        if (system.servers[serverIndex].lastStatus !== 'error') {
          autoUpdateConsole(system, "serverStatus", `${system.servers[serverIndex].name} responded with error`, "error");
          system.servers[serverIndex].lastStatus = 'error';
        }
      }
      updateSystemUI(system);
    })
    .catch((err) => {
      console.error(`❌ ${serverName} failed:`, err.name, err.message);
      
      // Re-check that server still exists
      if (!system.servers || !system.servers[serverIndex]) {
        return;
      }
      
      system.servers[serverIndex].status = 'offline';
      if (system.servers[serverIndex].lastStatus !== 'offline') {
        if (err.name === "AbortError") {
          autoUpdateConsole(system, "serverStatus", `${system.servers[serverIndex].name} timed out (no response after 3s)`, "error");
        } else {
          autoUpdateConsole(system, "serverStatus", `${system.servers[serverIndex].name} failed: ${err.message}`, "error");
        }
        system.servers[serverIndex].lastStatus = 'offline';
      }
      updateSystemUI(system);
    });
}

// SIMILAR TO SEND, but NOT RELATED TO BUTTONS (EX CHAT COMMANDS)
// TODO: CURRENTLY NOT VERY USEFUL, NEEDS FUTURE UPDATE
function sendConsoleCommand() {
  const input = document.getElementById("commandInput");
  const rawCommand = input.value.trim();
  if (!rawCommand) return;

  // Store in history and clear input
  commandHistory.unshift(rawCommand);
  commandHistoryIndex = -1;
  input.value = '';

  const isReset = rawCommand.toLowerCase() === "reset";

  if (isReset) {
    clearConsoleMessages();
    resetFilterCheckboxes(allSystems);
    localStorage.clear();
    updateInterface();
    return;
  }

  fetch(getDeviceServerEndpoint(system), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: rawCommand, target: currentSystem }),
  })
    .then((r) => r.json())
    .then((data) => {
      const targetSystem = allSystems.find((d) => d.name === currentSystem) || {
        name: currentSystem,
        connected: true,
        headset: 0,
        left: 0,
        right: 0,
        colorClass: "rig-0",
      };

      // If reset, refresh everything
      if (Array.isArray(data.systems)) {
        allSystems = normalizeSystems(data.systems);

        if (allSystems.length > 0) {
          allSystems[0].name = "Local Host";
          currentSystem = "Local Host";

          const label = document.getElementById("targetLabel");
          const currentSystem = allSystems.find(
            (d) => d.name === currentSystem
          );
          if (label && currentSystem) {
            label.textContent = `Target: ${currentSystem}`;
            label.style.color = getSystemColor(currentSystem);
          }
        }

        updateInterface();

        if (isReset) {
          clearConsoleMessages();
          resetFilterCheckboxes(allSystems);
          localStorage.clear();
          return;
        }
      }

      // Update system if backend gave updated state
      if (data.systemState) {
        const i = allSystems.findIndex((d) => d.name === system.name);
        if (i !== -1 && data.systemState) {
          allSystems[i] = { ...allSystems[i], ...data.systemState };
          updateSystemUI(allSystems[i]);
        }
        updateSystemUI(targetSystem);
      }

      // Log the response
      autoUpdateConsole(
        targetSystem,
        rawCommand,
        data.message || "No response"
      );
    })
    .catch((err) => {
      console.error("Command failed:", err);
    });

  input.value = "";
}

// Logs the "Nothing here yet.." message when console is empty
function logEmpty(consoleBox) {
  if (consoleBox.querySelector(".log-empty")) return;

  const emptyMsg = document.createElement("div");
  emptyMsg.className = "log-empty";
  emptyMsg.textContent = "Nothing here yet...";
  emptyMsg.style.color = "var(--text-muted)";
  emptyMsg.style.fontStyle = "italic";
  emptyMsg.style.padding = "0.25rem 0";
  consoleBox.appendChild(emptyMsg);
}

// Clears console when necesary
function clearConsoleMessages() {
  const consoleBox = document.getElementById("consoleOutput");
  if (consoleBox) {
    consoleBox.innerHTML = ""; // Full wipe
    logEmpty(consoleBox);
  }
}

// Resets the chat filter
function resetFilterCheckboxes(systems) {
  filterState.clear();
  systems.forEach((d) => filterState.add(d.name));
  updateFilterMenu();
}

// Add clickable boxes for the filter toggles
document.getElementById("filterToggle").addEventListener("click", (e) => {
  e.stopPropagation(); // Prevent click from bubbling to document
  const menu = document.getElementById("filterMenu");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
});

// Close filter menu when clicking outside
document.addEventListener("click", (e) => {
  const filterMenu = document.getElementById("filterMenu");
  const filterToggle = document.getElementById("filterToggle");
  
  // Close filter menu if clicking outside of it and the toggle button
  if (filterMenu && 
      filterMenu.style.display === "block" && 
      !filterMenu.contains(e.target) && 
      !filterToggle.contains(e.target)) {
    filterMenu.style.display = "none";
  }
  
  // Close action menu (existing behavior)
  const actionMenu = document.getElementById("actionMenu");
  if (actionMenu.classList.contains("visible")) {
    actionMenu.classList.remove("visible");
    actionMenu.innerHTML = "";
  }
});

// Updates the chat filter menu
// Update updateFilterMenu to ONLY add known systems
function updateFilterMenu() {
  const menu = document.getElementById("filterMenu");
  menu.innerHTML = "";

  // Only add checkboxes for actual systems in allSystems
  allSystems.forEach((system) => {
    const label = document.createElement("label");
    label.className = `filter-option ${system.colorClass} ${system.launcherAlive ? "connected" : "disconnected"}`;

    const labelText = document.createElement("span");
    labelText.className = "label-text";
    labelText.textContent = system.name;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = system.name;
    checkbox.checked = filterState.has(system.name);

    checkbox.onchange = () => {
      if (checkbox.checked) {
        filterState.add(system.name);
      } else {
        filterState.delete(system.name);
      }
      applyConsoleFilter();
    };

    label.appendChild(labelText);
    label.appendChild(checkbox);
    menu.appendChild(label);

    // Ensure it's tracked by default
    if (!filterState.has(system.name)) {
      filterState.add(system.name);
    }
  });
  
  // No "Other" option anymore - completely removed
}

// Filters chat based on filter menu
// Update applyConsoleFilter to only handle known systems
// Update applyConsoleFilter to only handle known systems
function applyConsoleFilter() {
  const entries = document.querySelectorAll(".log-entry");
  let visibleCount = 0;

  entries.forEach((entry) => {
    const label = entry.querySelector(".label");
    if (!label) return;

    const name = label.textContent.trim();
    
    // Only show if it's a known system AND it's in the filter
    const shouldShow = filterState.has(name);

    entry.style.display = shouldShow ? "block" : "none";
    if (shouldShow) visibleCount++;
  });

  // Update empty state message
  const consoleBox = document.getElementById("consoleOutput");
  const isEmpty = visibleCount === 0;

  if (isEmpty) {
    const existing = consoleBox.querySelector(".log-empty");
    if (!existing) {
      logEmpty(consoleBox);
    }
  } else {
    const existing = consoleBox.querySelector(".log-empty");
    if (existing) existing.remove();
  }
}

// Helper that updates GUI of entire website
function updateInterface() {
  updateDropdown();
  renderSystems(allSystems);
  updateButtonStates();
  updateFilterMenu();
  applyConsoleFilter();
  if (miniMonitorPopup && !miniMonitorPopup.closed) syncMiniMonitor();
}

//----------------------------------------------------------------------------
//----------------------------------------------------------------------------
// PAGE SETUP SECTION
//----------------------------------------------------------------------------
//----------------------------------------------------------------------------

// Initial Events on Page Load
document.addEventListener("DOMContentLoaded", () => {
  // Hide logo if showLogo is false
  if (!showLogo) {
    const logoLink = document.getElementById("Vrui-logo-link");
    if (logoLink) logoLink.style.display = "none";
  }

  const saved = localStorage.getItem("savedSystems");

  if (saved) {
    const baseSystems = JSON.parse(saved);
    allSystems = baseSystems.map((d, index) => ({
      name: d.name,
      ip: d.ip,
      serverLauncherPort: d.serverLauncherPort,
      deviceServerPort: d.deviceServerPort,
      compositingServerPort: d.compositingServerPort,
      connected: false,
      launcherAlive: false,
      servers: [],
      headset: 0,
      left: 0,
      right: 0,
      headset_connected: false,
      left_connected: false,
      right_connected: false,
      colorClass: `rig-${index % 6}`,
      devices: {},
    }));
  } else {
    // fallback if nothing is stored — hardcoded default system
    allSystems = [{
      name: "Local Host",
      ip: "127.0.0.1",
      serverLauncherPort: "8080",
      deviceServerPort: "8081",
      compositingServerPort: "8082",
      connected: false,
      launcherAlive: false,
      servers: [],
      devices: {},
      colorClass: "rig-0",
    }];
  }

  // ROBUST DEFAULT: Ensure index 0 exists and is "Local Host"
  if (allSystems.length === 0) {
    allSystems.push({
      name: "Local Host",
      ip: "127.0.0.1",
      serverLauncherPort: "8080",
      deviceServerPort: "8081",
      compositingServerPort: "8082",
      connected: false,
      launcherAlive: false,
      servers: [],
      devices: {},
      colorClass: "rig-0",
    });
  }

  // Force index 0 to be "Local Host"
  if (allSystems[0].name !== "Local Host") {
    allSystems[0].name = "Local Host";
  }

  // Update interface first to populate the dropdown and cards
  updateInterface();
  
  // THEN set the current system using changeSystem() to update everything
  changeSystem(allSystems[0].name);
  
  applyConsoleFilter();
  
  // Initialize dark mode toggle
  initDarkModeToggle();
  
  // Check if launcher is alive for all systems on page load
  allSystems.forEach((system) => {
    checkLauncherAlive(system);
  });
});

setInterval(() => {
  if (!getStatusUpdates) return;

  allSystems.forEach((system) => {
    if (!system.launcherAlive) return;
    if (system.isConnecting) return; // skip pings while connecting to servers

    const hasServers = system.servers && system.servers.length > 0;
    const anyRunning = hasServers && system.servers.some(srv => srv.isRunning);

    // If launcher is alive but no servers are running, or some servers are still
    // reported as stopped, re-check launcher status so stale isRunning flags get refreshed
    if (hasServers && (!anyRunning || !system.serversRunning)) {
      getLauncherStatus(system);
      return;
    }

    // Ping running servers
    if (hasServers) {
      system.servers.forEach((srv, index) => {
        if (srv.isRunning) {
          const port = srv.port || (index === 0 ? system.deviceServerPort : system.compositingServerPort);
          const serverUrl = index === 0 ? deviceServerUrl : compositingServerUrl;
          const serverEndpoint = `http://${system.ip}:${port}/${serverUrl}`;

          pingServerStatus(system, index, serverEndpoint);
        }
      });
    }
  });
}, getServerStatusInterval); // every certain amount of seconds

//----------------------------------------------------------------------------
//----------------------------------------------------------------------------
// DEVICE SELECTOR DROPDOWN
//----------------------------------------------------------------------------
//----------------------------------------------------------------------------

// Initialize device selector
function initDeviceSelector() {
  const deviceSelectorToggle = document.getElementById('deviceSelectorToggle');
  const deviceDropdown = document.getElementById('deviceDropdown');
  
  if (!deviceSelectorToggle || !deviceDropdown) {
    console.warn('Device selector elements not found');
    return;
  }
  
  // Toggle dropdown on click
  deviceSelectorToggle.addEventListener('click', function(e) {
    e.stopPropagation();
    deviceSelectorToggle.classList.toggle('active');
    deviceDropdown.classList.toggle('active');
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!deviceSelectorToggle.contains(e.target) && !deviceDropdown.contains(e.target)) {
      deviceSelectorToggle.classList.remove('active');
      deviceDropdown.classList.remove('active');
    }
  });
}

// Populate device dropdown with systems
function populateDeviceDropdown() {
  const deviceDropdown = document.getElementById('deviceDropdown');
  const deviceSelectorText = document.getElementById('deviceSelectorText');
  
  if (!deviceDropdown || !deviceSelectorText) {
    console.warn('Device selector elements not found');
    return;
  }
  
  // Clear existing items
  deviceDropdown.innerHTML = '';
  
  // Add each system as a dropdown item
  allSystems.forEach(system => {
    const item = document.createElement('div');
    item.className = 'device-dropdown-item';
    if (!system.launcherAlive) {
      item.classList.add('offline');
    }
    if (system.name === currentSystem) {
      item.classList.add('selected');
    }
    
    item.textContent = system.name;
    
    item.addEventListener('click', function() {
      // Update selected state
      document.querySelectorAll('.device-dropdown-item').forEach(el => {
        el.classList.remove('selected');
      });
      item.classList.add('selected');
      
      // Close dropdown
      document.getElementById('deviceSelectorToggle').classList.remove('active');
      deviceDropdown.classList.remove('active');
      
      // Call changeSystem which will update everything
      changeSystem(system.name);
    });
    
    deviceDropdown.appendChild(item);
  });
}

//----------------------------------------------------------------------------
//----------------------------------------------------------------------------
// DARK MODE TOGGLE
//----------------------------------------------------------------------------
//----------------------------------------------------------------------------

// Initialize dark mode toggle
function initDarkModeToggle() {
  const toggle = document.querySelector('.theme-toggle');
  if (!toggle) return;
  
  // Load saved theme preference
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    toggle.classList.add('dark');
  }
  
  // Toggle theme on click
  toggle.addEventListener('click', () => {
    const isDark = toggle.classList.contains('dark');
    
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'light');
      toggle.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      toggle.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  });
}

// ============================================================
// MINI MONITOR POPUP
// ============================================================

// ============================================================
// MINI MONITOR POPUP
// ============================================================

let miniMonitorPopup = null;
let miniMonitorSyncId = null;

function openMiniMonitor() {
  // If already open, focus it
  if (miniMonitorPopup && !miniMonitorPopup.closed) {
    miniMonitorPopup.focus();
    return;
  }

  const screenW = window.screen.availWidth;
  // Scale card width based on screen resolution (accounts for OS scaling via CSS px)
  const cardW = screenW >= 3840 ? 340 : screenW >= 2560 ? 300 : screenW >= 1920 ? 270 : 250;
  const popH  = screenW >= 3840 ? 420 : screenW >= 2560 ? 370 : screenW >= 1920 ? 330 : 300;
  const cardGap = 16;
  const popPadding = 24;
  const numSystems = allSystems.length;
  const popW = Math.min(Math.max(numSystems * cardW + (numSystems - 1) * cardGap + popPadding + 2, 270), screenW - 40);
  const popLeft = screenW - popW - 20;
  const popTop = 40;

  miniMonitorPopup = window.open(
    "",
    "VruiMiniMonitor",
    `width=${popW},height=${popH},top=${popTop},left=${popLeft},resizable=yes,scrollbars=yes`
  );

  if (!miniMonitorPopup) {
    alert("Popup was blocked. Please allow popups for this site.");
    return;
  }

  const currentTheme =
    document.documentElement.getAttribute("data-theme") || "light";

  miniMonitorPopup.document.write(`
    <!DOCTYPE html>
    <html lang="en" data-theme="${currentTheme}">
    <head>
      <meta charset="UTF-8">
      <title>Vrui Monitor</title>
      <link rel="stylesheet" href="css/main.css">
      <style>
        *, *::before, *::after { box-sizing: border-box; }

        body {
          margin: 0;
          padding: 0;
          background: var(--bg-white);
          height: 100vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display",
                       "SF Pro Text", "Inter", "Helvetica Neue", "Segoe UI",
                       system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          color: var(--text-dark);
        }

        /* Exact same scroll container as main page system-section */
        .mini-monitor-container {
          flex: 1;
          display: flex;
          flex-wrap: nowrap;
          gap: 16px;
          padding: 12px;
          overflow-x: hidden;
          overflow-y: hidden;
          align-items: stretch;
          min-height: 0;
          scrollbar-width: thin;
          scrollbar-color: var(--border) transparent;
        }

        .mini-monitor-container::-webkit-scrollbar { height: 8px; }
        .mini-monitor-container::-webkit-scrollbar-track { background: transparent; }
        .mini-monitor-container::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 4px;
        }
        .mini-monitor-container::-webkit-scrollbar-thumb:hover {
          background: var(--text-secondary);
        }

        /* Cards: width scaled to resolution, height fills the container */
        .system-card {
          width: ${cardW}px;
          min-width: ${cardW}px;
          height: auto;
          flex-shrink: 0;
          overflow: visible;
        }

        /* Hide add-system card, remove button, and entire shutdown container */
        .add-system-card { display: none !important; }
        .remove-btn { display: none !important; }
        .shutdown-container { display: none !important; }

        /* Keep the action menu working in the popup */
        .action-menu {
          position: fixed;
        }

        /* Tighter vertical spacing for the compact popup height */
        .card-header { margin-bottom: 0.1rem; min-height: unset; }
        .card-divider { margin: 0.2rem 0; }
        .server-section { padding: 0.45rem 0.65rem; margin-bottom: 0.25rem; }
        .device-section { padding: 0.45rem 0.65rem; }
        .section-title { margin-bottom: 0.25rem; }

        /* Make unreachable cards more compact in popup */
        .system-card.unreachable .unreachable-message {
          font-size: 0.7rem;
          padding: 12px 8px;
        }
      </style>
    </head>
    <body>
      <div id="popupActionMenu" class="action-menu hidden"></div>
      <div class="mini-monitor-container" id="miniContainer"></div>
      <script>
        window._miniMonitorReady = true;
      </script>
    </body>
    </html>
  `);
  miniMonitorPopup.document.close();

  // Wait for popup DOM to be ready, then start syncing
  const waitForReady = setInterval(() => {
    if (!miniMonitorPopup || miniMonitorPopup.closed) {
      clearInterval(waitForReady);
      return;
    }
    if (miniMonitorPopup._miniMonitorReady) {
      clearInterval(waitForReady);
      syncMiniMonitor();
      miniMonitorSyncId = setInterval(syncMiniMonitor, 400);

      // Close popup action menu on click outside
      miniMonitorPopup.document.addEventListener("click", () => {
        const popupMenu = miniMonitorPopup.document.getElementById("popupActionMenu");
        if (popupMenu && popupMenu.classList.contains("visible")) {
          popupMenu.classList.remove("visible");
          popupMenu.innerHTML = "";
        }
      });
    }
  }, 100);
}

function syncMiniMonitor() {
  if (!miniMonitorPopup || miniMonitorPopup.closed) {
    clearInterval(miniMonitorSyncId);
    miniMonitorPopup = null;
    miniMonitorSyncId = null;
    return;
  }

  const target = miniMonitorPopup.document.getElementById("miniContainer");
  const source = document.getElementById("systemContainer");
  if (!target || !source) return;

  // Keep theme in sync
  const theme =
    document.documentElement.getAttribute("data-theme") || "light";
  miniMonitorPopup.document.documentElement.setAttribute("data-theme", theme);

  // Map existing popup cards by system name
  const existingCards = new Map(
    [...target.children].map((c) => [c.dataset.system, c])
  );

  // Source cards (only .system-card, not .add-system-card)
  const sourceCards = [...source.querySelectorAll(".system-card")];
  const sourceNames = new Set();

  sourceCards.forEach((srcCard) => {
    const systemName = srcCard.dataset.system;
    if (!systemName) return;
    sourceNames.add(systemName);

    const existing = existingCards.get(systemName);

    if (existing) {
      // Only update DOM if something visually changed
      if (existing.innerHTML !== srcCard.innerHTML) {
        existing.innerHTML = srcCard.innerHTML;
      }
      existing.className = srcCard.className;
    } else {
      const clone = srcCard.cloneNode(true);
      target.appendChild(clone);
    }
  });

  // Remove cards no longer in source
  existingCards.forEach((card, name) => {
    if (!sourceNames.has(name)) card.remove();
  });

  // Re-bind all interactive handlers (cloneNode strips listeners)
  rebindMiniMonitorHandlers(target);

}

function rebindMiniMonitorHandlers(container) {
  container.querySelectorAll(".system-card").forEach((card) => {
    const systemName = card.dataset.system;
    if (!systemName) return;

    // Card click → select system in parent
    card.onclick = () => {
      changeSystem(systemName);
    };

    // Connect buttons (keep — useful for monitor)
    const connectHandler = (e) => {
      e.stopPropagation();
      const system = allSystems.find((s) => s.name === systemName);
      if (system) {
        autoUpdateConsole(system, "isAlive", "Attempting to contact launcher...");
        checkLauncherAlive(system, true);
      }
    };
    const connectIcon = card.querySelector(".connect-btn-wrap");
    if (connectIcon) connectIcon.onclick = connectHandler;
    const connectAction = card.querySelector(".connect-action");
    if (connectAction) connectAction.onclick = connectHandler;

    // Device name clicks → action menu in popup window
    card.querySelectorAll(".device-name:not(.inactive-field)").forEach((nameEl) => {
      nameEl.style.cursor = "pointer";
      nameEl.onclick = (e) => {
        e.stopPropagation();
        const system = allSystems.find((s) => s.name === systemName);
        if (system) {
          const deviceKey = nameEl.textContent.trim().toLowerCase();
          showEditMenu(e, system, deviceKey, miniMonitorPopup);
        }
      };
    });

    // Device item clicks → select system
    card.querySelectorAll(".device-item").forEach((item) => {
      item.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (currentSystem !== systemName) {
          changeSystem(systemName);
        }
      };
    });
  });
}
let allSystems = [];
let currentSystem = "";
let hasConnected = false;

const filterState = new Set();
const lowBatteryWarnings = new Set();

const fileDropBox = document.querySelector(".file-drop-box");
const fileInput = document.getElementById("fileInput");

const getServerStatusInterval = 3000;

//LOAD DEFAULT CONFIG IN FILE FOR NOW
//TODO: FIND A BETTER OPTION
url = "VRDeviceServer.cgi";

fileDropBox.addEventListener("dragover", (e) => {
  e.preventDefault();
  fileDropBox.classList.add("dragover");
});

fileDropBox.addEventListener("dragleave", () => {
  fileDropBox.classList.remove("dragover");
});

fileDropBox.addEventListener("drop", (e) => {
  e.preventDefault();
  fileDropBox.classList.remove("dragover");

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
});

fileInput.addEventListener("change", () => {
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
    };
  });
}

//Saves systems to local storage
function saveSystemsToLocalStorage() {
  const toSave = allSystems.map((d) => ({
    name: d.name,
    ip: d.ip,
    port: d.port,
  }));
  localStorage.setItem("savedSystems", JSON.stringify(toSave));
}

// Gets the address of a system using the global url combined with the local data of the system
// ex): http://192.0.0.1:8080/ServerStatus.html
function getEndpoint(system) {
  return `http://${system.ip}:${system.port}/${url}`;
}

// Add system to list of systems
function addSystem() {
  const defaultName = `Rig ${String.fromCharCode(65 + allSystems.length)}`;
  const nameInput = window.prompt("Enter system name:", defaultName);
  const newName =
    nameInput && nameInput.trim() !== "" ? nameInput.trim() : defaultName;

  if (
    newName.toLowerCase() === "local host" ||
    newName.toLowerCase() === "localhost"
  ) {
    alert("The name 'Local Host' is reserved and cannot be used.");
    return;
  }

  const ipAddress = window.prompt(
    "Enter system IP address (e.g., 192.168.1.15):",
    "192.168.1.15"
  );
  const ip = ipAddress && ipAddress.trim() !== "" ? ipAddress.trim() : "";

  const systemPort = window.prompt("Enter system port (e.g., 8081):", "8081");
  const port = systemPort && systemPort.trim() !== "" ? systemPort.trim() : "";

  // Helper to create default device object
  function defaultDevice() {
    return {
      connected: false,
      tracked: false,
      battery: 0,
      hasBattery: false,
      canPowerOff: false,
      powerFeatureIndexes: [],
      hapticFeedbackIndexes: [],
      buttonsPressed: [],
      orientation: [],
      position: [],
    };
  }

  const newSystem = {
    name: newName,
    ip,
    port,
    connected: false,
    colorClass: `rig-${allSystems.length % 6}`,
    devices: {
    },
  };

  allSystems.push(newSystem);
  currentSystem = newName;
  updateInterface();
  autoUpdateConsole(newSystem, "add", `Added system '${newName}'`);

  saveSystemsToLocalStorage();
}

// Remove system from list of systems
// Protects the Local Host from deletion
function removeSystem(systemName) {
  if (systemName === "Local Host") {
    alert("Cannot remove 'Local Host'. It is a protected system.");
    return;
  }

  const confirmed = confirm(`Are you sure you want to remove "${systemName}"?`);
  if (!confirmed) return;

  allSystems = allSystems.filter((d) => d.name !== systemName);
  if (currentSystem === systemName) {
    currentSystem = "Local Host";
  }
  updateInterface();
  autoUpdateConsole(
    { name: systemName },
    "remove",
    `System '${systemName}' removed.`
  );

  saveSystemsToLocalStorage();
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

  const label = document.getElementById("targetLabel");
  label.textContent = `Target: ${name}`;

  const system = allSystems.find((d) => d.name === name);
  if (system) {
    label.style.color = getSystemColor(system);
  }
}

// Handles dropdown for changing systems
function updateDropdown() {
  const dropdown = document.getElementById("systemSelect");
  dropdown.innerHTML = "";
  allSystems.forEach((system) => {
    const option = document.createElement("option");
    option.value = system.name;
    option.textContent = system.name;
    if (!system.connected) option.className = "offline";
    if (system.name === currentSystem) option.selected = true;
    dropdown.appendChild(option);
  });
}

// Updates button logic based on the state
// Subject to heavy logic change as buttons change
function updateButtonStatesFor(system) {
  const connected = system.connected;
  const headsetConnected = system.headset_connected;
  const leftConnected = system.left_connected;
  const rightConnected = system.right_connected;
  const anyControllersConnected = leftConnected || rightConnected;
  const allControllersConnected = leftConnected && rightConnected;

  document.getElementById("btn-vrtracker").disabled = connected;
  document.getElementById("btn-headset").disabled =
    !connected || headsetConnected;
  document.getElementById("btn-connect").disabled =
    !headsetConnected || allControllersConnected;
  document.getElementById("btn-disconnect").disabled = !(
    headsetConnected ||
    leftConnected ||
    rightConnected
  );
  document.getElementById("btn-shutdown").disabled = !connected;
  document.getElementById("btn-restart").disabled = !connected;
  document.getElementById("btn-run").disabled = !headsetConnected;
}

// Updates the UI for the system widgets
function updateSystemUI(updatedSystem) {
  // 1) find the right .system-card
  const cards = document.querySelectorAll(".system-card");
  let systemCard = null;
  cards.forEach((c) => {
    if (
      c.querySelector(".system-name .label-text")?.textContent ===
      updatedSystem.name
    ) {
      systemCard = c;
    }
  });
  if (!systemCard) return;

  // 2) grab its battery rows
  const batteryRows = systemCard.querySelectorAll(".battery-row");

  // 3) update battery percentages using .devices
  if (!batteryRows[0]) return;

  // Headset
  const hs = batteryRows[0].querySelector(".battery-percent");
  if (hs) {
    const battery = updatedSystem.devices?.headset?.battery ?? -1;
    hs.textContent = battery >= 0 ? `${battery}%` : "--";
    hs.classList.toggle("zero", battery === 0);
  }

  // Left controller
  const lf = batteryRows[1]?.querySelector(".battery-percent");
  if (lf) {
    const battery = updatedSystem.devices?.left?.battery ?? -1;
    lf.textContent = battery >= 0 ? `${battery}%` : "--";
    lf.classList.toggle("zero", battery === 0);
  }

  // Right controller
  const rt = batteryRows[2]?.querySelector(".battery-percent");
  if (rt) {
    const battery = updatedSystem.devices?.right?.battery ?? -1;
    rt.textContent = battery >= 0 ? `${battery}%` : "--";
    rt.classList.toggle("zero", battery === 0);
  }

  // 4) update connected/disconnected styling
  if (updatedSystem.connected) {
    systemCard.classList.remove("disconnected");
  } else {
    systemCard.classList.add("disconnected");
  }

  // 5) and update the target label color
  changeTargetColor(updatedSystem.name);

  // 6) Update button availability based on current system state
  if (updatedSystem.name === currentSystem) {
    updateButtonStatesFor(updatedSystem);
  }
}

// Updates console with new message
function autoUpdateConsole(system, command, message) {
  const consoleBox = document.getElementById("consoleOutput");

  // OLD VERSION (worked fine but chatGPT insists new version is better)
  // const isAtBottom =
  //   consoleBox.scrollHeight - consoleBox.clientHeight <=
  //   consoleBox.scrollTop + 1;

  const isAtBottom =
    Math.abs(
      consoleBox.scrollHeight - consoleBox.scrollTop - consoleBox.clientHeight
    ) < 5;

  const logEntry = document.createElement("div");

  // Use latest system info to get colorClass
  const fullSystem = allSystems.find((d) => d.name === system.name) || system;
  const colorClass = fullSystem.colorClass;
  logEntry.className = `log-entry ${colorClass}`;

  const isOffline = !fullSystem.connected;

  // Maybe useful?
  const isError = /error|failed|not connected|cannot/i.test(message);
  const isCritical = /battery low|crash|critical/i.test(message);

  if (isError) {
    logEntry.classList.add("log-error");
  }

  if (isCritical) {
    logEntry.classList.add("log-critical");
  }

  const systemName = `<span class="label">${fullSystem.name}</span>`;
  const offlineNote = isOffline
    ? ` <span class="offline">(offline)</span>`
    : "";

  logEntry.innerHTML = `${systemName}${offlineNote} - ${command}<br>${message}`;

  const labelEl = logEntry.querySelector(".label");
  if (labelEl) {
    labelEl.style.color = getSystemColor(fullSystem);
  }

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
  const targetLabel = document.getElementById("targetLabel");
  const system = allSystems.find((d) => d.name === systemName);
  if (system) {
    targetLabel.style.color = getSystemColor(system);
  }
}

// Renders the individual system widgets
function renderSystems(systems) {
  const container = document.getElementById("systemContainer");
  container.innerHTML = "";

  systems.forEach((system) => {
    const card = document.createElement("div");
    card.className = "system-card";

    // Connected state (based on hmd device if present)
    const isConnected = !!system.devices?.hmd?.connected;
    if (!isConnected) card.classList.add("disconnected");

    if (system.name === currentSystem) {
      const borderColor = getSystemColor(system);
      card.style.border = `2px solid ${borderColor}`;
      card.style.boxShadow = `0 0 6px ${borderColor}`;
    }

    card.onclick = () => changeSystem(system.name);

    // Header: name + remove button
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";

    const name = document.createElement("div");
    const statusClass = isConnected ? "connected" : "disconnected";
    name.className = `system-name ${statusClass}`;
    name.style.color = getSystemColor(system);
    name.style.display = "flex";
    name.style.flexDirection = "column";
    name.style.alignItems = "flex-start";
    name.style.gap = "0.1rem";

    const labelSpan = document.createElement("span");
    labelSpan.textContent = system.name;

    if (system.name !== "Local Host" && system.name === currentSystem) {
      labelSpan.style.cursor = "pointer";
      labelSpan.title = "Edit name";
      labelSpan.onclick = (e) => {
        e.stopPropagation();
        showEditMenu(e, system, "name");
      };
    } else {
      labelSpan.style.cursor = "default";
      labelSpan.title = "Select this system to edit";
    }

    const offlineSpan = document.createElement("span");
    if (!isConnected) {
      offlineSpan.textContent = " (offline)";
      offlineSpan.className = "offline";
      labelSpan.appendChild(offlineSpan);
    }

    // IP address below the name (contains port now)
    const ipSpan = document.createElement("span");
    ipSpan.style.fontSize = "0.6rem";
    ipSpan.style.color = "gray";
    ipSpan.style.opacity = "0.7";
    ipSpan.style.marginTop = "-2px";
    ipSpan.textContent = `${system.ip}:${system.port}`;

    if (system.name === currentSystem) {
      ipSpan.style.cursor = "pointer";
      ipSpan.title = "Edit IP/Port";
      ipSpan.onclick = (e) => {
        e.stopPropagation();
        showEditMenu(e, system, "ipport");
      };
    } else {
      ipSpan.style.cursor = "default";
      ipSpan.title = "Select this system to edit";
    }

    // Disable editing for non-selected systems
    if (system.name !== currentSystem) {
      labelSpan.classList.add("inactive-field");
      ipSpan.classList.add("inactive-field");
    }

    name.appendChild(labelSpan);
    name.appendChild(ipSpan);

    header.appendChild(name);

    if (system.name !== "Local Host") {
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.title = "Remove system";
      removeBtn.textContent = "x";
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        removeSystem(system.name);
      };
      header.appendChild(removeBtn);
    }

    card.appendChild(header);

    // Battery column → now fully dynamic
    const batteryColumn = document.createElement("div");
    batteryColumn.className = "battery-column";

    const deviceKeys = Object.keys(system.devices || {});
	deviceKeys.forEach((key) => {
	  const device = system.devices[key];

	  batteryColumn.appendChild(
		createBattery(
		  system,
		  key, // use raw device name as label
		  device?.battery ?? -1,
		  device?.connected || false,
		  device?.tracked || false,
		  device?.hasBattery || false
		)
	  );
	});

    card.appendChild(batteryColumn);
    container.appendChild(card);
  });
}

//creates battery widgets for the systems
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

    console.log(`[DEBUG] label click → label='${label}', field='${field}'`);

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

// Helper function to make the action menu visible
function makeMenuVisible(menu) {
  menu.classList.remove("hidden");
  void menu.offsetWidth;
  menu.classList.add("visible");
}

// Sends a haptic tick command to the system
function sendHapticTick(system, deviceName, featureIndex) {
  if (!system) {
    console.warn(`System not found.`);
    return;
  }

  const device = system.devices?.[deviceName];
  if (!device) {
    console.warn(`Device '${deviceName}' not found in system '${system.name}'.`);
    return;
  }

  if (
    !device.hapticFeedbackIndexes ||
    device.hapticFeedbackIndexes.length === 0
  ) {
    console.warn(
      `Device '${deviceName}' in '${system.name}' has no haptic feedback features.`
    );
    return;
  }

  if (!device.hapticFeedbackIndexes.includes(featureIndex)) {
    console.warn(
      `Feature index ${featureIndex} not available in device '${deviceName}' in '${system.name}'.`
    );
    return;
  }

  const endpoint = getEndpoint(system);

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
      const msg = `Sent haptic tick to '${deviceName}' (featureIndex=${featureIndex})`;
      autoUpdateConsole(system, "hapticTick", data.message || msg);
    })
    .catch((err) => {
      console.error(`HapticTick to '${deviceName}' in ${system.name} failed:`, err);
      autoUpdateConsole(system, "hapticTick", "Failed to send command");
    });
}

//Power off command function
function sendPowerOff(system, deviceName, featureIndex) {
  if (!system) {
    console.warn(`System not found.`);
    return;
  }

  const device = system.devices?.[deviceName];
  if (!device) {
    console.warn(`Device '${deviceName}' not found in system '${system.name}'.`);
    return;
  }

  if (
    !device.powerFeatureIndexes ||
    device.powerFeatureIndexes.length === 0
  ) {
    console.warn(
      `Device '${deviceName}' in '${system.name}' has no power off features.`
    );
    return;
  }

  if (!device.powerFeatureIndexes.includes(featureIndex)) {
    console.warn(
      `Feature index ${featureIndex} not available in device '${deviceName}' in '${system.name}'.`
    );
    return;
  }

  const endpoint = getEndpoint(system);

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
      const msg = `Sent power off to '${deviceName}' (featureIndex=${featureIndex})`;
      autoUpdateConsole(system, "powerOff", data.message || msg);
    })
    .catch((err) => {
      console.error(`PowerOff to '${deviceName}' in ${system.name} failed:`, err);
      autoUpdateConsole(system, "powerOff", "Failed to send command");
    });
}

// Lets user edit system info
function showEditMenu(e, system, field) {
  e.stopPropagation();

  const menu = document.getElementById("actionMenu");
  menu.innerHTML = "";

  console.log("========== showEditMenu ==========");
  console.log(`[DEBUG] System: '${system.name}'`);
  console.log(`[DEBUG] Field: '${field}'`);
  console.log(`[DEBUG] Devices:`, Object.keys(system.devices || {}));

  // Reset for re-render
  makeMenuVisible(menu);

  const available = [];

  if (field === "name" && system.name !== "Local Host") {
	console.log("[DEBUG] Adding action: Rename");
	available.push("Rename");
  } else if (field === "ipport") {
	if (system.name === "Local Host") {
		console.log("[DEBUG] Adding actions: Change Port");
		available.push("Change Port");
	}
    else {
		console.log("[DEBUG] Adding actions: Change IP, Change Port");
		available.push("Change IP", "Change Port");
	}
  } else {
    // Treat as device if exists
    const device = system.devices?.[field];
    if (device && device.connected) {
      console.log("[DEBUG] Device found:", device);

      if (device.hapticFeedbackIndexes?.length > 0) {
        console.log("[DEBUG] Device supports: Ping");
        available.push("Ping");
      } else {
        console.log("[DEBUG] Device has NO hapticFeedbackIndexes.");
      }

      if (device.canPowerOff) {
        console.log("[DEBUG] Device supports: Power Off");
        available.push("Power Off");
      } else {
        console.log("[DEBUG] Device has NO canPowerOff.");
      }

    } else {
      console.log(`[DEBUG] No matching device for field='${field}'`);
    }
  }

  console.log(`[DEBUG] Final available actions:`, available);

  // Build buttons or show empty state
  if (available.length === 0) {
    console.log("[DEBUG] No actions available - showing empty notice.");
    const emptyNotice = document.createElement("div");
    emptyNotice.textContent = "No actions available";
    emptyNotice.style.padding = "0.5rem";
    emptyNotice.style.fontSize = "0.8rem";
    emptyNotice.style.color = "gray";
    menu.appendChild(emptyNotice);
  } else {
    console.log(`[DEBUG] Building ${available.length} button(s).`);
    available.forEach((action) => {
      console.log(`[DEBUG] Creating button: ${action}`);
      const btn = document.createElement("button");
      btn.textContent = action;

      btn.onclick = () => {
        console.log(`[DEBUG] Button clicked: ${action}`);
        menu.classList.add("hidden");

        switch (action) {
          case "Rename":
            renameSystem(system);
            break;
          case "Change IP":
            changeIP(system);
            break;
          case "Change Port":
            changePort(system);
            break;
          case "Ping": {
            const device = system.devices?.[field];
            const featureIndex = device?.hapticFeedbackIndexes?.[0];
            if (featureIndex != null) {
              console.log(`[DEBUG] Sending Ping (featureIndex=${featureIndex})`);
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
              console.log(`[DEBUG] Sending Power Off (powerIndex=${powerIndex})`);
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

  // Position menu
  const rect = e.target.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY}px`;
  menu.style.left = `${rect.left + window.scrollX}px`;

  console.log(`[DEBUG] Menu positioned at top=${menu.style.top}, left=${menu.style.left}`);
  console.log("===================================");
}


// Functions to change info about a system
function renameSystem(system) {
  const newName = window.prompt("New name:", system.name);
  if (newName && newName.trim()) {
    system.name = newName.trim();
    saveSystemsToLocalStorage();
    updateInterface();
  }
}

function changeIP(system) {
  const newIP = window.prompt("New IP address:", system.ip);
  if (newIP && newIP.trim()) {
    system.ip = newIP.trim();
    saveSystemsToLocalStorage();
    updateInterface();
  }
}

function changePort(system) {
  const newPort = window.prompt("New port:", system.port);
  if (newPort && newPort.trim()) {
    system.port = newPort.trim();
    saveSystemsToLocalStorage();
    updateInterface();
  }
}

function sendCustomCommandTo(target, command) {
  fetch(getEndpoint(target), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command, target }),
  })
    .then((r) => r.json())
    .then((data) => {
      autoUpdateConsole({ name: target }, command, data.message || "Sent.");
    });
}

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

	console.log(JSON.stringify(system, null, 2));
}

// Sends command to CORS
// Fetch requires CORS - server needs to have reply<<"Access-Control-Allow-Origin: *\n";
function send(command, systemName = currentSystem) {
  console.log(`Command: ${command}`);
  console.log(`System: ${systemName}`);
  const system = allSystems.find((d) => d.name === systemName);
  if (!system) return;

  const buttonMap = {
    vrtracker_on: "btn-vrtracker",
    headset: "btn-headset",
    connect: "btn-connect",
    disconnect: "btn-disconnect",
    restart: "btn-restart",
    shutdown: "btn-shutdown",
    run: "btn-run",
  };

  const btnId = buttonMap[command];
  const button = btnId ? document.getElementById(btnId) : null;

  if (button) {
    button.disabled = true;
    button._originalText = button.textContent;
    button.textContent = "Loading...";
  }

  const endpoint = getEndpoint(system);

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command }),
  })
    .then((r) => r.json())
    .then((data) => {
      const i = allSystems.findIndex((d) => d.name === system.name);
      if (i === -1) return;

      if (command === "getServerStatus") {
        updateSystemWithJsonData(allSystems[i], data);
        const normalized = normalizeSystems(allSystems);
		//console.log("Normalized systems:\n", JSON.stringify(normalized, null, 2));
        // Mark as online
        allSystems[i].lastSeen = Date.now();

        updateSystemUI(allSystems[i]);
        autoUpdateConsole(system, command, data.message || "Status updated.");
      } else {
        // For any other command, just log the result
        autoUpdateConsole(system, command, data.message || "Command sent.");
      }
    })
    .catch((err) => {
      console.error(`Send to ${system.name} failed:`, err);
      autoUpdateConsole(system, command, "Failed to send command");
    })
    .finally(() => {
      if (button) {
        button.disabled = false;
        button.textContent = button._originalText;
      }
    });
}

// SIMILAR TO SEND, but NOT RELATED TO BUTTONS (EX CHAT COMMANDS)
function sendConsoleCommand() {
  const input = document.getElementById("commandInput");
  const rawCommand = input.value.trim();
  if (!rawCommand) return;

  const isReset = rawCommand.toLowerCase() === "reset";

  if (isReset) {
    clearConsoleMessages();
    resetFilterCheckboxes(allSystems);
    localStorage.clear();
    updateInterface();
    return;
  }

  fetch(getEndpoint(system), {
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
document.getElementById("filterToggle").addEventListener("click", () => {
  const menu = document.getElementById("filterMenu");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
});

// Add click event for the edit system popups
document.addEventListener("click", () => {
  const menu = document.getElementById("actionMenu");
  if (menu.classList.contains("visible")) {
    menu.classList.remove("visible");
    setTimeout(() => {
      menu.innerHTML = "";
    }, 150); // Matches CSS transition
  }
});

// Updates the chat filter menu
function updateFilterMenu() {
  const menu = document.getElementById("filterMenu");
  menu.innerHTML = "";

  allSystems.forEach((system) => {
    const label = document.createElement("label");
    label.className = `filter-option ${system.colorClass} ${
      system.connected ? "connected" : "disconnected"
    }`;

    const labelText = document.createElement("span");
    labelText.className = "label-text";
    labelText.textContent = system.name;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = system.name;

    // ✅ If system not in filter, add it (default ON)
    if (!filterState.has(system.name)) {
      filterState.add(system.name);
    }

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
  });
}

// Filters chat based on filter menu
function applyConsoleFilter() {
  const entries = document.querySelectorAll(".log-entry");
  let visibleCount = 0;

  entries.forEach((entry) => {
    const label = entry.querySelector(".label");
    if (!label) return;
    const name = label.textContent.trim();
    const shouldShow = filterState.has(name);
    entry.style.display = shouldShow ? "block" : "none";
    if (shouldShow) visibleCount++;
  });

  // ✅ Update empty state message
  const consoleBox = document.getElementById("consoleOutput");
  const isEmpty = visibleCount === 0;

  if (isEmpty) {
    logEmpty(consoleBox);
  } else {
    const existing = consoleBox.querySelector(".log-empty");
    if (existing) existing.remove();
  }
}

// Updates the states of the main buttons
function updateButtonStates() {
  const system = allSystems.find((d) => d.name === currentSystem);
  if (system) updateButtonStatesFor(system);
}

// Helper that updates GUI of entire website
function updateInterface() {
  updateDropdown();
  renderSystems(allSystems);
  updateButtonStates();
  updateFilterMenu();
  applyConsoleFilter();
}

//----------------------------------------------------------------------------
//----------------------------------------------------------------------------
// PAGE SETUP SECTION
//----------------------------------------------------------------------------
//----------------------------------------------------------------------------

// Initial Events on Page Load
document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("savedSystems");

  if (saved) {
    const baseSystems = JSON.parse(saved);
    allSystems = baseSystems.map((d, index) => ({
      name: d.name,
      ip: d.ip,
      port: d.port,
      connected: false,
      headset: 0,
      left: 0,
      right: 0,
      headset_connected: false,
      left_connected: false,
      right_connected: false,
      colorClass: `rig-${index % 6}`,
    }));

    currentSystem = allSystems[0]?.name || "";
    const label = document.getElementById("targetLabel");
    if (label && currentSystem) {
      label.textContent = `Target: ${currentSystem}`;
      changeTargetColor(currentSystem);
    }

    updateInterface();
    applyConsoleFilter();
    send("getServerStatus", currentSystem);
  } else {
    // fallback if nothing is stored — hardcoded default system
    const baseSystems = [
      {
        name: "Local Host",
        ip: "127.0.0.1",
        port: "8081",
      },
    ];

    allSystems = baseSystems.map((d, index) => ({
      name: d.name,
      ip: d.ip,
      port: d.port,
      connected: false,
      devices: {},
      colorClass: `rig-${index % 6}`,
    }));

    if (allSystems.length) {
      currentSystem = allSystems[0].name;
      const label = document.getElementById("targetLabel");
      if (label) {
        label.textContent = `Target: ${currentSystem}`;
        changeTargetColor(currentSystem);
      }
    }

    updateInterface();
    applyConsoleFilter();
    send("getServerStatus", currentSystem);
  }
});


setInterval(() => {
  const now = Date.now();

  allSystems.forEach((system) => {
    // If system was recently updated, keep it online
    if (
      system.lastSeen &&
      now - system.lastSeen > getServerStatusInterval * 2
    ) {
      // Timeout → mark as offline
      if (system.connected !== false) {
        console.warn(`⚠️ ${system.name} marked offline (timeout)`);

        system.connected = false;

        // Clear devices → when offline, show no devices
        system.devices = {};

        updateSystemUI(system);
        autoUpdateConsole(system, "timeout", "Marked as offline (no response)");
      }
    }

    // Always attempt to ping
    send("getServerStatus", system.name);
  });
}, getServerStatusInterval); // every certain amount of seconds

//void VRDeviceServer::newHttpConnectionCallback(Threads::EventDispatcher::IOEvent& event)
	//{
	//VRDeviceServer* thisPtr=static_cast<VRDeviceServer*>(event.getUserData());
	
	//try
		//{
		///* Allow valid commands to pass the CORS protocol */
		//bool sendCORS = false;
		///* Open a new TCP connection to the HTTP client: */
		//Comm::PipePtr pipe(thisPtr->httpListeningSocket->accept());
		
		///* Parse an HTTP POST request: */
		//Comm::HttpPostRequest request(*pipe);
		//const Comm::HttpPostRequest::NameValueList& nvl=request.getNameValueList();
		
		///* Check that there is a command in the POST request: */
		//if(request.getActionUrl()=="/VRDeviceServer.cgi"&&nvl.size()>=1&&nvl.front().name=="command")
			//{
			///* Compose the server's reply as a JSON-encoded object: */
			//IO::JsonPointer replyRoot;
			
			///* Process the command: */
			//if(nvl.front().value=="getServerStatus")
				//{
				///* Compose the JSON object representing the current server state: */
				//replyRoot=thisPtr->getServerStatus();
				//sendCORS = true;
				//}
			//else if(nvl.front().value=="getDeviceStates")
				//{
				//}
			//else if(nvl.front().value=="hapticTick"&&nvl.size()>1&&nvl[1].name=="hapticFeatureIndex")
				//{
				///* Extract the haptic feature index: */
				//unsigned int hapticFeatureIndex(strtoul(nvl[1].value.c_str(),0,10));
				
				///* Extract optional haptic tick duration, frequency, and amplitude: */
				//unsigned int duration=100;
				//unsigned int frequency=100;
				//unsigned int amplitude=255;
				//for(unsigned int i=2;i<nvl.size();++i)
					//{
					//if(nvl[i].name=="duration")
						//duration=(unsigned int)(strtoul(nvl[i].value.c_str(),0,10));
					//else if(nvl[i].name=="frequency")
						//frequency=(unsigned int)(strtoul(nvl[i].value.c_str(),0,10));
					//else if(nvl[i].name=="amplitude")
						//amplitude=Math::clamp((unsigned int)(strtoul(nvl[i].value.c_str(),0,10)),0U,255U);
					//}
				
				///* Request a haptic tick: */
				//if(hapticFeatureIndex<thisPtr->deviceManager->getNumHapticFeatures())
					//thisPtr->deviceManager->hapticTick(hapticFeatureIndex,duration,frequency,amplitude);
				
				//IO::JsonObjectPointer replyObject = new IO::JsonObject;
				//replyObject->setProperty("status", "success");
				//replyObject->setProperty("message", "Haptic tick sent.");

				//// Now assign it to replyRoot:
				//replyRoot = replyObject;
				//sendCORS = true;
				//}
				
			//else if(nvl.front().value=="powerOff"&&nvl.size()>=2&&nvl[1].name=="powerFeatureIndex")
				//{
				///* Extract the power feature index: */
				//unsigned int powerFeatureIndex(strtoul(nvl[1].value.c_str(),0,10));
				
				///* Power off the device: */
				//if(powerFeatureIndex<thisPtr->deviceManager->getNumPowerFeatures())
					//thisPtr->deviceManager->powerOff(powerFeatureIndex);
				
				//replyRoot = new IO::JsonObject;
				//sendCORS = true;
				//}
				
			///* Send the server's reply as a json file embedded in an HTTP reply: */
			//IO::OStream reply(pipe);
			//reply << "HTTP/1.1 200 OK\n";
			//if(replyRoot != 0)
			//{
				//reply << "Content-Type: application/json\n";
			//}

			//if(sendCORS)
			//{
				//reply << "Access-Control-Allow-Origin: *\n";
			//}

			//reply << "\n";

			//if(replyRoot != 0)
				//reply << *replyRoot;

			//reply << std::endl;
			
			///* Send the reply: */
			//pipe->flush();
			//}
		//}
	//catch(const std::runtime_error& err)
		//{
		//#ifdef VERBOSE
		//// printf("VRDeviceServer: Ignoring HTTP request due to exception %s\n",err.what());
		//// fflush(stdout);
		//#endif
		//}
	//}

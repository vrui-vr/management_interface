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

let getStatusUpdates = true;   // global flag (default ON)

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
    // Start servers on current system
    const system = allSystems.find((d) => d.name === currentSystem);
    if (system) {
      autoUpdateConsole(system, "startServers", "Manually starting servers...");
      startLauncherServers(system);
      // Wait a bit then check status
      setTimeout(() => {
        getLauncherStatus(system);
      }, 2000);
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
// CURRENTLY NOT USED
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

  const launcherPortInput = window.prompt("Enter ServerLauncher port (default: 8080):", "8080");
  const serverLauncherPort = launcherPortInput && launcherPortInput.trim() !== "" ? launcherPortInput.trim() : "8080";

  const devicePortInput = window.prompt("Enter VRDeviceServer port (default: 8081):", "8081");
  const deviceServerPort = devicePortInput && devicePortInput.trim() !== "" ? devicePortInput.trim() : "8081";

  const compositingPortInput = window.prompt("Enter CompositingServer port (default: 8082):", "8082");
  const compositingServerPort = compositingPortInput && compositingPortInput.trim() !== "" ? compositingPortInput.trim() : "8082";

  const newSystem = {
    name: newName,
    ip,
    serverLauncherPort: serverLauncherPort,
    deviceServerPort: deviceServerPort,
    compositingServerPort: compositingServerPort,
    connected: false,
    launcherAlive: false,
    servers: [],
    colorClass: `rig-${allSystems.length % 6}`,
    devices: {},
  };

  allSystems.push(newSystem);
  currentSystem = newName;
  updateInterface();
  autoUpdateConsole(newSystem, "add", `Added system '${newName}'`);

  saveSystemsToLocalStorage();
  
  // Check if launcher is alive
  checkLauncherAlive(newSystem);
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

  // If the removed system is currently selected, switch to Local Host
  if (currentSystem === systemName) {
    currentSystem = "Local Host";
    changeSystem("Local Host");
  }

  allSystems = allSystems.filter((d) => d.name !== systemName);
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
    if (!system.launcherAlive) option.className = "offline";
    if (system.name === currentSystem) option.selected = true;
    dropdown.appendChild(option);
  });
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

  // Grey out buttons 3-7
  for (let i = 3; i <= 7; i++) {
    const btn = document.getElementById(`btn-${i}`);
    if (btn) {
      btn.disabled = true;  // greyed out
    }
  }
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
}

// Updates console with new message
function autoUpdateConsole(system, command, message, severity = "") {
  const consoleBox = document.getElementById("consoleOutput");

  const isAtBottom =
    Math.abs(
      consoleBox.scrollHeight - consoleBox.scrollTop - consoleBox.clientHeight
    ) < 5;

  const logEntry = document.createElement("div");

  // Track whether this system is known
  const knownSystem = allSystems.find((d) => d.name === system.name);
  const isDeletedOrOther = !knownSystem;

  // Preserve original system name for the label
  const systemLabel = system.name || "Other";

  // Use system info if known, otherwise fallback style
  const fullSystem = knownSystem || {
    name: systemLabel,
    connected: false,
    colorClass: "rig-5", // default gray color
  };

  const colorClass = fullSystem.colorClass;
  const isOffline = !fullSystem.launcherAlive;

  logEntry.classList.add("log-entry", colorClass);

  // If deleted or truly "Other", mark for gray style
  if (isDeletedOrOther || fullSystem.name === "Other") {
    logEntry.classList.add("log-deleted");

    // Ensure it's trackable in filter
    if (!filterState.has(systemLabel)) {
      filterState.add(systemLabel);
      updateFilterMenu();
    }
  }

  // Apply severity tag if needed
  if (severity === "error") {
    logEntry.classList.add("log-error");
  } else if (severity === "critical") {
    logEntry.classList.add("log-critical");
  }

  // Label + (offline) badge
  const systemName = `<span class="label">${systemLabel}</span>`;
  const offlineNote = isOffline
    ? ` <span class="offline">(offline)</span>`
    : "";

  logEntry.innerHTML = `${systemName}${offlineNote} - ${command}<br>${message}`;

  // Apply system color to label
  const labelEl = logEntry.querySelector(".label");
  if (labelEl) {
    labelEl.style.color = getSystemColor(fullSystem);
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
  const targetLabel = document.getElementById("targetLabel");
  const system = allSystems.find((d) => d.name === systemName);
  if (system) {
    targetLabel.style.color = getSystemColor(system);
  }
}
  
// Formats the ports to be pretty printed
function formatPorts(p1, p2, p3) {
  // ensure numbers
  p1 = Number(p1);
  p2 = Number(p2);
  p3 = Number(p3);

  // check if consecutive
  if (p2 === p1 + 1 && p3 === p2 + 1) {
    return `${p1}-${p3}`;
  }

  // fallback
  return `${p1}/${p2}/${p3}`;
}

// Renders all systems, creating the containers for each
function renderSystems(systems) {
  const container = document.getElementById("systemContainer");
  container.innerHTML = "";

  systems.forEach((system) => {
    const card = document.createElement("div");
    card.className = "system-card";

    const isAlive = system.launcherAlive;
    if (!isAlive) card.classList.add("disconnected");

    if (system.name === currentSystem) {
      const borderColor = getSystemColor(system);
      card.style.borderColor = borderColor;
	  card.style.boxShadow = `0 0 6px ${borderColor}`;
    }

    card.onclick = () => changeSystem(system.name);

    // Header: name + remove button
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";

    const name = document.createElement("div");
    const statusClass = isAlive ? "connected" : "disconnected";
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
    if (!isAlive) {
      offlineSpan.textContent = " (offline)";
      offlineSpan.className = "offline";
      labelSpan.appendChild(offlineSpan);
    }

    const ipSpan = document.createElement("span");
    ipSpan.style.fontSize = "0.6rem";
    ipSpan.style.color = "gray";
    ipSpan.style.opacity = "0.7";
    ipSpan.style.marginTop = "-2px";

    ipSpan.textContent = `${system.ip}:${formatPorts(
      system.serverLauncherPort,
      system.deviceServerPort,
      system.compositingServerPort
    )}`;

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

    if (system.name !== currentSystem) {
      labelSpan.classList.add("inactive-field");
      ipSpan.classList.add("inactive-field");
    }

    name.appendChild(labelSpan);
    name.appendChild(ipSpan);
    
    // Add server status display right under IP (if launcher is alive)
    if (system.launcherAlive && system.servers && system.servers.length > 0) {
      const serversCompact = document.createElement("div");
      serversCompact.style.display = "flex";
      serversCompact.style.flexDirection = "column";
      serversCompact.style.gap = "0.1rem";
      serversCompact.style.marginTop = "0.25rem";

      system.servers.forEach((server, index) => {
        const serverLine = document.createElement("span");
        serverLine.style.fontSize = "0.65rem";
        serverLine.style.color = "#999";
        serverLine.style.opacity = "1";
        serverLine.style.fontWeight = "500";
        
        const port = index === 0 ? system.deviceServerPort : system.compositingServerPort;
        
        // Determine status symbol and color
        let statusSymbol = "●";
        let statusColor = "gray";
        
        if (!server.isRunning) {
          statusColor = "#666";
        } else if (server.status === 'online') {
          statusColor = getSystemColor(system);
        } else if (server.status === 'offline' || server.status === 'error') {
          statusColor = "#ff6b6b";
        }
        
        serverLine.innerHTML = `<span style="color: ${statusColor}">${statusSymbol}</span> ${server.name} :${port}`;
        serversCompact.appendChild(serverLine);
      });

      name.appendChild(serversCompact);
    }
    
    header.appendChild(name);

    if (system.name !== "Local Host") {
      const removeBtn = document.createElement("button");
      removeBtn.className = `remove-btn ${system.colorClass}`;
      removeBtn.title = "Remove system";
      removeBtn.textContent = "x";
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        removeSystem(system.name);
      };
      header.appendChild(removeBtn);
    }

    card.appendChild(header);

    // Connect button if launcher not alive
    if (!system.launcherAlive) {
      const connectContainer = document.createElement("div");
      connectContainer.style.display = "flex";
      connectContainer.style.justifyContent = "center";
      connectContainer.style.alignItems = "center";
      connectContainer.style.height = "5rem";
      connectContainer.style.margin = "0.75rem 0";

      const connectBtn = document.createElement("button");
      connectBtn.className = `connect-btn ${system.colorClass}`;
      connectBtn.textContent = "Connect";
      connectBtn.onclick = (e) => {
        e.stopPropagation();
        autoUpdateConsole(system, "isAlive", "Attempting to contact launcher...");
        checkLauncherAlive(system, true);
      };

      connectContainer.appendChild(connectBtn);
      card.appendChild(connectContainer);
    }

    // Battery column (only if connected)
    if (system.connected) {
      const batteryColumn = document.createElement("div");
      batteryColumn.className = "battery-column";

      const deviceKeys = Object.keys(system.devices || {});
      deviceKeys.forEach((key) => {
        const device = system.devices[key];
        batteryColumn.appendChild(
          createBattery(
            system,
            key,
            device?.battery ?? -1,
            device?.connected || false,
            device?.tracked || false,
            device?.hasBattery || false
          )
        );
      });

      card.appendChild(batteryColumn);
    }

    // Shutdown button at bottom right if launcher is alive
    if (system.launcherAlive) {
      const shutdownContainer = document.createElement("div");
      shutdownContainer.style.display = "flex";
      shutdownContainer.style.justifyContent = "flex-end";
      shutdownContainer.style.alignItems = "center";
      shutdownContainer.style.padding = "0.25rem 0.5rem";
      shutdownContainer.style.marginTop = "auto";

      const shutdownBtn = document.createElement("button");
      shutdownBtn.classList.add("shutdown-icon", `rig-${system.colorClass.at(-1)}-muted`);
      shutdownBtn.title = "Shut down system";
      shutdownBtn.style.padding = "0.3rem";
      shutdownBtn.style.borderRadius = "4px";
      shutdownBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v10"/>
          <path d="M6.2 6.2a8 8 0 1 0 11.6 0"/>
        </svg>
      `;
      shutdownBtn.onclick = (e) => {
        e.stopPropagation();
        shutdownSystem(system);
      };

      shutdownContainer.appendChild(shutdownBtn);
      card.appendChild(shutdownContainer);
    }

    container.appendChild(card);
  });
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
  void menu.offsetWidth;
  menu.classList.add("visible");
}

// Lets user edit system info
function showEditMenu(e, system, field) {
  e.stopPropagation();

  const menu = document.getElementById("actionMenu");
  menu.innerHTML = "";

  // console.log("========== showEditMenu ==========");
  // console.log(`[DEBUG] System: '${system.name}'`);
  // console.log(`[DEBUG] Field: '${field}'`);
  // console.log(`[DEBUG] Devices:`, Object.keys(system.devices || {}));

  // Reset for re-render
  makeMenuVisible(menu);

  const available = [];

  if (field === "name" && system.name !== "Local Host") {
	// console.log("[DEBUG] Adding action: Rename");
	available.push("Rename");
  } else if (field === "ipport") {
	if (system.name === "Local Host") {
		// console.log("[DEBUG] Adding actions: Change Ports");
		available.push("Change Ports");
	}
    else {
		// console.log("[DEBUG] Adding actions: Change IP, Change Ports");
		available.push("Change IP", "Change Ports");
	}
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
          case "Change IP":
            changeIP(system);
            break;
          case "Change Ports":
            changePorts(system);
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

  // Position menu
  const rect = e.target.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY}px`;
  menu.style.left = `${rect.left + window.scrollX}px`;

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

// NEW: Check if launcher is alive
function checkLauncherAlive(system, shouldGetStatus = false) {
  if (!system) return;

  const endpoint = getServerLauncherEndpoint(system);
  
  console.log(`🔍 Checking launcher alive for ${system.name} at: ${endpoint}`);
  autoUpdateConsole(system, "isAlive", `Checking launcher at ${endpoint}...`);

  fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "isAlive" }),
  }, 3000)
    .then((r) => {
      console.log(`📡 Response status for ${system.name}:`, r.status, r.statusText);
      return r.json();
    })
    .then((data) => {
      console.log(`📦 Response data for ${system.name}:`, data);
      
      if (data?.isRunning === true) {
        system.launcherAlive = true;
        system.lastSeen = Date.now();
        
        autoUpdateConsole(system, "isAlive", "Launcher is alive ✓");
        
        // Start servers first, then get status
        autoUpdateConsole(system, "autoStart", "Starting servers...");
        startLauncherServers(system);
        
        // Wait for servers to start, then get status
        setTimeout(() => {
          getLauncherStatus(system);
        }, 2000);
      } else {
        system.launcherAlive = false;
        autoUpdateConsole(system, "isAlive", `Launcher responded but isRunning=${data?.isRunning}`, "error");
      }
      
      updateSystemUI(system);
    })
    .catch((err) => {
      system.launcherAlive = false;
      
      console.error(`❌ Full error details for ${system.name}:`, err);
      console.error(`Error name: ${err.name}`);
      console.error(`Error message: ${err.message}`);
      
      if (err.name === "AbortError") {
        console.error(`Timeout checking launcher on ${system.name}`);
        autoUpdateConsole(system, "isAlive", "Timed out contacting launcher (3 seconds)", "error");
      } else if (err.name === "TypeError" && err.message.includes("Failed to fetch")) {
        console.error(`Network error - possibly CORS or server not running`);
        autoUpdateConsole(system, "isAlive", "Network error - check if launcher is running and CORS is configured", "error");
      } else {
        console.error(`Failed to check launcher on ${system.name}:`, err);
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
  const newName = window.prompt("New name:", system.name);
  if (newName && newName.trim()) {
    system.name = newName.trim();
    saveSystemsToLocalStorage();
    updateInterface();
  }
}

// Change a system's IP
function changeIP(system) {
  const newIP = window.prompt("New IP address:", system.ip);
  if (newIP && newIP.trim()) {
    system.ip = newIP.trim();
    saveSystemsToLocalStorage();
    updateInterface();
  }
}

// Change a system's Ports
function changePorts(system) {
  const newServerLauncherPort = window.prompt("New ServerLauncher port:", system.serverLauncherPort || "8080");
  const newDeviceServerPort = window.prompt("New VRDeviceServer port:", system.deviceServerPort || "8081");
  const newCompositingServerPort = window.prompt("New CompositingServer port:", system.compositingServerPort || "8082");
  if (newCompositingServerPort && newCompositingServerPort.trim()) {
    system.compositingServerPort = newCompositingServerPort.trim();
  }
  if (newDeviceServerPort && newDeviceServerPort.trim()) {
    system.deviceServerPort = newDeviceServerPort.trim();
  }
  if (newServerLauncherPort && newServerLauncherPort.trim()) {
    system.serverLauncherPort = newServerLauncherPort.trim();
  }

  saveSystemsToLocalStorage();
  updateInterface();
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
function startLauncherServers(system) {
  if (!system) return;

  const endpoint = getServerLauncherEndpoint(system);

  fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "startServers" }),
  }, 3000)
    .then(() => {
      autoUpdateConsole(system, "startServers", "Start command sent to launcher.");
    })
    .catch((err) => {
      if (err.name === "AbortError") {
        console.error(`Timeout starting launcher servers on ${system.name}`);
        autoUpdateConsole(system, "startServers", "Timed out contacting launcher", "error");
      } else {
        console.error(`Failed to start servers on ${system.name}:`, err);
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

// Calls to the launcher to see status
function getLauncherStatus(system, skipAutoStart = false) {
  if (!system) return;

  const endpoint = getServerLauncherEndpoint(system);

  fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "getServerStatus" }),
  }, 3000)
    .then((r) => r.json())
    .then((data) => {
      autoUpdateConsole(system, "getLauncherStatus", "Received launcher status response.");

      // Store server information
      if (Array.isArray(data.servers)) {
        system.servers = data.servers.map(srv => ({
          ...srv,
          status: 'checking...', // Initial status while we check
          lastStatus: null  // Track last status to reduce log spam
        }));
        
        // Check if any servers are not running (only auto-start if not skipped)
        const anyServersStopped = data.servers.some(srv => !srv.isRunning);
        
        if (anyServersStopped && !skipAutoStart) {
          autoUpdateConsole(system, "autoStart", "Some servers stopped, starting servers...");
          startLauncherServers(system);
          // Wait a bit then check status again
          setTimeout(() => {
            getLauncherStatus(system, true); // Skip auto-start on retry
          }, 2000);
        } else {
          // All servers running (or we're skipping auto-start), ping them
          data.servers.forEach((srv, index) => {
            const msg = `${srv.name}: ${srv.isRunning ? "running" : "stopped"}${srv.pid ? ` (pid: ${srv.pid})` : ""}`;
            autoUpdateConsole(system, "launcherStatus", msg);
            
            // If server is running, ping it to get its status
            if (srv.isRunning) {
              // Determine which port to use based on server index
              const port = index === 0 ? system.deviceServerPort : system.compositingServerPort;
              const serverUrl = index === 0 ? deviceServerUrl : compositingServerUrl;
              const serverEndpoint = `http://${system.ip}:${port}/${serverUrl}`;
              
              pingServerStatus(system, index, serverEndpoint);
            } else {
              // If not running, mark as stopped
              if (system.servers[index]) {
                system.servers[index].status = 'stopped';
              }
              updateSystemUI(system);
            }
          });
        }
      }

      handleServerResponse(system, "getLauncherStatus", {
        status: "Success",
        message: "Launcher status retrieved successfully.",
      });

      updateSystemUI(system);
    })
    .catch((err) => {
      if (err.name === "AbortError") {
        console.error(`Timeout contacting launcher on ${system.name}`);
        autoUpdateConsole(system, "getLauncherStatus", "Timed out contacting launcher", "error");
      } else {
        console.error(`Failed to contact launcher on ${system.name}:`, err);
        autoUpdateConsole(system, "getLauncherStatus", "Failed to contact launcher — connection error", "error");
      }
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
        
        // Only log if this is a new status change
        if (system.servers[serverIndex].lastStatus !== 'online') {
          autoUpdateConsole(system, "serverStatus", `${system.servers[serverIndex].name} is online ✓`);
          system.servers[serverIndex].lastStatus = 'online';
        }
        
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

  // 1. Add one checkbox per system
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

  // 2. Add "Other" filter checkbox
  const otherLabel = document.createElement("label");
  otherLabel.className = "filter-option disconnected";

  const otherText = document.createElement("span");
  otherText.className = "label-text";
  otherText.textContent = "Other";

  const otherCheckbox = document.createElement("input");
  otherCheckbox.type = "checkbox";
  otherCheckbox.value = "Other";
  otherCheckbox.checked = filterState.has("Other");

  otherCheckbox.onchange = () => {
    if (otherCheckbox.checked) {
      filterState.add("Other");
    } else {
      filterState.delete("Other");
    }
    applyConsoleFilter();
  };

  otherLabel.appendChild(otherText);
  otherLabel.appendChild(otherCheckbox);
  menu.appendChild(otherLabel);

  if (!filterState.has("Other")) {
    filterState.add("Other");
  }
}

// Filters chat based on filter menu
function applyConsoleFilter() {
  const entries = document.querySelectorAll(".log-entry");
  let visibleCount = 0;

  entries.forEach((entry) => {
    const label = entry.querySelector(".label");
    if (!label) return;

    const name = label.textContent.trim();
    const isKnownSystem = allSystems.some((sys) => sys.name === name);

    const shouldShow =
      (isKnownSystem && filterState.has(name)) ||
      (!isKnownSystem && filterState.has("Other"));

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

    currentSystem = allSystems[0]?.name || "";
    const label = document.getElementById("targetLabel");
    if (label && currentSystem) {
      label.textContent = `Target: ${currentSystem}`;
      changeTargetColor(currentSystem);
    }

    updateInterface();
    applyConsoleFilter();
  } else {
    // fallback if nothing is stored — hardcoded default system
    const baseSystems = [
      {
        name: "Local Host",
        ip: "127.0.0.1",
        serverLauncherPort: "8080",
        deviceServerPort: "8081",
        compositingServerPort: "8082",
      },
    ];

    allSystems = baseSystems.map((d, index) => ({
      name: d.name,
      ip: d.ip,
      serverLauncherPort: d.serverLauncherPort,
      deviceServerPort: d.deviceServerPort,
      compositingServerPort: d.compositingServerPort,
      connected: false,
      launcherAlive: false,
      servers: [],
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
  }
  
  // Check if launcher is alive for all systems on page load
  allSystems.forEach((system) => {
    checkLauncherAlive(system);
  });
});

setInterval(() => {
  const now = Date.now();

  if (getStatusUpdates) {
    allSystems.forEach((system) => {
      // Only ping systems with launcher alive
      if (!system.launcherAlive) return;
      
      // Attempt to ping both servers if they exist and are running
      if (system.servers && system.servers.length > 0) {
        system.servers.forEach((srv, index) => {
          if (srv.isRunning) {
            const port = index === 0 ? system.deviceServerPort : system.compositingServerPort;
            const serverUrl = index === 0 ? deviceServerUrl : compositingServerUrl;
            const serverEndpoint = `http://${system.ip}:${port}/${serverUrl}`;
            
            pingServerStatus(system, index, serverEndpoint);
          }
        });
      }
    });
  }
}, getServerStatusInterval); // every certain amount of seconds
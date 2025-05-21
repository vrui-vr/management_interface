let allDevices = [];
let currentSystem = "";
let hasConnected = false;
const filterState = new Set();
const lowBatteryWarnings = new Set();

// Will be set at bottom of code
let url;

// Returns list of devices normalized and standardized with latest updates
function normalizeDevices(rawDevices) {
  return rawDevices.map((d, index) => ({
    name: d.name,
    connected: d.connected,
    headset: d.headset,
    left: d.left,
    right: d.right,
    headset_connected: d.headset_connected,
    left_connected: d.left_connected,
    right_connected: d.right_connected,
    headset_model: d.headset_model || "Unknown",
    ip: d.ip || "N/A", // new line
    colorClass: `rig-${index % 6}`,
  }));
} 

// Gets the address of a device using the global url combined with the local data of the device
// ex): http://192.0.0.1:8080/ServerStatus.html
function getEndpoint(device) {
  return `http://${device.ip}:${device.port}/${url}`;
}

// Add device to list of devices
function addDevice() {
  const defaultName = `Rig ${String.fromCharCode(65 + allDevices.length)}`;
  const nameInput = window.prompt("Enter device name:", defaultName);
  const newName =
    nameInput && nameInput.trim() !== "" ? nameInput.trim() : defaultName;

  if (newName.toLowerCase() === "local host") {
    alert("The name 'Local Host' is reserved and cannot be used.");
    return;
  }

  const headsetModel = window.prompt(
    "Enter headset model (e.g., HTC Vive Pro, Valve Index):",
    "HTC Vive Pro"
  );
  const model =
    headsetModel && headsetModel.trim() !== ""
      ? headsetModel.trim()
      : "Unknown";

  const ipAddress = window.prompt(
    "Enter device IP address (e.g., 192.168.1.15):",
    "192.168.1.15"
  );
  const ip = ipAddress && ipAddress.trim() !== "" ? ipAddress.trim() : "";

  const devicePort = window.prompt(
    "Enter device port  (e.g., 8000):",
    "8080"
  );
  const port = devicePort && devicePort.trim() !== "" ? devicePort.trim() : "";

  const newDevice = {
    name: newName,
    headset_model: model,
    ip,
    port, // optionally prompt for port (TODO)
    connected: false,
    headset: 0,
    left: 0,
    right: 0,
    headset_connected: false,
    left_connected: false,
    right_connected: false,
    colorClass: `rig-${allDevices.length % 6}`,
  };

  allDevices.push(newDevice);
  currentSystem = newName;
  updateInterface();
  autoUpdateConsole(newDevice, "add", `✅ Added device '${newName}'`);
}

// Remove device from list of devices
// Protects the Local Host from deletion
function removeDevice(deviceName) {
  if (deviceName === "Local Host") {
    alert("Cannot remove 'Local Host'. It is a protected system.");
    return;
  }

  const confirmed = confirm(`Are you sure you want to remove "${deviceName}"?`);
  if (!confirmed) return;

  allDevices = allDevices.filter((d) => d.name !== deviceName);
  if (currentSystem === deviceName) {
    currentSystem = "Local Host";
  }
  updateInterface();
  autoUpdateConsole(
    { name: deviceName },
    "remove",
    `🗑️ Device '${deviceName}' removed.`
  );
}

// Gets color of the device theme from css
function getDeviceColor(device, muted = false) {
  const varName = `--${device.colorClass || "rig-0"}${muted ? "-muted" : ""}`;
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim() || "#999"
  );
}

// Changes which device we are talking to
// Possibly wanna rename to change device
function changeSystem(name) {
  currentSystem = name;
  updateInterface();

  const label = document.getElementById("targetLabel");
  label.textContent = `Target: ${name}`;

  const device = allDevices.find((d) => d.name === name);
  if (device) {
    label.style.color = getDeviceColor(device);
  }
}

// Handles dropdown for changing devices
function updateDropdown() {
  const dropdown = document.getElementById("systemSelect");
  dropdown.innerHTML = "";
  allDevices.forEach((device) => {
    const option = document.createElement("option");
    option.value = device.name;
    option.textContent = device.name;
    if (!device.connected) option.className = "offline";
    if (device.name === currentSystem) option.selected = true;
    dropdown.appendChild(option);
  });
}

// Updates button logic based on the state
// Subject to heavy logic change as buttons change
function updateButtonStatesFor(device) {
  const connected = device.connected;
  const headsetConnected = device.headset_connected;
  const leftConnected = device.left_connected;
  const rightConnected = device.right_connected;
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

// Updates the UI for the device widgets
function updateDeviceUI(updatedDevice) {
  // 1) find the right .device-card
  const cards = document.querySelectorAll(".device-card");
  let deviceCard = null;
  cards.forEach((c) => {
    if (c.querySelector(".device-name").textContent === updatedDevice.name) {
      deviceCard = c;
    }
  });
  if (!deviceCard) return;

  // 2) grab its battery rows
  const batteryRows = deviceCard.querySelectorAll(".battery-row");

  // 3) update battery percentages
  // Headset
  if (!batteryRows.length) return;

  const hs = batteryRows[0].querySelector(".battery-percent");
  if (hs) {
    hs.textContent = `${updatedDevice.headset}%`;
    hs.classList.toggle("zero", updatedDevice.headset === 0);
  }

  const lf = batteryRows[1]?.querySelector(".battery-percent");
  if (lf) {
    lf.textContent = `${updatedDevice.left}%`;
    lf.classList.toggle("zero", updatedDevice.left === 0);
  }

  const rt = batteryRows[2]?.querySelector(".battery-percent");
  if (rt) {
    rt.textContent = `${updatedDevice.right}%`;
    rt.classList.toggle("zero", updatedDevice.right === 0);
  }

  // 4) update connected/disconnected styling
  if (updatedDevice.connected) {
    deviceCard.classList.remove("disconnected");
  } else {
    deviceCard.classList.add("disconnected");
  }

  // 5) and update the target label color
  changeTargetColor(updatedDevice.name);

  // 6) Update button availability based on current device state
  if (updatedDevice.name === currentSystem) {
    updateButtonStatesFor(updatedDevice);
  }
}

// Updates console with new message
function autoUpdateConsole(device, command, message) {
  const consoleBox = document.getElementById("consoleOutput");

  const isAtBottom =
    consoleBox.scrollHeight - consoleBox.clientHeight <=
    consoleBox.scrollTop + 1;

  const logEntry = document.createElement("div");

  // Use latest device info to get colorClass
  const fullDevice = allDevices.find((d) => d.name === device.name) || device;
  const colorClass = fullDevice.colorClass;
  logEntry.className = `log-entry ${colorClass}`;

  const isOffline = !fullDevice.connected;
  const isError = /error|failed|not connected|cannot/i.test(message);
  const isCritical = /battery low|crash|critical/i.test(message);

  if (isError) {
    logEntry.classList.add("log-error");
  }

  if (isCritical) {
    logEntry.classList.add("log-critical");
  }

  const systemName = `<span class="label">${fullDevice.name}</span>`;
  const offlineNote = isOffline
    ? ` <span class="offline">(offline)</span>`
    : "";

  logEntry.innerHTML = `${systemName}${offlineNote} - ${command}<br>${message}`;

  const labelEl = logEntry.querySelector(".label");
  if (labelEl) {
    labelEl.style.color = getDeviceColor(fullDevice);
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

// Changes color of device (called rig NEED TO RENAME)
function changeTargetColor(rigName) {
  const targetLabel = document.getElementById("targetLabel");
  const device = allDevices.find((d) => d.name === rigName);
  if (device) {
    targetLabel.style.color = getDeviceColor(device);
  }
}

// Renders the individual device widges
function renderDevices(devices) {
  const container = document.getElementById("deviceContainer");
  container.innerHTML = "";

  devices.forEach((device) => {
    const card = document.createElement("div");
    card.className = "device-card";

    if (!device.connected) card.classList.add("disconnected");

    if (device.name === currentSystem) {
      const borderColor = getDeviceColor(device);
      card.style.border = `2px solid ${borderColor}`;
      card.style.boxShadow = `0 0 6px ${borderColor}`;
    }

    card.onclick = () => changeSystem(device.name);

    // Header: name + remove button
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";

    const name = document.createElement("div");
    const statusClass = device.connected ? "connected" : "disconnected";
    name.className = `device-name ${statusClass}`;
    name.style.color = getDeviceColor(device);
    name.style.display = "flex";
    name.style.flexDirection = "column"; // ✅ stack name + ip
    name.style.alignItems = "flex-start";
    name.style.gap = "0.1rem"; // small vertical gap

    const labelSpan = document.createElement("span");
    labelSpan.textContent = device.name;

    const offlineSpan = document.createElement("span");
    if (!device.connected) {
      offlineSpan.textContent = " (offline)";
      offlineSpan.className = "offline";
      labelSpan.appendChild(offlineSpan);
    }

    // ✅ New: IP address below the name
    const ipSpan = document.createElement("span");
    ipSpan.textContent = `${device.ip}:${device.port}` || "";
    ipSpan.style.fontSize = "0.6rem";
    ipSpan.style.color = "gray";
    ipSpan.style.opacity = "0.7";
    ipSpan.style.marginTop = "-2px";

    name.appendChild(labelSpan);
    name.appendChild(ipSpan); // 👈 append IP below name

    header.appendChild(name);

    if (device.name !== "Local Host") {
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.title = "Remove device";
      removeBtn.textContent = "x";
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        removeDevice(device.name);
      };
      header.appendChild(removeBtn);
    }

    card.appendChild(header);

    const batteryColumn = document.createElement("div");
    batteryColumn.className = "battery-column";

    batteryColumn.appendChild(
      createBattery(
        device,
        `Headset (${device.headset_model})`,
        device.headset,
        device.headset_connected
      )
    );
    batteryColumn.appendChild(
      createBattery(
        device,
        "Left Controller",
        device.left,
        device.left_connected
      )
    );
    batteryColumn.appendChild(
      createBattery(
        device,
        "Right Controller",
        device.right,
        device.right_connected
      )
    );

    card.appendChild(batteryColumn);
    container.appendChild(card);
  });
}

// Creates battery bars within the device widgets
function createBattery(device, label, percent, isConnected) {
  const row = document.createElement("div");
  row.className = "battery-row";

  const labelSpan = document.createElement("span");
  labelSpan.className = "battery-label";
  labelSpan.textContent = label;

  const statusSpan = document.createElement("span");
  statusSpan.className = "battery-status";

  if (!isConnected) {
    statusSpan.textContent = "Not Connected";
    statusSpan.style.color = "gray";
    statusSpan.style.fontSize = "0.75rem";
    statusSpan.style.marginLeft = "0.5rem";
  }

  row.appendChild(labelSpan);
  row.appendChild(statusSpan);

  if (isConnected) {
    const container = document.createElement("div");
    container.className = "battery-bar-container";

    const bar = document.createElement("div");
    bar.className = "battery-bar";

    const fill = document.createElement("div");
    fill.className = "battery-fill";

    // 🔁 Always resolve device fresh from allDevices
    const fullDevice = allDevices.find((d) => d.name === device.name) || device;

    fill.style.width = `${percent}%`;
    fill.style.backgroundColor = getDeviceColor(fullDevice);

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

  return row;
}

// Sends command to the server of the active device
// MOST WORK NEEDED HERE
// TALK TO OLIVER ABOUT HOW TO SET THINGS UP
function send(command) {
  const device = allDevices.find((d) => d.name === currentSystem);
  if (!device) return;

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
  const button = document.getElementById(btnId);
  let originalText = "";
  if (button) {
    button.disabled = true;
    originalText = button.textContent;
    button.textContent = "Loading...";
  }

  fetch(getEndpoint(device), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.status === "success" && data.deviceState) {
        const i = allDevices.findIndex((d) => d.name === device.name);
        if (i !== -1) {
          allDevices[i] = { ...allDevices[i], ...data.deviceState };
          updateDeviceUI(allDevices[i]);
          autoUpdateConsole(device, command, data.message);
        }
      } else {
        autoUpdateConsole(
          device,
          command,
          data.message || "⚠️ Unexpected response"
        );
      }
    })
    .catch((err) => {
      console.error("Send failed:", err);
      autoUpdateConsole(device, command, "❌ Failed to send command");
    })
    // Runs whether the function succeeds or fails, guaranteeing the buttons update
    .finally(() => {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
}

// SIMILAR TO SEND, but NOT RELATED TO BUTTONS (EX CHAT COMMANDS) (MAYBE RENAME FUNCTION TO BE SEND CHAT COMMEND OR SMTH)
function sendCustomCommand() {
  const input = document.getElementById("commandInput");
  const rawCommand = input.value.trim();
  if (!rawCommand) return;

  const isReset = rawCommand.toLowerCase() === "reset";

  fetch("/cgi-bin/handler.py", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: rawCommand, target: currentSystem }),
  })
    .then((r) => r.json())
    .then((data) => {
      const targetDevice = allDevices.find((d) => d.name === currentSystem) || {
        name: currentSystem,
        connected: true,
        headset: 0,
        left: 0,
        right: 0,
        colorClass: "rig-0",
      };

      // If reset, refresh everything
      if (Array.isArray(data.devices)) {
        allDevices = normalizeDevices(data.devices);

        if (allDevices.length > 0) {
          allDevices[0].name = "Local Host";
          currentSystem = "Local Host";

          const label = document.getElementById("targetLabel");
          const currentDevice = allDevices.find(
            (d) => d.name === currentSystem
          );
          if (label && currentDevice) {
            label.textContent = `Target: ${currentSystem}`;
            label.style.color = getDeviceColor(currentDevice);
          }
        }

        updateInterface();

        if (isReset) {
          clearConsoleMessages();
          resetFilterCheckboxes(allDevices);
          return;
        }
      }

      // Update device if backend gave updated state
      if (data.deviceState) {
        const i = allDevices.findIndex((d) => d.name === device.name);
        if (i !== -1 && data.deviceState) {
          allDevices[i] = { ...allDevices[i], ...data.deviceState };
          updateDeviceUI(allDevices[i]);
        }
        updateDeviceUI(targetDevice);
      }

      // Log the response
      autoUpdateConsole(
        targetDevice,
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
function resetFilterCheckboxes(devices) {
  filterState.clear();
  devices.forEach((d) => filterState.add(d.name));
  updateFilterMenu();
}

// Add clickable boxes for the filter toggles
document.getElementById("filterToggle").addEventListener("click", () => {
  const menu = document.getElementById("filterMenu");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
});

// Updates the chat filter menu
function updateFilterMenu() {
  const menu = document.getElementById("filterMenu");
  menu.innerHTML = "";

  allDevices.forEach((device) => {
    const label = document.createElement("label");
    label.className = `filter-option ${device.colorClass} ${
      device.connected ? "connected" : "disconnected"
    }`;

    const labelText = document.createElement("span");
    labelText.className = "label-text";
    labelText.textContent = device.name;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = device.name;

    // ✅ If device not in filter, add it (default ON)
    if (!filterState.has(device.name)) {
      filterState.add(device.name);
    }

    checkbox.checked = filterState.has(device.name);

    checkbox.onchange = () => {
      if (checkbox.checked) {
        filterState.add(device.name);
      } else {
        filterState.delete(device.name);
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
  const device = allDevices.find((d) => d.name === currentSystem);
  if (device) updateButtonStatesFor(device);
}

// Helper that updates GUI of entire website
function updateInterface() {
  updateDropdown();
  renderDevices(allDevices);
  updateButtonStates();
  updateFilterMenu();
  applyConsoleFilter();
}

//----------------------------------------------------------------------------
//----------------------------------------------------------------------------
// PAGE SETUP SECTION
//----------------------------------------------------------------------------
//----------------------------------------------------------------------------

// Load config.json to set variables
fetch("data/config.json")
  .then((response) => response.json())
  .then((data) => {
    url = data.url;
  })
  .catch((error) => console.error("Error loading JSON:", error));

// Initial Events on Page Load
document.addEventListener("DOMContentLoaded", () => {
  // Set up manual console entry
  const input = document.getElementById("commandInput");
  if (input) {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        sendCustomCommand();
      }
    });
  }

  // Initial fetch and UI setup
  fetch("data/devices.json")
    .then((response) => response.json())
    .then((baseDevices) => {
      allDevices = baseDevices.map((d, index) => ({
        name: d.name,
        headset_model: d.model,
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

      if (allDevices.length) {
        currentSystem = allDevices[0].name;
        const label = document.getElementById("targetLabel");
        if (label) {
          label.textContent = `Target: ${currentSystem}`;
          changeTargetColor(currentSystem);
        }
      }

      updateInterface();
      applyConsoleFilter();
    });
});

// Periodic call to get battery counts for each device, will need to be updated to fit new system
/*
setInterval(() => {
  allDevices.forEach((device, index) => {
    fetch(getEndpoint(device))
      .then((r) => r.json())
      .then((updated) => {
        // apply updates to this device
        const i = allDevices.findIndex((d) => d.name === device.name);
        if (i !== -1) {
          allDevices[i] = { ...allDevices[i], ...updated };
          updateDeviceUI(allDevices[i]);

          [
            { type: "headset", value: updated.headset, connected: updated.headset_connected },
            { type: "left controller", value: updated.left, connected: updated.left_connected },
            { type: "right controller", value: updated.right, connected: updated.right_connected },
          ].forEach(({ type, value, connected }) => {
            const key = `${device.name}_${type}`;
            if (connected && value < 10 && !lowBatteryWarnings.has(key)) {
              autoUpdateConsole(device, "battery", `${type} battery low: ${value}%`);
              lowBatteryWarnings.add(key);
            } else if (value >= 10) {
              lowBatteryWarnings.delete(key);
            }
          });
        }
      })
      .catch((err) => {
        console.warn(`❌ Failed to poll ${device.name}:`, err);
      });
  });
}, 1000);
*/
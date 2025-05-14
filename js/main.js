let deviceCounter = 0;
let allDevices = [];
let currentSystem = "";
let hasConnected = false;

function normalizeDevices(rawDevices) {
  return rawDevices.map((d) => ({
    name: d.name,
    connected: d.connected,
    headset: d.headset,
    left: d.left,
    right: d.right,
    headset_connected: d.headset_connected,
    left_connected: d.left_connected,
    right_connected: d.right_connected,
  }));
}

function createDevice(name) {
  return {
    name,
    connected: false,
    headset: 0,
    left: 0,
    right: 0,
  };
}

// Updated addDevice() with prompt for custom name
function addDevice() {
  // default suggestion: Rig A, B, C, etc.
  const defaultName = `Rig ${String.fromCharCode(65 + deviceCounter)}`;
  // prompt user for device name, with default pre-filled
  const input = window.prompt("Enter device name:", defaultName);
  // if user pressed Cancel or entered empty string, use defaultName
  const newName = input && input.trim() !== "" ? input.trim() : defaultName;

  // send to server to create the device
  fetch("/cgi-bin/handler.py", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "add", target: newName }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.status === "success") {
        // 1) update local device list
        allDevices = normalizeDevices(data.devices);

        deviceCounter = allDevices.length;

        // 2) switch focus to the new device
        currentSystem = newName;
        document.getElementById(
          "targetLabel"
        ).textContent = `Target: ${currentSystem}`;
        changeTargetColor(currentSystem);
        changeDeviceNameColor(currentSystem);

        // 3) refresh UI
        updateInterface();

        // 4) log the addition
        autoUpdateConsole({ name: newName }, "add", data.message);
      } else {
        console.error(data.message);
      }
    })
    .catch((err) => console.error("Add failed:", err));
}

function changeSystem(name) {
  currentSystem = name;
  updateInterface();
  document.getElementById("targetLabel").textContent = `Target: ${name}`;
  changeTargetColor(name); // Update target color when system changes
  changeDeviceNameColor(name); // Update device name color
}

function getColorClass(name) {
  return name.includes("A")
    ? "rig-a"
    : name.includes("B")
    ? "rig-b"
    : name.includes("C")
    ? "rig-c"
    : "rig-d"; // Support for more rigs
}

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

function send(command) {
  const device = allDevices.find((d) => d.name === currentSystem);
  if (!device) return;

  fetch("/cgi-bin/handler.py", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command, target: device.name }),
  })
    .then((response) => {
      // first time we actually talk to the server, show a message
      if (!hasConnected && response.ok) {
        autoUpdateConsole(device, "connect", "✅ Connected to server");
        hasConnected = true;
      }
      return response.json();
    })
    .then((data) => {
      if (data.status === "success") {
        // 1) update our local device object
        Object.assign(device, data.deviceState);
        // 2) refresh the device UI
        updateDeviceUI(data.deviceState);
        // 3) log *this* command in the on-page console
        autoUpdateConsole(device, command, data.message);
      } else {
        console.error(data.message);
      }
    })
    .catch((error) => {
      console.error("Error communicating with the server:", error);
    });
}

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
  const hs = batteryRows[0].querySelector(".battery-percent");
  hs.textContent = `${updatedDevice.headset}%`;
  hs.classList.toggle("zero", updatedDevice.headset === 0);

  // Left
  const lf = batteryRows[1].querySelector(".battery-percent");
  lf.textContent = `${updatedDevice.left}%`;
  lf.classList.toggle("zero", updatedDevice.left === 0);

  // Right
  const rt = batteryRows[2].querySelector(".battery-percent");
  rt.textContent = `${updatedDevice.right}%`;
  rt.classList.toggle("zero", updatedDevice.right === 0);

  // 4) update connected/disconnected styling
  if (updatedDevice.connected) {
    deviceCard.classList.remove("disconnected");
  } else {
    deviceCard.classList.add("disconnected");
  }

  // 5) and update the target label color
  changeTargetColor(updatedDevice.name);
}

function autoUpdateConsole(device, command, message) {
  const consoleBox = document.getElementById("consoleOutput");

  // Save the current scroll position before adding new content
  const isAtBottom =
    consoleBox.scrollHeight - consoleBox.clientHeight <=
    consoleBox.scrollTop + 1;

  // Create a new log entry
  const logEntry = document.createElement("div");
  const colorClass = getColorClass(device.name);
  logEntry.className = `log-entry ${colorClass}`;
  const isOffline = !device.connected;
  const systemName = `<span class="label">${device.name}</span>`;
  const offlineNote = isOffline
    ? ` <span class="offline">(offline)</span>`
    : "";
  logEntry.innerHTML = `${systemName}${offlineNote} - ${command}<br>${message}`;

  // Append the log entry to the console
  consoleBox.appendChild(logEntry);

  // Update filters in the console
  applyConsoleFilter();

  // If the user was at the bottom, scroll after the content is added
  if (isAtBottom) {
    setTimeout(() => {
      consoleBox.scrollTop = consoleBox.scrollHeight;
    }, 100); // Delay for rendering to complete
  }

  // Update dropdown and render devices
  updateInterface();
}

function changeTargetColor(rigName) {
  const targetLabel = document.getElementById("targetLabel");
  const colorClass = getColorClass(rigName);
  const colors = {
    "rig-a": "var(--rig-a)",
    "rig-b": "var(--rig-b)",
    "rig-c": "var(--rig-c)",
    "rig-d": "var(--rig-d)",
  };
  targetLabel.style.color = colors[colorClass];
}

function changeDeviceNameColor(rigName) {
  const container = document.getElementById("deviceContainer");
  const devices = container.getElementsByClassName("device-card");
  Array.from(devices).forEach((card) => {
    const nameElement = card.querySelector(".device-name");
    const deviceName = nameElement.textContent;
    if (deviceName === rigName) {
      nameElement.style.color = getColorClass(deviceName);
    }
  });
}

function renderDevices(devices) {
  const container = document.getElementById("deviceContainer");
  container.innerHTML = "";

  devices.forEach((device) => {
    const card = document.createElement("div");
    card.className = "device-card";

    // Apply .disconnected if not connected
    if (!device.connected) card.classList.add("disconnected");

    // ✅ Highlight if this is the focused system
    if (device.name === currentSystem) {
      const colorClass = getColorClass(device.name);
      const cssVar = getComputedStyle(
        document.documentElement
      ).getPropertyValue(`--${colorClass}`);
      card.style.border = `2px solid ${cssVar.trim()}`;
      card.style.boxShadow = `0 0 6px ${cssVar.trim()}`;
    }

    card.onclick = () => {
      changeSystem(device.name);
    };

    const name = document.createElement("div");
    name.className = "device-name";
    name.textContent = device.name + (device.connected ? "" : " (not online)");
    card.appendChild(name);

    const batteryColumn = document.createElement("div");
    batteryColumn.className = "battery-column";

    const colorClass = getColorClass(device.name);

    // Headset row
    batteryColumn.appendChild(
      createBattery(
        "Headset",
        device.headset,
        colorClass,
        device.headset_connected
      )
    );

    // Left controller row
    batteryColumn.appendChild(
      createBattery(
        "Left Controller",
        device.left,
        colorClass,
        device.left_connected
      )
    );

    // Right controller row
    batteryColumn.appendChild(
      createBattery(
        "Right Controller",
        device.right,
        colorClass,
        device.right_connected
      )
    );

    card.appendChild(batteryColumn);
    container.appendChild(card);
  });
}

function createBattery(label, percent, colorClass, isConnected) {
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
    fill.style.width = `${percent}%`;
    fill.style.backgroundColor = `var(--${colorClass})`;

    const pct = document.createElement("span");
    pct.className = "battery-percent";
    pct.textContent = `${percent}%`;
    if (percent === 0) pct.classList.add("zero");

    bar.appendChild(fill);
    container.appendChild(bar);
    container.appendChild(pct);

    row.appendChild(container);
  }

  return row;
}

function sendCustomCommand() {
  const input = document.getElementById("commandInput");
  const rawCommand = input.value.trim();
  if (!rawCommand) return;

  fetch("/cgi-bin/handler.py", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: rawCommand }),
  })
    .then((r) => r.json())
    .then((data) => {
      const fakeDevice = {
        name: "System",
        connected: true,
        headset: 0,
        left: 0,
        right: 0,
      };

      autoUpdateConsole(fakeDevice, rawCommand, data.message || "No response");

      if (Array.isArray(data.devices)) {
        allDevices = normalizeDevices(data.devices);

        // If currentSystem no longer exists, reset it
        if (!allDevices.find((d) => d.name === currentSystem)) {
          currentSystem = allDevices[0]?.name || "";
          document.getElementById(
            "targetLabel"
          ).textContent = `Target: ${currentSystem}`;
          changeTargetColor(currentSystem);
          changeDeviceNameColor(currentSystem);
        }

        updateInterface();
      }
    })
    .catch((err) => {
      console.error("Command failed:", err);
    });

  input.value = "";
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("commandInput");
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendCustomCommand();
    }
  });
});

const filterState = new Set(); // Active filter names

document.getElementById("filterToggle").addEventListener("click", () => {
  const menu = document.getElementById("filterMenu");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
});

function updateFilterMenu() {
  const menu = document.getElementById("filterMenu");
  menu.innerHTML = "";

  allDevices.forEach((device) => {
    const label = document.createElement("label");
    label.className = `filter-option ${getColorClass(device.name)} ${device.connected ? "connected" : "disconnected"}`;

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
    if (!consoleBox.querySelector(".log-empty")) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "log-empty";
      emptyMsg.textContent = "Nothing here yet...";
      emptyMsg.style.color = "var(--text-muted)";
      emptyMsg.style.fontStyle = "italic";
      emptyMsg.style.padding = "0.25rem 0";
      consoleBox.appendChild(emptyMsg);
    }
  } else {
    const existing = consoleBox.querySelector(".log-empty");
    if (existing) existing.remove();
  }
}

function updateButtonStates() {
  const device = allDevices.find(d => d.name === currentSystem);
  if (!device) return;

  const connected = device.connected;
  const headsetConnected = device.headset_connected;

  document.getElementById("btn-power").disabled = connected;
  document.getElementById("btn-shutdown").disabled = !connected;
  document.getElementById("btn-connect").disabled = !connected;
  document.getElementById("btn-disconnect").disabled = !connected;
  document.getElementById("btn-run").disabled = !connected || !headsetConnected;
}

// Helper that updates all gui
function updateInterface() {
  updateDropdown();
  renderDevices(allDevices);
  updateButtonStates();
  updateFilterMenu();
  applyConsoleFilter();
}

// Initialize with 1 device
fetch("/cgi-bin/handler.py?vr_status=1")
  .then((r) => r.json())
  .then((devicesFromServer) => {
    allDevices = normalizeDevices(devicesFromServer);

    if (allDevices.length) {
      currentSystem = allDevices[0].name;
      document.getElementById(
        "targetLabel"
      ).textContent = `Target: ${currentSystem}`;
      changeTargetColor(currentSystem);
    }
    updateInterface();
  });

// poll every 10s for the decayed battery levels
setInterval(() => {
  fetch("/cgi-bin/handler.py?vr_status=1")
    .then((r) => r.json())
    .then((devs) => {
      // 1) update your local model
      allDevices = normalizeDevices(devs);

      // 2) re-render the cards
      renderDevices(allDevices);
      // 3) refresh the focused card/detail if needed
      const focused = allDevices.find((d) => d.name === currentSystem);
      if (focused) updateDeviceUI(focused);
    })
    .catch(console.error);
}, 1_000);
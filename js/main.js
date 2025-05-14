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
    headset_model: d.headset_model || "Unknown",
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

function addDevice() {
  const defaultName = `Rig ${String.fromCharCode(65 + deviceCounter)}`;
  const nameInput = window.prompt("Enter device name:", defaultName);
  const newName =
    nameInput && nameInput.trim() !== "" ? nameInput.trim() : defaultName;

  const headsetModel = window.prompt(
    "Enter headset model (e.g., HTC Vive Pro, Valve Index):",
    "HTC Vive Pro"
  );
  const model =
    headsetModel && headsetModel.trim() !== ""
      ? headsetModel.trim()
      : "Unknown";

  fetch("/cgi-bin/handler.py", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "add", target: newName, model }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.status === "success") {
        allDevices = normalizeDevices(data.devices);
        deviceCounter = allDevices.length;
        currentSystem = newName;

        document.getElementById(
          "targetLabel"
        ).textContent = `Target: ${currentSystem}`;
        changeTargetColor(currentSystem);
        changeDeviceNameColor(currentSystem);
        updateInterface();
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

  // Button ID mapping
  const buttonMap = {
    vrtracker_on: "btn-vrtracker", // this is now Open VR Tracker
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

  fetch("/cgi-bin/handler.py", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command, target: device.name }),
  })
    .then((response) => {
      if (!hasConnected && response.ok) {
        autoUpdateConsole(device, "connect", "Connected to server");
        hasConnected = true;
      }
      return response.json();
    })
    .then((data) => {
      if (data.status === "success") {
        Object.assign(device, data.deviceState); // update model
        updateDeviceUI(data.deviceState); // update visuals
        autoUpdateConsole(device, command, data.message);
      } else {
        console.error(data.message);
      }
    })
    .catch((error) => {
      console.error("Error communicating with the server:", error);
    })
    .finally(() => {
      if (button) {
        button.textContent = originalText;
        updateButtonStates(); // recheck enabled/disabled
      }
    });
}

function updateButtonStatesFor(device) {
  const connected = device.connected;
  const headsetConnected = device.headset_connected;
  const anyControllersConnected =
    device.left_connected || device.right_connected;
  const anythingConnected =
    headsetConnected || device.left_connected || device.right_connected;

  document.getElementById("btn-vrtracker").disabled = connected;
  document.getElementById("btn-headset").disabled =
    !connected || headsetConnected;
  document.getElementById("btn-connect").disabled =
    !headsetConnected || (device.left_connected && device.right_connected);
  document.getElementById("btn-disconnect").disabled = !anythingConnected;
  document.getElementById("btn-shutdown").disabled = !connected;
  document.getElementById("btn-restart").disabled = !connected;
  document.getElementById("btn-run").disabled = !headsetConnected;
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
    const colorClass = getColorClass(device.name);
    const statusClass = device.connected ? "connected" : "disconnected";
    name.className = `device-name ${colorClass} ${statusClass}`;

    const labelSpan = document.createElement("span");
    labelSpan.textContent = device.name;

    const offlineSpan = document.createElement("span");
    if (!device.connected) {
      offlineSpan.textContent = " (not online)";
      offlineSpan.className = "offline";
    }

    name.appendChild(labelSpan);
    if (!device.connected) name.appendChild(offlineSpan);

    card.appendChild(name);

    const batteryColumn = document.createElement("div");
    batteryColumn.className = "battery-column";

    // Headset row
    batteryColumn.appendChild(
      createBattery(
        `Headset (${device.headset_model})`,
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

  const isReset = rawCommand.toLowerCase() === "reset";

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

      if (Array.isArray(data.devices)) {
        allDevices = normalizeDevices(data.devices);
        currentSystem = allDevices[0]?.name || "";

        document.getElementById("targetLabel").textContent = `Target: ${currentSystem}`;
        changeTargetColor(currentSystem);
        changeDeviceNameColor(currentSystem);

        if (isReset) {
          clearConsoleMessages();
          resetFilterCheckboxes(allDevices);
        }

        updateInterface();                
      }

      if (!isReset) {
        autoUpdateConsole(fakeDevice, rawCommand, data.message || "No response");
      }
    })
    .catch((err) => {
      console.error("Command failed:", err);
    });

  input.value = "";
}


document.addEventListener("DOMContentLoaded", () => {
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
  fetch("/cgi-bin/handler.py?vr_status=1")
    .then((r) => r.json())
    .then((devicesFromServer) => {
      allDevices = normalizeDevices(devicesFromServer);

      if (allDevices.length) {
        currentSystem = allDevices[0].name;
        const label = document.getElementById("targetLabel");
        if (label) {
          label.textContent = `Target: ${currentSystem}`;
          changeTargetColor(currentSystem);
        }
      }

      updateDropdown();
      renderDevices(allDevices);
      updateFilterMenu();
      applyConsoleFilter(); // Ensure proper visibility if console starts empty
    });
});

function clearConsoleMessages() {
  const consoleBox = document.getElementById("consoleOutput");
  if (consoleBox) {
    consoleBox.innerHTML = ""; // Full wipe
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "log-empty";
    emptyMsg.textContent = "Nothing here yet...";
    emptyMsg.style.color = "var(--text-muted)";
    emptyMsg.style.fontStyle = "italic";
    emptyMsg.style.padding = "0.25rem 0";
    consoleBox.appendChild(emptyMsg);
  }
}

function resetFilterCheckboxes(devices) {
  filterState.clear();
  devices.forEach((d) => filterState.add(d.name));
  updateFilterMenu();
}

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
    label.className = `filter-option ${getColorClass(device.name)} ${
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
  const device = allDevices.find((d) => d.name === currentSystem);
  if (device) updateButtonStatesFor(device);
}

// Helper that updates all gui
function updateInterface() {
  updateDropdown();
  renderDevices(allDevices);
  updateButtonStates();
  updateFilterMenu();
  applyConsoleFilter();
}

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
}, 10_000);

let allSystems = [];
let currentSystem = "";
let hasConnected = false;
const filterState = new Set();
const lowBatteryWarnings = new Set();

const fileDropBox = document.querySelector(".file-drop-box");
const fileInput = document.getElementById("fileInput");

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
  return rawSystems.map((d, index) => ({
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

//Saves systems to local storage
function saveSystemsToLocalStorage() {
  const toSave = allSystems.map((d) => ({
    name: d.name,
    model: d.headset_model,
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

  const headsetModel = window.prompt(
    "Enter headset model (e.g., HTC Vive Pro, Valve Index):",
    "HTC Vive Pro"
  );
  const model =
    headsetModel && headsetModel.trim() !== ""
      ? headsetModel.trim()
      : "Unknown";

  const ipAddress = window.prompt(
    "Enter system IP address (e.g., 192.168.1.15):",
    "192.168.1.15"
  );
  const ip = ipAddress && ipAddress.trim() !== "" ? ipAddress.trim() : "";

  const systemPort = window.prompt("Enter system port  (e.g., 8000):", "8080");
  const port = systemPort && systemPort.trim() !== "" ? systemPort.trim() : "";

  const newSystem = {
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
    colorClass: `rig-${allSystems.length % 6}`,
  };

  allSystems.push(newSystem);
  currentSystem = newName;
  updateInterface();
  autoUpdateConsole(newSystem, "add", `✅ Added system '${newName}'`);

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
    `🗑️ System '${systemName}' removed.`
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

  // 3) update battery percentages
  // Headset
  if (!batteryRows[0]) return;

  const hs = batteryRows[0].querySelector(".battery-percent");
  if (hs) {
    hs.textContent = `${updatedSystem.headset}%`;
    hs.classList.toggle("zero", updatedSystem.headset === 0);
  }

  const lf = batteryRows[1]?.querySelector(".battery-percent");
  if (lf) {
    lf.textContent = `${updatedSystem.left}%`;
    lf.classList.toggle("zero", updatedSystem.left === 0);
  }

  const rt = batteryRows[2]?.querySelector(".battery-percent");
  if (rt) {
    rt.textContent = `${updatedSystem.right}%`;
    rt.classList.toggle("zero", updatedSystem.right === 0);
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

    if (!system.connected) card.classList.add("disconnected");

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
    const statusClass = system.connected ? "connected" : "disconnected";
    name.className = `system-name ${statusClass}`;
    name.style.color = getSystemColor(system);
    name.style.display = "flex";
    name.style.flexDirection = "column"; // ✅ stack name + ip
    name.style.alignItems = "flex-start";
    name.style.gap = "0.1rem"; // small vertical gap

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
    if (!system.connected) {
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

    // Create and prepend the dot
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

    const batteryColumn = document.createElement("div");
    batteryColumn.className = "battery-column";

    batteryColumn.appendChild(
      createBattery(
        system,
        `Headset (${system.headset_model})`,
        system.headset,
        system.headset_connected
      )
    );
    batteryColumn.appendChild(
      createBattery(
        system,
        "Left Controller",
        system.left,
        system.left_connected
      )
    );
    batteryColumn.appendChild(
      createBattery(
        system,
        "Right Controller",
        system.right,
        system.right_connected
      )
    );

    card.appendChild(batteryColumn);
    container.appendChild(card);
  });
}

// Creates battery bars within the system widgets
function createBattery(system, label, percent, isConnected) {
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
      let field;
      const l = label.toLowerCase();
      if (l.includes("headset")) field = "headset_model";
      else if (l.includes("left")) field = "left";
      else if (l.includes("right")) field = "right";
      showEditMenu(e, system, field);
    };
  } else {
    labelSpan.style.cursor = "default";
    labelSpan.title = "Select this system to edit";
    labelSpan.classList.add("inactive-field");
  }

  const statusSpan = document.createElement("span");
  statusSpan.className = "battery-status";

  // Always show "Not Connected" if not connected
  if (!isConnected) {
    statusSpan.textContent = "Not Connected";
    statusSpan.style.color = "gray";
    statusSpan.style.fontSize = ".8rem";
    statusSpan.style.marginLeft = "1rem";
    statusSpan.style.textAlign = "right";
  }

  // If connected and battery is -1 (no battery), show "Connected"
  else if (percent === -1) {
    statusSpan.textContent = "Connected";
    statusSpan.style.color = getSystemColor(system);
    statusSpan.style.fontSize = ".8rem";
    statusSpan.style.marginLeft = "1rem";
    statusSpan.style.fontWeight = "bold";
    statusSpan.style.textAlign = "right";
  }

  // Append in correct left-to-right visual order
  row.appendChild(labelSpan);
  row.appendChild(statusSpan);

  // If connected and has a battery, show battery bar
  if (isConnected && percent !== -1) {
    const container = document.createElement("div");
    container.className = "battery-bar-container";

    const bar = document.createElement("div");
    bar.className = "battery-bar";

    const fill = document.createElement("div");
    fill.className = "battery-fill";

    const fullSystem = allSystems.find((d) => d.name === system.name) || system;

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

  return row;
}

// Helper function to make the action menu visible
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

  // Prevent editing Local Host name or IP (but allow port)
  if (system.name === "Local Host") {
    if (
      field === "name" ||
      (field === "ipport" && e.target.textContent.includes("Change IP"))
    ) {
      return;
    }
  }

  // Reset for re-render
  makeMenuVisible(menu);

  const actions = {
    name: ["Rename"],
    ipport: ["Change IP", "Change Port"],
    headset_model: ["Rename Headset"],
    left: ["Ping", "Disconnect"],
    right: ["Ping", "Disconnect"],
  };

  const available = actions[field] || [];

  available.forEach((action) => {
    // Skip "Change IP" if this is the Local Host
    if (system.name === "Local Host") {
      if (
        field === "name" ||
        (field === "ipport" && e.target.textContent.includes("Change IP"))
      ) {
        const menu = document.getElementById("actionMenu");
        menu.classList.remove("visible");
        menu.classList.add("hidden");
        setTimeout(() => {
          menu.innerHTML = "";
        }, 150);
        return;
      }
    }

    const btn = document.createElement("button");
    btn.textContent = action;

    btn.onclick = () => {
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
        case "Rename Headset":
          renameHeadset(system);
          break;
        case "Ping":
          sendCustomCommandTo(system.name, `ping_${field}`);
          break;
        case "Disconnect":
          sendCustomCommandTo(system.name, `disconnect_${field}`);
          break;
      }
    };

    menu.appendChild(btn);
  });

  // Position menu
  const rect = e.target.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY}px`;
  menu.style.left = `${rect.left + window.scrollX}px`;
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

function renameHeadset(system) {
  const newModel = window.prompt("New headset model:", system.headset_model);
  if (newModel && newModel.trim()) {
    system.headset_model = newModel.trim();
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
	
  console.log(JSON.stringify(jsonData));
	
  if (!jsonData || !Array.isArray(jsonData.devices)) return;
  
  // Reset values to default in case data is missing
  system.headset = 0;
  system.left = 0;
  system.right = 0;
  system.headset_connected = false;
  system.left_connected = false;
  system.right_connected = false;

  for (const device of jsonData.devices) {
    const name = device.name?.toLowerCase();

    if (name === "hmd") {
      system.headset_connected = !!device.isTracked;
      system.headset = device.batteryLevel != null ? device.batteryLevel : -1;
    } else if (name.includes("controller")) {
      const isLeft = name.includes("1");
      const isRight = name.includes("2");
      const side = isLeft ? "left" : isRight ? "right" : null;
      if (!side) continue;

      system[`${side}_connected`] = !!device.isTracked;
      system[side] = device.batteryLevel || 0;

      // Optionally store extra info
      if (!system.devices) system.devices = {};
      system.devices[side] = {
        name: device.name,
        battery: device.batteryLevel || 0,
        connected: !!device.isTracked,
        buttonsPressed:
          device.buttons?.filter((b) => b.value).map((b) => b.name) || [],
        orientation: device.trackerState?.rotation || [],
        position: device.trackerState?.translation || [],
      };
    }
  }
}

// Sends a http request that does not require CORS
// This lets us avoid problems with CORS requirements
// NOTE: this is being used instead of fetch() and post
// This can only change the website to be the json, it cannot stay on the same page
// Allowed through cors because it is a "Simple" call
function sendPlainPost(cmd, endPoint) {
  const form = document.createElement('form');
  form.method = 'post';
  form.action = endPoint;

  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'command';
  input.value = cmd;
  form.appendChild(input);

  document.body.appendChild(form);
  form.submit();
}

// ISSUE HERE:
// Fetch requires CORS
// A plain post can only load the json as a new webpage
// It cannot be edited or processed by my webpage
// Oliver's server at the moment is a raw TCP Protocol, not a http handling one
// MessageIdType message=client->pipe->read<MessageIdType>();
// It is not reading an HTTP header — it expects the first 4 bytes to be a MessageIdType, not an HTTP string


// Sends command to the server of the active system
// MOST WORK NEEDED HERE
// TALK TO OLIVER ABOUT HOW TO SET THINGS UP
// function send(command) {
//   const system = allSystems.find((d) => d.name === currentSystem);
//   if (!system) return;

//   const buttonMap = {
//     vrtracker_on: "btn-vrtracker",
//     headset: "btn-headset",
//     connect: "btn-connect",
//     disconnect: "btn-disconnect",
//     restart: "btn-restart",
//     shutdown: "btn-shutdown",
//     run: "btn-run",
//   };

//   const btnId = buttonMap[command];
//   const button = document.getElementById(btnId);
//   let originalText = "";
//   if (button) {
//     button.disabled = true;
//     originalText = button.textContent;
//     button.textContent = "Loading...";
//   }

//   // Instead of fetch(), use your plain POST
//   try {
//     const endPoint = getEndpoint(system)
//     sendPlainPost(command, endPoint);
//     autoUpdateConsole(system, command, "Command sent.");
//   } catch (err) {
//     console.error("Send failed:", err);
//     autoUpdateConsole(system, command, "Failed to send command.");
//   } finally {
//     if (button) {
//       button.disabled = false;
//       button.textContent = originalText;
//     }
//   }
// }

// OLD SEND USING FETCH
function send(command) {
  const system = allSystems.find((d) => d.name === currentSystem);
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
  const button = document.getElementById(btnId);

  let originalText = "";
  if (button) {
    button.disabled = true;
    originalText = button.textContent;
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
      // Update the correct system in allSystems
      const i = allSystems.findIndex((d) => d.name === system.name);
      if (i === -1) return;

      if (command === "getServerStatus") {
        console.log(JSON.stringify(data));
        updateSystemWithJsonData(allSystems[i], data);
        allSystems[i].connected = true; // mark system online if it responded
        updateSystemUI(allSystems[i]);
        autoUpdateConsole(system, command, data.message || "Status updated.");
      } else if (data.status === "success" && data.systemState) {
        allSystems[i] = { ...allSystems[i], ...data.systemState };
        updateSystemUI(allSystems[i]);
        autoUpdateConsole(system, command, data.message);
      } else {
        autoUpdateConsole(
          system,
          command,
          data.message || "Unexpected response"
        );
      }
    })
    .catch((err) => {
      console.error("Send failed:", err);
      autoUpdateConsole(system, command, "Failed to send command");
    })
    .finally(() => {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
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

  for (system in allSystems) {
    updateSystemUI(system)
  }

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
        model: "Valve Index",
        ip: "127.0.0.1",
        port: "8081",
      },
    ];

    allSystems = baseSystems.map((d, index) => ({
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
});

// Periodic call to get battery counts for each system, will need to be updated to fit new system
/*
setInterval(() => {
  allSystems.forEach((system, index) => {
    fetch(getEndpoint(system))
      .then((r) => r.json())
      .then((updated) => {
        // apply updates to this system
        const i = allSystems.findIndex((d) => d.name === system.name);
        if (i !== -1) {
          allSystems[i] = { ...allSystems[i], ...updated };
          updateSystemUI(allSystems[i]);

          [
            { type: "headset", value: updated.headset, connected: updated.headset_connected },
            { type: "left controller", value: updated.left, connected: updated.left_connected },
            { type: "right controller", value: updated.right, connected: updated.right_connected },
          ].forEach(({ type, value, connected }) => {
            const key = `${system.name}_${type}`;
            if (connected && value < 10 && !lowBatteryWarnings.has(key)) {
              autoUpdateConsole(system, "battery", `${type} battery low: ${value}%`);
              lowBatteryWarnings.add(key);
            } else if (value >= 10) {
              lowBatteryWarnings.delete(key);
            }
          });
        }
      })
      .catch((err) => {
        console.warn(`❌ Failed to poll ${system.name}:`, err);
      });
  });
}, 1000);
*/

# Extending the Interface

This guide covers common patterns for adding new functionality to the management interface.

## Adding a New System Action

To add a new command that targets a Vrui system:

### 1. Create the function in `main.js`

Follow the existing pattern — use `fetchWithTimeout()` with the appropriate endpoint:

```javascript
async function myNewCommand(system) {
  const endpoint = getServerLauncherEndpoint(system);
  try {
    const response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        command: "myCommand",
        // additional parameters as needed
      })
    });
    const data = await response.json();

    // Process the response
    autoUpdateConsole(system, "myCommand", `Result: ${data.status}`);

    // Refresh the UI
    updateSystemUI(system);
  } catch (err) {
    autoUpdateConsole(system, "myCommand", `Failed: ${err.message}`, "error");
  }
}
```

### 2. Wire it to the UI

Add a button or menu item in `renderSystems()` (for per-system actions) or in `index.html` (for global controls), then attach your function as an event handler.

### 3. Log results

Use `autoUpdateConsole()` to display feedback:

```javascript
autoUpdateConsole(
  system,          // system object (for color-coding)
  "commandName",   // command identifier
  "Message text",  // what to display
  "warning"        // severity: "" (normal), "warning", or "error"
);
```

## Adding a New UI Element

### In the sidebar

Add HTML to the sidebar section of `index.html`, between the environment selector and the closing `</div>`:

```html
<div class="my-new-section">
  <label class="my-label">My Feature</label>
  <!-- controls here -->
</div>
```

### In the main area

Add elements inside `div.main` in `index.html`. For per-system elements, add them inside `renderSystems()` in `main.js` where cards are built dynamically.

### Styling

Add styles to `css/main.css`. Use existing CSS custom properties for theme consistency:

```css
.my-new-section {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
}
```

Dark mode support is automatic when you use CSS variables — they update via the `[data-theme="dark"]` selector.

## Adding a New Backend Command

If the Vrui backend exposes a new CGI command:

1. **Identify the endpoint** — which CGI handler (`VRServerLauncher.cgi`, `VRDeviceServer.cgi`, or `VRCompositingServer.cgi`) processes the command

2. **Use the endpoint builder** — `getServerLauncherEndpoint(system)`, `getDeviceServerEndpoint(system)`, or `getCompositingServerEndpoint(system)`

3. **Follow the request pattern** shown above

4. **Update the system object** if the response contains state data, then call `updateSystemUI(system)` to refresh the card

## Adding to the Polling Loop

To include a new check in the regular status polling cycle, add your call inside the polling chain in `main.js`. The current flow is:

```
checkLauncherAlive(system)
  └── if alive:
        ├── getLauncherStatus(system)
        ├── getDeviceServerStatus(system)
        └── your new check here
```

Place your call after `getDeviceServerStatus()` to ensure the system is confirmed alive before querying.

## Modifying System Card Rendering

System cards are built in `renderSystems()` (~line 665 in `main.js`). This function generates HTML strings for each system and inserts them into the `#systemContainer` element.

Key rendering helpers:

| Function | Purpose |
|----------|---------|
| `createBattery(system, label, percent, isConnected, isTracked, hasBattery)` | Generates a battery indicator widget |
| `getSystemColor(system, muted)` | Returns the CSS color for a system |
| `formatPorts(p1, p2, p3)` | Formats port numbers for display |

## Adding a Modal Dialog

Use the reusable `showFormModal()` function:

```javascript
showFormModal({
  title: "My Dialog",
  submitLabel: "Save",
  colorClass: system.colorClass,
  fields: [
    { label: "Field Name", id: "fieldId", type: "text", value: "default" },
    { label: "Option", id: "optionId", type: "text", value: "" },
  ],
  onSubmit: (values) => {
    // values.fieldId, values.optionId
    // do something with the input
  }
});
```

This creates a styled modal with form fields, validation, and submit/cancel buttons that match the current theme.

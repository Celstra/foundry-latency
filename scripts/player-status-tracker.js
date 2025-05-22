const MODULE_NAME = "player-status-tracker";

Hooks.once("init", () => {
  console.log(`[Player Status Tracker] Initializing`);

  // Register settings
  game.settings.register(MODULE_NAME, "showZZZ", {
    name: "Show ZZZ indicator for inactive/unfocused players",
    hint: "Display ZZZ next to player name when inactive or tab not focused.",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
  });

  game.settings.register(MODULE_NAME, "showLineThrough", {
    name: "Show line-through on player names for inactive/unfocused",
    hint: "Adds a line-through (solid/dotted/dashed) to player names.",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
  });

  game.settings.register(MODULE_NAME, "lineThroughStyle", {
    name: "Line-through style",
    hint: "Choose the style of the line-through indicator",
    scope: "world",
    config: true,
    default: "dotted",
    type: String,
    choices: {
      none: "None",
      solid: "Solid",
      dotted: "Dotted",
      dashed: "Dashed",
    },
  });

  game.settings.register(MODULE_NAME, "trackUnfocused", {
    name: "Track Tab Unfocused / Alt-Tab",
    hint: "Show status when player switches browser tab or window (loses focus).",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
  });

  game.settings.register(MODULE_NAME, "trackIdle", {
    name: "Track Idle (No Input Timeout)",
    hint: "Show status when player has no keyboard/mouse input for a timeout.",
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
  });

  game.settings.register(MODULE_NAME, "noInputTimeout", {
    name: "No Input Timeout (seconds)",
    hint: "Timeout in seconds for idle detection.",
    scope: "world",
    config: true,
    default: 60,
    type: Number,
    range: {
      min: 10,
      max: 600,
      step: 5,
    },
  });

  game.playerLatencies = {};
  game.playerStatus = {}; // { focused, inactive }
});

Hooks.once("ready", () => {
  if (game.user.isGM) startGMPingLoop();
  setupLatencyReceiver();
  setupFocusAndActivityListeners();
  setupUpdatePlayerListHook();
});

// GM ping loop (every 5 seconds)
function startGMPingLoop() {
  setInterval(() => {
    for (let u of game.users.entries) {
      const user = u[1];
      if (!user.active || user.id === game.user.id) continue;
      sendPingToPlayer(user.id);
    }
  }, 5000);
}

function sendPingToPlayer(playerId) {
  game.socket.emit(`module.${MODULE_NAME}`, {
    type: "ping",
    to: playerId,
    timestamp: Date.now(),
    from: game.user.id,
  });
}

// Players respond to ping with pong
function setupLatencyReceiver() {
  game.socket.on(`module.${MODULE_NAME}`, (data) => {
    if (data.to !== game.user.id) return;

    if (data.type === "ping") {
      game.socket.emit(`module.${MODULE_NAME}`, {
        type: "pong",
        to: data.from,
        timestamp: data.timestamp,
        from: game.user.id,
        pongTime: Date.now(),
      });
    } else if (data.type === "pong" && game.user.isGM) {
      const latency = Date.now() - data.timestamp;
      game.playerLatencies[data.from] = latency;
      updateUserNameWithLatency();
    } else if (data.type === "status" && game.user.isGM) {
      game.playerStatus[data.from] = {
        focused: data.focused,
        inactive: data.inactive,
      };
      updateUserNameWithLatency();
    }
  });
}

// Update player list UI with latency and status indicators
function updateUserNameWithLatency() {
  const playerList = document.querySelectorAll("#players .player-list .player");
  if (!playerList) return;

  playerList.forEach((playerElem) => {
    const userId = playerElem.getAttribute("data-user-id");
    if (!userId) return;

    const baseNameElem = playerElem.querySelector(".name");
    if (!baseNameElem) return;

    // Strip existing latency and status indicators for clean base
    let baseName = baseNameElem.textContent.replace(/\s*\(.*?\)\s*| ZZZ$/, "");

    // Latency
    const latency = game.playerLatencies[userId];
    let latencyText = "";
    if (typeof latency === "number") latencyText = ` (${latency} ms)`;

    // Status indicators based on enabled tracking options
    const status = game.playerStatus[userId] || {};
    const showZZZ = game.settings.get(MODULE_NAME, "showZZZ");
    const trackUnfocused = game.settings.get(MODULE_NAME, "trackUnfocused");
    const trackIdle = game.settings.get(MODULE_NAME, "trackIdle");

    let shouldShowZZZ = false;
    if (showZZZ) {
      if (
        (trackUnfocused && status.focused === false) ||
        (trackIdle && status.inactive === true)
      ) {
        shouldShowZZZ = true;
      }
    }

    let statusText = shouldShowZZZ ? " ZZZ" : "";

    // Apply name + latency + status
    baseNameElem.textContent = baseName + latencyText + statusText;

    // Line-through logic
    const showLine = game.settings.get(MODULE_NAME, "showLineThrough");
    if (
      showLine &&
      ((trackUnfocused && status.focused === false) ||
        (trackIdle && status.inactive === true))
    ) {
      let style = game.settings.get(MODULE_NAME, "lineThroughStyle");
      let cssStyle = "line-through";
      switch (style) {
        case "solid":
          cssStyle = "line-through solid";
          break;
        case "dotted":
          cssStyle = "line-through dotted";
          break;
        case "dashed":
          cssStyle = "line-through dashed";
          break;
        default:
          cssStyle = "line-through";
      }
      playerElem.style.textDecoration = cssStyle;
      playerElem.style.textDecorationColor = "red";
    } else {
      playerElem.style.textDecoration = "none";
      playerElem.style.textDecorationColor = "inherit";
    }
  });
}

// Focus and activity tracking for players
function setupFocusAndActivityListeners() {
  if (!game.user.isGM) {
    // Track focus/unfocus if enabled
    if (game.settings.get(MODULE_NAME, "trackUnfocused")) {
      window.addEventListener("focus", () => {
        setPlayerFocusStatus(true);
      });
      window.addEventListener("blur", () => {
        setPlayerFocusStatus(false);
      });
      // Init state
      setPlayerFocusStatus(document.hasFocus());
    } else {
      setPlayerFocusStatus(true);
    }

    // Track idle if enabled
    if (game.settings.get(MODULE_NAME, "trackIdle")) {
      const activityEvents = ["mousemove", "keydown", "mousedown", "touchstart"];
      activityEvents.forEach((event) => {
        window.addEventListener(event, () => {
          setPlayerActiveStatus(true);
          clearTimeout(game._inactiveTimeout);
          game._inactiveTimeout = setTimeout(() => {
            setPlayerActiveStatus(false);
          }, game.settings.get(MODULE_NAME, "noInputTimeout") * 1000);
        });
      });
      // Init state
      setPlayerActiveStatus(true);
    } else {
      setPlayerActiveStatus(true);
    }
  }
}

function setPlayerFocusStatus

const MODULE_NAME = "player-status-tracker";

Hooks.once("init", () => {
  console.log(`[${MODULE_NAME}] Initializing`);

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
  game.playerStatus = {};
});

Hooks.once("ready", () => {
  if (game.user.isGM) {
    startGMPingLoop();
  }
  setupSocketListeners();
  setupPlayerActivityTracking();
  setupUpdatePlayerListHook();
});

function startGMPingLoop() {
  setInterval(() => {
    for (let user of game.users.entries) {
      const u = user[1];
      if (!u.active || u.id === game.user.id) continue;
      sendPing(u.id);
    }
  }, 5000);
}

function sendPing(playerId) {
  game.socket.emit(`module.${MODULE_NAME}`, {
    type: "ping",
    to: playerId,
    timestamp: Date.now(),
    from: game.user.id,
  });
}

function setupSocketListeners() {
  game.socket.on(`module.${MODULE_NAME}`, (data) => {
    if (!data) return;

    if (data.type === "ping" && data.to === game.user.id) {
      // Player receives ping, respond with pong
      game.socket.emit(`module.${MODULE_NAME}`, {
        type: "pong",
        to: data.from,
        timestamp: data.timestamp,
        from: game.user.id,
        pongTime: Date.now(),
      });
    }
    else if (data.type === "pong" && game.user.isGM) {
      // GM receives pong from player
      const latency = Date.now() - data.timestamp;
      game.playerLatencies[data.from] = latency;
      updatePlayerListDisplay();
    }
    else if (data.type === "status" && game.user.isGM) {
      // GM receives status update from player
      game.playerStatus[data.from] = {
        focused: data.focused,
        inactive: data.inactive,
      };
      updatePlayerListDisplay();
    }
  });
}

function updatePlayerListDisplay() {
  const playerElements = document.querySelectorAll("#players .player-list .player");
  if (!playerElements) return;

  playerElements.forEach((playerElem) => {
    const userId = playerElem.getAttribute("data-user-id");
    if (!userId) return;

    const nameElem = playerElem.querySelector(".name");
    if (!nameElem) return;

    // Clean base name (strip latency/status indicators)
    let baseName = nameElem.textContent.replace(/\s*\(.*?\)\s*| ZZZ$/g, "");

    // Latency text
    const latency = game.playerLatencies[userId];
    const latencyText = (typeof latency === "number") ? ` (${latency} ms)` : "";

    // Status flags
    const status = game.playerStatus[userId] || {};
    const showZZZ = game.settings.get(MODULE_NAME, "showZZZ");
    const trackUnfocused = game.settings.get(MODULE_NAME, "trackUnfocused");
    const trackIdle = game.settings.get(MODULE_NAME, "trackIdle");

    // Should we show ZZZ?
    let showZZZIndicator = false;
    if (showZZZ) {
      if ((trackUnfocused && status.focused === false) || (trackIdle && status.inactive === true)) {
        showZZZIndicator = true;
      }
    }

    const zzzText = showZZZIndicator ? " ZZZ" : "";

    nameElem.textContent = baseName + latencyText + zzzText;

    // Handle line-through style
    const showLine = game.settings.get(MODULE_NAME, "showLineThrough");
    if (
      showLine &&
      ((trackUnfocused && status.focused === false) || (trackIdle && status.inactive === true))
    ) {
      const styleSetting = game.settings.get(MODULE_NAME, "lineThroughStyle");
      let cssDecoration = "line-through";

      if (styleSetting === "solid") cssDecoration = "line-through solid";
      else if (styleSetting === "dotted") cssDecoration = "line-through dotted";
      else if (styleSetting === "dashed") cssDecoration = "line-through dashed";
      else cssDecoration = "line-through";

      playerElem.style.textDecoration = cssDecoration;
      playerElem.style.textDecorationColor = "red";
    } else {
      playerElem.style.textDecoration = "none";
      playerElem.style.textDecorationColor = "inherit";
    }
  });
}

function setupPlayerActivityTracking() {
  if (game.user.isGM) return; // GM does not send status

  let focused = document.hasFocus();
  let inactive = false;

  const sendStatus = () => {
    game.socket.emit(`module.${MODULE_NAME}`, {
      type: "status",
      from: game.user.id,
      focused,
      inactive,
    });
  };

  if (game.settings.get(MODULE_NAME, "trackUnfocused")) {
    window.addEventListener("focus", () => {
      focused = true;
      sendStatus();
    });
    window.addEventListener("blur", () => {
      focused = false;
      sendStatus();
    });
  } else {
    focused = true;
  }

  if (game.settings.get(MODULE_NAME, "trackIdle")) {
    const timeoutSec = game.settings.get(MODULE_NAME, "noInputTimeout");
    let timeoutId;

    const resetInactiveTimer = () => {
      if (inactive) {
        inactive = false;
        sendStatus();
      }
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        inactive = true;
        sendStatus();
      }, timeoutSec * 1000);
    };

    ["mousemove", "mousedown", "keydown", "touchstart"].forEach((eventName) => {
      window.addEventListener(eventName, resetInactiveTimer);
    });

    resetInactiveTimer();
  } else {
    inactive = false;
  }

  sendStatus();
}

function setupUpdatePlayerListHook() {
  Hooks.on("renderPlayerList", () => updatePlayerListDisplay());
  Hooks.on("updateUser", () => updatePlayerListDisplay());
  Hooks.on("renderSidebarTab", () => updatePlayerListDisplay());
}

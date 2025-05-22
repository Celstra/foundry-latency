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

  game.settings.register(MODULE_NAME, "noInputTimeout", {
    name: "No input timeout (seconds)",
    hint: "Time (in seconds) of no mouse/keyboard input before marking inactive",
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

  // Internal latency map and status tracking
  game.playerLatencies = {};
  game.playerStatus = {}; // Track { focused, active } states per player
});

Hooks.once("ready", () => {
  console.log(`[Player Status Tracker] Ready`);

  // Start GM ping loop
  if (game.user.isGM) {
    startGMPingLoop();
  }

  // Setup listeners
  setupLatencyReceiver();
  setupFocusAndActivityListeners();
  setupUpdatePlayerListHook();
});

// --- GM pings players every 5 seconds ---
function startGMPingLoop() {
  console.log(`[Player Status Tracker] GM ping loop starting...`);
  setInterval(() => {
    for (let u of game.users.entries) {
      if (!u[1].active || u[1].id === game.user.id) continue; // Skip self and inactive users
      sendPingToPlayer(u[1].id);
    }
  }, 5000);
}

function sendPingToPlayer(playerId) {
  const timestamp = Date.now();
  // console.log(`[Player Status Tracker] Sent ping to ${playerId} at ${timestamp}`);
  game.socket.emit(`module.${MODULE_NAME}`, {
    type: "ping",
    to: playerId,
    timestamp,
    from: game.user.id,
  });
}

// --- Players respond to ping ---
function setupLatencyReceiver() {
  game.socket.on(`module.${MODULE_NAME}`, async (data) => {
    if (data.to !== game.user.id) return; // Only process messages addressed to self

    if (data.type === "ping") {
      // Respond with pong immediately
      game.socket.emit(`module.${MODULE_NAME}`, {
        type: "pong",
        to: data.from,
        timestamp: data.timestamp,
        from: game.user.id,
        pongTime: Date.now(),
      });
    } else if (data.type === "pong" && game.user.isGM) {
      // GM receives pong from players - calculate latency
      const latency = Date.now() - data.timestamp;
      game.playerLatencies[data.from] = latency;
      updateUserNameWithLatency();
    }
  });
}

// --- Update player list UI ---
function updateUserNameWithLatency() {
  const playerList = document.querySelectorAll("#players .player-list .player");
  playerList.forEach((playerElem) => {
    const userId = playerElem.getAttribute("data-user-id");
    if (!userId) return;

    // Base player name without latency or status
    const baseName = playerElem.querySelector(".name").textContent.replace(/\s*\(.*?\)\s*$/, "");

    // Build latency display
    const latency = game.playerLatencies[userId];
    let latencyText = "";
    if (typeof latency === "number") {
      latencyText = ` (${latency} ms)`;
    }

    // Build status indicators (ZZZ or none)
    const status = game.playerStatus[userId] || {};
    const showZZZ = game.settings.get(MODULE_NAME, "showZZZ");
    let statusText = "";
    if (showZZZ && (status.inactive || !status.focused)) {
      statusText = " ZZZ";
    }

    // Apply text content update
    playerElem.querySelector(".name").textContent = baseName + latencyText + statusText;

    // Apply line-through styling if enabled
    const showLine = game.settings.get(MODULE_NAME, "showLineThrough");
    if (showLine && (status.inactive || !status.focused)) {
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
      // Clear styling if no line-through needed
      playerElem.style.textDecoration = "none";
      playerElem.style.textDecorationColor = "inherit";
    }
  });
}

// --- Focus and Activity Tracking ---

function setupFocusAndActivityListeners() {
  if (!game.user.isGM) {
    // Player side: Track window focus and input activity
    window.addEventListener("focus", () => {
      setPlayerFocusStatus(true);
    });
    window.addEventListener("blur", () => {
      setPlayerFocusStatus(false);
    });

    // Detect keyboard and mouse activity
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

    // Initialize activity state
    setPlayerFocusStatus(document.hasFocus());
    setPlayerActiveStatus(true);
  }

  if (game.user.isGM) {
    // GM side: No local focus needed, but listen for updates from players
  }
}

function setPlayerFocusStatus(focused) {
  game.playerStatus[game.user.id] = game.playerStatus[game.user.id] || {};
  game.playerStatus[game.user.id].focused = focused;
  sendStatusUpdateToGM();
  updateUserNameWithLatency();
}

function setPlayerActiveStatus(active) {
  game.playerStatus[game.user.id] = game.playerStatus[game.user.id] || {};
  game.playerStatus[game.user.id].inactive = !active;
  sendStatusUpdateToGM();
  updateUserNameWithLatency();
}

function sendStatusUpdateToGM() {
  if (!game.user.isGM) {
    game.socket.emit(`module.${MODULE_NAME}`, {
      type: "status",
      from: game.user.id,
      focused: game.playerStatus[game.user.id]?.focused,
      inactive: game.playerStatus[game.user.id]?.inactive,
    });
  }
}

// GM listens for status updates from players
Hooks.on("socketlib.ready", () => {
  if (!game.user.isGM) return;

  game.socket.on(`module.${MODULE_NAME}`, (data) => {
    if (data.type === "status") {
      game.playerStatus[data.from] = {
        focused: data.focused,
        inactive: data.inactive,
      };
      updateUserNameWithLatency();
    }
  });
});

// Also update latency/status display when player list changes
Hooks.on("renderPlayerList", () => {
  updateUserNameWithLatency();
});

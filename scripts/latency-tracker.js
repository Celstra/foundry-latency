Hooks.once("init", () => {
  game.settings.register("latency-tracker", "enableInactivityTracking", {
    name: "Enable Inactivity Tracking",
    hint: "Track players who are idle (no mouse/keyboard input) for a period of time.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("latency-tracker", "inactivityThreshold", {
    name: "Inactivity Timeout (seconds)",
    hint: "How many seconds without input before a user is marked inactive.",
    scope: "world",
    config: true,
    type: Number,
    default: 60
  });

  game.settings.register("latency-tracker", "enableFocusTracking", {
    name: "Enable Focus Tracking",
    hint: "Detect if a user switches tabs or minimizes the window.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

const moduleNamespace = "latency-tracker";
const latencyData = {};

function updateUserDisplay(userId) {
  const user = game.users.get(userId);
  if (!user) return;

  const li = document.querySelector(`#players ol li[data-user-id='${userId}']`);
  if (!li) return;

  const data = latencyData[userId] || {};

  let label = user.name;

  if (user.id !== game.user.id && typeof data.latency === "number") {
    const color = data.latency < 100 ? "green" : data.latency < 200 ? "orange" : "red";
    label += ` (<span style='color:${color}'>${data.latency}ms</span>)`;
  }

  li.querySelector(".player-name").innerHTML = label;

  if (data.focused === false) {
    li.style.textDecoration = "line-through";
    li.style.textDecorationStyle = "solid";
  } else if (data.inactive === true) {
    li.style.textDecoration = "line-through";
    li.style.textDecorationStyle = "dotted";
  } else {
    li.style.textDecoration = "none";
  }
}

Hooks.once("ready", () => {
  const isGM = game.user.isGM;

  if (!isGM) {
    // Player side
    const sendStatus = () => {
      game.socket.emit(`module.${moduleNamespace}`, {
        userId: game.user.id,
        type: "status-update",
        focused: document.hasFocus(),
        timestamp: Date.now()
      });
    };

    if (game.settings.get(moduleNamespace, "enableFocusTracking")) {
      window.addEventListener("focus", sendStatus);
      window.addEventListener("blur", sendStatus);
    }

    if (game.settings.get(moduleNamespace, "enableInactivityTracking")) {
      let lastInputTime = Date.now();

      const activityHandler = () => {
        lastInputTime = Date.now();
      };

      ["mousemove", "keydown", "mousedown", "touchstart"].forEach(event => {
        window.addEventListener(event, activityHandler);
      });

      setInterval(() => {
        const threshold = game.settings.get(moduleNamespace, "inactivityThreshold") * 1000;
        const now = Date.now();
        const inactive = (now - lastInputTime) > threshold;

        game.socket.emit(`module.${moduleNamespace}`, {
          userId: game.user.id,
          type: "inactivity-status",
          inactive
        });
      }, 5000);
    }

    // Respond to ping
    game.socket.on(`module.${moduleNamespace}`, (data) => {
      if (data.type === "ping-request") {
        game.socket.emit(`module.${moduleNamespace}`, {
          userId: game.user.id,
          type: "ping-response",
          timestamp: data.timestamp,
          from: data.from
        });
      }
    });
  }

  if (isGM) {
    // Ping loop
    setInterval(() => {
      game.users.forEach(user => {
        if (user.active && user.id !== game.user.id) {
          const timestamp = Date.now();
          latencyData[user.id] = latencyData[user.id] || {};
          latencyData[user.id].__pingSent = timestamp;
          game.socket.emit(`module.${moduleNamespace}`, {
            type: "ping-request",
            from: game.user.id,
            timestamp,
            userId: user.id
          });
        }
      });
    }, 5000);

    game.socket.on(`module.${moduleNamespace}`, (data) => {
      const userId = data.userId;
      latencyData[userId] = latencyData[userId] || {};

      if (data.type === "ping-response" && data.from === game.user.id) {
        const sent = latencyData[userId].__pingSent;
        if (sent) {
          latencyData[userId].latency = Date.now() - sent;
          updateUserDisplay(userId);
        }
      }

      if (data.type === "status-update") {
        latencyData[userId].focused = data.focused;
        updateUserDisplay(userId);
      }

      if (data.type === "inactivity-status") {
        latencyData[userId].inactive = data.inactive;
        updateUserDisplay(userId);
      }
    });
  }
});

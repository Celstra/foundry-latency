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

Hooks.once("ready", () => {
  const isGM = game.user.isGM;
  const moduleNamespace = "latency-tracker";

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
  }

  if (isGM) {
    game.socket.on(`module.${moduleNamespace}`, (data) => {
      const user = game.users.get(data.userId);
      if (!user) return;

      let label = user.name;
      const playerListElem = Array.from(document.querySelectorAll("#players ol li"))
        .find(el => el.dataset.userId === user.id);
      if (!playerListElem) return;

      // Reset class
      playerListElem.style.textDecoration = "none";

      if (data.type === "status-update" && !data.focused) {
        playerListElem.style.textDecoration = "line-through";
        playerListElem.style.textDecorationStyle = "solid";
      }

      if (data.type === "inactivity-status" && data.inactive) {
        playerListElem.style.textDecoration = "line-through";
        playerListElem.style.textDecorationStyle = "dotted";
      }

      if (data.type === "inactivity-status" && !data.inactive && playerListElem.style.textDecorationStyle === "dotted") {
        playerListElem.style.textDecoration = "none";
      }
    });
  }
});

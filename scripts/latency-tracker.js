const MODULE_ID = "latency-tracker";
const PING_INTERVAL = 5000;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "showLatency", {
    name: "Show Player Latency",
    hint: "Display each player's latency next to their name in the player list (GM only).",
    scope: "client",
    config: true,
    default: true,
    type: Boolean
  });
});

Hooks.once("ready", () => {
  if (!game.user) return;

  console.log(`[Latency Tracker] Loaded for ${game.user.name}, GM: ${game.user.isGM}`);

  const latencyMap = new Map();

  if (game.user.isGM) {
    console.log("[Latency Tracker] GM ping loop starting...");

    // GM sends pings
    setInterval(() => {
      for (let user of game.users.contents) {
        if (!user.active || user.id === game.user.id) continue;

        const timestamp = Date.now();
        console.log(`[Latency Tracker] Sending ping to ${user.name} (${user.id})`);
        game.socket.emit(`module.${MODULE_ID}`, {
          type: "ping",
          from: game.user.id,
          timestamp: timestamp
        });
      }
    }, PING_INTERVAL);

    // GM receives pong
    game.socket.on(`module.${MODULE_ID}`, (data) => {
      if (data.type !== "pong" || data.from === game.user.id) return;

      const latency = Date.now() - data.timestamp;
      latencyMap.set(data.from, latency);
      const user = game.users.get(data.from);
      console.log(`[Latency Tracker] Pong from ${user?.name || data.from}: ${latency}ms`);
    });

    // Delay display update to let DOM render
    setTimeout(() => {
      setInterval(() => {
        if (!game.settings.get(MODULE_ID, "showLatency")) return;

        for (let user of game.users.contents) {
          const listItem = document.querySelector(`#players li[data-user-id="${user.id}"]`);
          if (!listItem) continue;

          const nameSpan = listItem.querySelector(".player-name");
          if (!nameSpan) continue;

          // Reset name
          nameSpan.textContent = user.name;

          const latency = latencyMap.get(user.id);
          if (latency != null) {
            const color = latency < 100 ? "green" : latency < 250 ? "orange" : "red";

            const latencySpan = document.createElement("span");
            latencySpan.style.color = color;
            latencySpan.style.marginLeft = "4px";
            latencySpan.textContent = `(${latency}ms)`;

            nameSpan.appendChild(latencySpan);
          }
        }
      }, PING_INTERVAL);
    }, 1000);

  } else {
    // Player receives ping and responds
    game.socket.on(`module.${MODULE_ID}`, (data) => {
      if (data.type !== "ping") return;

      const latency = Date.now() - data.timestamp;
      console.log(`[Latency Tracker] Received ping at ${Date.now()} (${latency}ms old). Responding.`);

      game.socket.emit(`module.${MODULE_ID}`, {
        type: "pong",
        from: game.user.id,
        timestamp: data.timestamp,
      });
    });
  }
});

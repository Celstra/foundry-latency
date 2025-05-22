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
    // 1. Ping each player
    setInterval(() => {
      for (let user of game.users.contents) {
        if (!user.active || user.id === game.user.id) continue;

        const timestamp = Date.now();
        game.socket.emit(`module.${MODULE_ID}`, {
          type: "ping",
          to: user.id,
          from: game.user.id,
          timestamp,
        });
      }
    }, PING_INTERVAL);

    // 2. Handle pong responses
    game.socket.on(`module.${MODULE_ID}`, (data) => {
      if (data.type !== "pong" || data.from === game.user.id) return;

      const latency = Date.now() - data.timestamp;
      latencyMap.set(data.from, latency);
      console.log(`[Latency Tracker] Pong from ${data.from}: ${latency}ms`);
    });

    // 3. Update UI
    setInterval(() => {
      if (!game.settings.get(MODULE_ID, "showLatency")) return;

      for (let user of game.users.contents) {
        const listItem = document.querySelector(`#players li[data-user-id="${user.id}"]`);
        if (!listItem) continue;

        const nameSpan = listItem.querySelector(".player-name");
        if (!nameSpan) continue;

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
  } else {
    // Player receives ping and sends back pong
    game.socket.on(`module.${MODULE_ID}`, (data) => {
      if (data.type !== "ping" || data.to !== game.user.id) return;

      game.socket.emit(`module.${MODULE_ID}`, {
        type: "pong",
        from: game.user.id,
        timestamp: data.timestamp,
      });
    });
  }
});

const MODULE_ID = "latency-tracker";

Hooks.once("init", () => {
  // Register setting (GM only)
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
  if (!game?.user) return;

  // --- Players send their latency to the GM ---
  if (!game.user.isGM) {
    setInterval(() => {
      game.socket.emit(`module.${MODULE_ID}`, {
        userId: game.user.id,
        latency: game.user.latency ?? null
      });
    }, 5000);
  }

  // --- GM handles latency display ---
  if (game.user.isGM) {
    const latencyMap = new Map();

    // Receive latency reports from players
    game.socket.on(`module.${MODULE_ID}`, (data) => {
      latencyMap.set(data.userId, data.latency);
    });

    // Update display every 5 seconds
    setInterval(() => {
      const showLatency = game.settings.get(MODULE_ID, "showLatency");
      if (!showLatency) return;

      for (let user of game.users.contents) {
        const listItem = document.querySelector(`#players li[data-user-id="${user.id}"]`);
        if (!listItem) continue;

        const nameSpan = listItem.querySelector(".player-name");
        if (!nameSpan) continue;

        // Reset to default name
        nameSpan.textContent = user.name;

        // If latency is available, add it with color
        if (latencyMap.has(user.id)) {
          const latency = latencyMap.get(user.id);
          const color = latency < 100 ? "green" : latency < 250 ? "orange" : "red";

          const latencySpan = document.createElement("span");
          latencySpan.style.color = color;
          latencySpan.style.marginLeft = "4px";
          latencySpan.textContent = `(${latency}ms)`;

          nameSpan.appendChild(latencySpan);
        }
      }
    }, 5000);
  }
});

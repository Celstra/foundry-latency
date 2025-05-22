Hooks.once("ready", () => {
  const isGM = game.user.isGM;

  const PING_INTERVAL = 5000;

  const getLatencyColor = (latency) => {
    if (latency <= 100) return "green";
    if (latency <= 250) return "orange";
    return "red";
  };

  if (isGM) {
    const latencies = {};
    const visibilityStates = {};

    const sendPing = () => {
      game.users.forEach((user) => {
        if (!user.isGM && user.active) {
          const timestamp = Date.now();
          latencies[user.id] = timestamp;
          game.socket.emit("module.latency-tracker", {
            type: "ping",
            userId: user.id,
            timestamp,
          });
        }
      });
    };

    const updateUserNameWithLatency = (userId, latency) => {
      const color = getLatencyColor(latency);
      const user = game.users.get(userId);
      const nameElement = document.querySelector(`[data-user-id="${userId}"] .player-name`);
      if (nameElement && user) {
        const strike = visibilityStates[userId] === false ? "line-through" : "none";
        nameElement.innerHTML = `<span style="text-decoration:${strike}">${user.name} <span style="color:${color}">(${latency}ms)</span></span>`;
      }
    };

    game.socket.on("module.latency-tracker", (data) => {
      if (!data || typeof data !== "object") return;

      if (data.type === "pong" && data.userId) {
        const sentTime = latencies[data.userId];
        if (!sentTime) return;
        const latency = Date.now() - sentTime;
        updateUserNameWithLatency(data.userId, latency);
      }

      if (data.type === "visibility" && typeof data.visible === "boolean") {
        visibilityStates[data.userId] = data.visible;
        // Force update name to reflect visibility change
        updateUserNameWithLatency(data.userId, 0); // latency value will be replaced shortly anyway
      }
    });

    setInterval(sendPing, PING_INTERVAL);
  } else {
    // Handle ping
    game.socket.on("module.latency-tracker", (data) => {
      if (data.type === "ping" && data.timestamp) {
        game.socket.emit("module.latency-tracker", {
          type: "pong",
          userId: game.user.id,
          timestamp: data.timestamp,
        });
      }
    });

    // Handle tab visibility
    const reportVisibility = () => {
      const isVisible = !document.hidden;
      game.socket.emit("module.latency-tracker", {
        type: "visibility",
        userId: game.user.id,
        visible: isVisible,
      });
    };

    document.addEventListener("visibilitychange", reportVisibility);
    window.addEventListener("focus", reportVisibility);
    window.addEventListener("blur", reportVisibility);
  }
});

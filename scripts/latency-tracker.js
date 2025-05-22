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

    game.socket.on("module.latency-tracker", (data) => {
      if (data.type === "pong" && typeof data.userId === "string") {
        const sentTime = latencies[data.userId];
        if (!sentTime) return;
        const latency = Date.now() - sentTime;
        updateUserNameWithLatency(data.userId, latency);
      }
    });

    const updateUserNameWithLatency = (userId, latency) => {
      const color = getLatencyColor(latency);
      const user = game.users.get(userId);
      const nameElement = document.querySelector(`[data-user-id="${userId}"] .player-name`);
      if (nameElement) {
        nameElement.innerHTML = `${user.name} <span style="color:${color}">(${latency}ms)</span>`;
      }
    };

    setInterval(sendPing, PING_INTERVAL);

  } else {
    game.socket.on("module.latency-tracker", (data) => {
      if (!data || typeof data !== "object") return;

      if (data.type === "ping" && data.timestamp) {
        game.socket.emit("module.latency-tracker", {
          type: "pong",
          userId: game.user.id,
          timestamp: data.timestamp,
        });
      }
    });
  }
});

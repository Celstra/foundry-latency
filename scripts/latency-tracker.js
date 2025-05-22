Hooks.once("ready", () => {
  const currentUser = game.user.name;
  const isGM = game.user.isGM;
  console.log(`[Latency Tracker] Loaded for ${currentUser}, GM: ${isGM}`);

  const latencyMap = {};

  const updatePlayerList = () => {
    const playerElements = document.querySelectorAll("#players li.player");
    playerElements.forEach((el) => {
      const userId = el.dataset.userId;
      const latency = latencyMap[userId];
      const nameElem = el.querySelector(".player-name");

      if (!nameElem) return;

      if (latency !== undefined && !isNaN(latency)) {
        nameElem.textContent = game.users.get(userId).name + ` (${latency}ms)`;
      } else {
        nameElem.textContent = game.users.get(userId).name + " (...)";
      }
    });
  };

  if (isGM) {
    const sendPing = () => {
      game.users.forEach((user) => {
        if (!user.isGM && user.active) {
          const timestamp = Date.now();
          latencyMap[user.id] = "...";
          game.socket.emit("module.latency-tracker", {
            type: "ping",
            userId: user.id,
            timestamp: timestamp,
          });
          console.log(`[Latency Tracker] Sent ping to ${user.name} (${user.id}) at ${timestamp}`);
        }
      });
      updatePlayerList();
    };

    game.socket.on("module.latency-tracker", (data) => {
      if (!data || typeof data !== "object") return;

      if (data.type === "pong") {
        console.log(`[Latency Tracker] Received pong:`, data);

        if (!data.timestamp || !data.userId) {
          console.warn("[Latency Tracker] Missing timestamp or userId in pong");
          return;
        }

        const latency = Date.now() - data.timestamp;
        latencyMap[data.userId] = latency;
        console.log(`[Latency Tracker] Calculated latency for ${data.userId}: ${latency}ms`);
        updatePlayerList();
      }
    });

    console.log("[Latency Tracker] GM ping loop starting...");
    sendPing();
    setInterval(sendPing, 5000);
  } else {
    game.socket.on("module.latency-tracker", (data) => {
      if (!data || typeof data !== "object") return;

      if (data.type === "ping" && data.userId === game.user.id && data.timestamp) {
        console.log(`[Latency Tracker] Received ping with timestamp ${data.timestamp}`);
        game.socket.emit("module.latency-tracker", {
          type: "pong",
          userId: game.user.id,
          timestamp: data.timestamp,
        });
        console.log(`[Latency Tracker] Sent pong from ${game.user.name}`);
      }
    });
  }
});

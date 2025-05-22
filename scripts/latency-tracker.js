Hooks.once("ready", () => {
  const currentUser = game.user.name;
  const isGM = game.user.isGM;
  console.log(`[Latency Tracker] Loaded for ${currentUser}, GM: ${isGM}`);

  // Show latency next to player name in the player list
  const updatePlayerList = (latencies) => {
    const playerElements = document.querySelectorAll("#players li.player");
    playerElements.forEach((el) => {
      const userId = el.dataset.userId;
      const latency = latencies[userId];
      const nameElem = el.querySelector(".player-name");

      if (latency !== undefined && nameElem) {
        nameElem.textContent = game.users.get(userId).name + ` (${latency}ms)`;
      }
    });
  };

  // GM sends pings
  if (isGM) {
    const latencyMap = {};

    const sendPing = () => {
      game.users?.forEach((user) => {
        if (!user.isGM && user.active) {
          const timestamp = Date.now();
          latencyMap[user.id] = "..."; // placeholder
          game.socket.emit("module.latency-tracker", {
            type: "ping",
            userId: user.id,
            timestamp,
          });
        }
      });
      updatePlayerList(latencyMap);
    };

    // Listen for pong
    game.socket.on("module.latency-tracker", (data) => {
      if (data.type === "pong" && data.userId && data.timestamp) {
        const latency = Date.now() - data.timestamp;
        latencyMap[data.userId] = latency;
        console.log(`[Latency Tracker] Pong from ${data.userId}: ${latency}ms`);
        updatePlayerList(latencyMap);
      }
    });

    console.log("[Latency Tracker] GM ping loop starting...");
    setInterval(sendPing, 5000); // ping every 5s
  }

  // Player responds to pings
  if (!isGM) {
    game.socket.on("module.latency-tracker", (data) => {
      if (data.type === "ping" && data.userId === game.user.id) {
        game.socket.emit("module.latency-tracker", {
          type: "pong",
          userId: game.user.id,
          timestamp: data.timestamp,
        });
        console.log(`[Latency Tracker] Responded to ping with timestamp ${data.timestamp}`);
      }
    });
  }
});

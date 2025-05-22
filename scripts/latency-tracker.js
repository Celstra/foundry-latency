Hooks.once("ready", () => {
  const currentUser = game.user.name;
  const isGM = game.user.isGM;
  console.log(`[Latency Tracker] Loaded for ${currentUser}, GM: ${isGM}`);

  // Store latencies per userId
  const latencyMap = {};

  // Update latency display next to player names
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
    // GM sends pings every 5 seconds
    const sendPing = () => {
      game.users.forEach((user) => {
        if (!user.isGM && user.active) {
          const timestamp = Date.now();
          // Show placeholder until pong received
          latencyMap[user.id] = "...";
          game.socket.emit("module.latency-tracker", {
            type: "ping",
            userId: user.id,
            timestamp: timestamp,
          });
          console.log(`[Latency Tracker] Sending ping to ${user.name} (${user.id})`);
        }
      });
      updatePlayerList();
    };

    // Listen for pongs from players
    game.socket.on("module.latency-tracker", (data) => {
      if (data.type === "pong" && data.userId && data.timestamp) {
        const latency = Date.now() - data.timestamp;
        latencyMap[data.userId] = latency;
        console.log(`[Latency Tracker] Pong from ${data.userId}: ${latency}ms`);
        updatePlayerList();
      }
    });

    console.log("[Latency Tracker] GM ping loop starting...");
    sendPing();
    setInterval(sendPing, 5000);
  } else {
    // Player listens for ping and replies with pong
    game.socket.on("module.latency-tracker", (data) => {
      if (data.type === "ping" && data.userId === game.user.id && data.timestamp) {
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

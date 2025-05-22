Hooks.once("ready", () => {
  if (!game.user.isGM) return; // Only GM sees everyone's latency

  const LATENCY_UPDATE_INTERVAL = 5000;

  function updatePlayerListLatencies() {
    const players = game.users.contents.filter(u => u.active);

    for (let player of players) {
      const listItem = document.querySelector(`#players li[data-user-id="${player.id}"]`);
      if (!listItem) continue;

      // Clean old latency info if present
      const nameSpan = listItem.querySelector(".player-name");
      if (!nameSpan) continue;

      // Remove old latency in parentheses (if present)
      nameSpan.textContent = nameSpan.textContent.replace(/\s\(\d+ms\)$/, "");

      // Append new latency
      const latency = player.latency ?? "N/A";
      nameSpan.textContent += ` (${latency}ms)`;
    }
  }

  // Initial update
  updatePlayerListLatencies();

  // Periodic updates
  setInterval(updatePlayerListLatencies, LATENCY_UPDATE_INTERVAL);
});

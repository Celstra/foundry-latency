# Player Status Tracker

**Author:** Celstra  
**Version:** 1.0.0  
**Compatible with Foundry VTT 13**

---

## Overview

Player Status Tracker tracks the network latency (ping), browser tab/window focus, and inactivity status of connected players in Foundry VTT. It provides GMs with real-time visual indicators next to player names, showing:

- Live latency in milliseconds, color-coded to indicate good (green) or poor (red) ping.
- Tab or window focus loss indicated by a customizable solid line through player names.
- Player inactivity (no mouse/keyboard input) with a customizable dotted or dashed line indicator.
- All indicators are fully toggleable and configurable by the GM.

---

## Features

- Displays player latency next to their names for GMs.
- Detects tab focus and window minimization status.
- Detects inactivity timeout based on configurable no input duration.
- Customizable indicator colors, line styles (solid, dotted, dashed), and thickness.
- User-friendly settings menu for all options.

---

## Installation

1. Clone or download the repository from GitHub.
2. Place the folder into your FoundryVTT `modules` directory.
3. Enable **Player Status Tracker** from the Foundry module settings.
4. Configure your preferred options in the module settings.

---

## Usage

- The GM sees latency and focus/inactivity indicators next to each player’s name.
- Players automatically send their status updates to the GM.
- Adjust settings for visual styles and timeout thresholds to fit your table’s needs.

---

## Compatibility

- Foundry VTT 13.x

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## Contact

Developed by Celstra  
GitHub: https://github.com/Celstra/player-status-tracker

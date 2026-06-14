# 🚀 Cosmic Math — Iris

Times-tables (1×–12×) game for Iris. Sister project to [pi-iris](https://github.com/angelakim0126/pi-iris).

## Modes

- **🪐 Planet Ladder** — Pick a times table (e.g., 7×). Climb ×1 → ×12 with multiple-choice answers. Earn a planet star only by getting all 12 right in one run.
- **⚡ Speed Round** — 60 seconds of random 1–12 × 1–12 multiplications. Score = number correct. Leaderboard with name + score + timestamp.

## Run locally

```bash
cd ~/Documents/iris-math
python3 -m http.server 8000
# open http://localhost:8000
```

## Progress storage

`localStorage` keys: `imth_mastered` (JSON array of mastered table numbers), `imth_speed_best`, `imth_leaderboard`, `imth_test_name`, `imth_sound`. "Start over" on home clears all of these.

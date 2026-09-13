# Sens Home Game Picker

Round-robin picker for Ottawa Senators home games. Players take turns, in a
fixed rotation order, claiming one home game at a time. Each game shows either
who picked it or that it's available.

## Run it

```
npm install
npm start
```

Then open http://localhost:3000 (or `http://<your-machine-ip>:3000` from
another device on the same network).

State (users, turn order, picks) is stored in `data/state.json` and persists
across restarts.

## How it works

- Players are configured in rotation order (4 to start: Mike, Johnny, Gianni,
  Eclipse). Add more anytime from the sidebar — they're appended to the end
  of the rotation.
- The banner at the top shows whose turn it is. Only the current player's
  "Pick" button is shown on available games.
- After a pick, the turn passes to the next player and wraps back to the
  first player after the last.
- "Skip current turn" advances the rotation without a pick (e.g. if someone
  has no interest in any of the remaining games).
- "Undo last action" reverses the most recent pick or skip.
- "Reset all picks" clears every pick and restarts the rotation from the top.
- Games can be added from the sidebar if the schedule needs a correction or
  addition.

## About the seeded schedule

`data/state.json` is pre-loaded with the Senators' 2026-27 home schedule
(41 games) pulled from public schedule sites. Sources disagreed on a couple
of entries (a possible Jan. 14 game and an Apr. 4 game appeared on one source
but not others), so **double-check the full schedule against the official
NHL/Senators site before relying on this for real ticket decisions**, and use
the "Add a game" / edit-in-`data/state.json` options to correct anything
that's off. Two of the games (Dec 18 & 20 vs. Chicago) are the NHL Global
Series games played in Dusseldorf, Germany, but still count as Ottawa home
games.

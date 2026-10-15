# TwinShip 3D viewer — real-time analytics demo (≈ 4½ min)

Open **Live data** at least 15 minutes before: the exhaust warning appears 15 minutes after the page loads.
The chat needs `OLLAMA_API_KEY` in `.env` (the server must have been restarted after setting it).

## 1. Live ship & sea state — 45 s

- **Show:** Live data → **Voyage** view, **Follow ship**.
  **Why:** the ship sails as the data says — a reading a second from the vessel's time series.
- **Show:** the top bar (heading, speed, true wind, position) and the **Motion**, **Attitude** and **Wind · relative** panels.
  **Why:** navigation and motion — speed, heading, rate of turn, roll, pitch, heave — live.
- **Show:** the sea round the ship, the waves and the bow wave.
  **Why:** the wind and sea state from the data drive the 3D sea itself.

## 2. Propulsion, energy & wind assist — 35 s

- **Show:** the cards under the scene: **Efficiency** (kg/nm, fuel t/h, shaft rpm) and **Wind assist** (thrust kN, fuel saving %).
  **Why:** performance at a glance — what the ship burns, and what the sails save.
- **Show:** the **Propellers** and **Suction sails** callouts on the ship.
  **Why:** each reading sits on the part it comes from.

## 3. Hull & machinery health — 35 s

- **Show:** switch to **Systems**; point to the system cards (Propulsion, Energy, Wind assist, Hull & structure, Deck).
  **Why:** every system's health against its limits — NORMAL / WARNING.
- **Show:** the readings in the tree (hull stress, engine, propellers, crane, reefer).
  **Why:** hull stress per strain gauge and machinery temperatures, pressures, vibration — all monitored.

## 4. Alarms on the 3D ship — 40 s

- **Show:** the **⚠ 1** in the top bar and the **"!"** on the Engine.
  **Why:** a reading past its limit (exhaust > 400 °C) is placed where it happens on the ship.
- **Show:** click the warning (Alarms & events, under the tree).
  **Why:** straight from the alarm to the component, its trend and the signals that drive it.

## 5. Replay & event log — 60 s

- **Show:** open the **EVENT LOG** tab on the scene's right edge.
  **Why:** every row of the vessel's time series, newest first — the ship keeps sailing beside it.
- **Show:** **All** → **Warnings**.
  **Why:** all the data, or only the rows where a reading is past its limit.
- **Show:** open a warning row: its readings (the one past its limit in amber) and the lifecycle **Raised → Peak → Acknowledged → Cleared**; the camera focuses on the Engine.
  **Why:** an alarm is a story in time, with every reading at that moment.
- **Show:** drag the **replay bar** back, then step a minute at a time (⏪ ⏩).
  **Why:** the ship, the readings and the log all go back — the log lists only what had happened by then.
- **Show:** **go live**, then **Acknowledge**.
  **Why:** the operator's action is recorded on the alarm.

## 6. AI assistant — 45 s

- **Show:** on the warning row, **Ask about this** (or the chat icon in the top bar → *"Why is it happening?"*).
  **Why:** a language model answers from the live data, the event log and the ontology — in words.
- **Show:** the components it highlights on the ship and the events it cites.
  **Why:** the answer is grounded in the ship's own data, and shows where on the ship.

## Close — 10 s

- **Say:** "Live ship and sea, performance, health, alarms in 3D, replay and an assistant — one model on the vessel's time series."

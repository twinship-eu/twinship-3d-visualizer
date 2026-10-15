# Futuristic vessel — time-series workbook

The futuristic RoRo vessel's **operational** data over time, in one sheet, so
the 3D viewer's Live data plays real readings instead of its simulation.

- Template with 30 min of sample data: [`futuristic-vessel-timeseries-template.xlsx`](./futuristic-vessel-timeseries-template.xlsx)
- The script that generates it: [`generate-timeseries-template.py`](./generate-timeseries-template.py)
- The converter into the viewer: [`scripts/convert-timeseries.py`](../../scripts/convert-timeseries.py)

Both scripts need `openpyxl` (`pip install openpyxl`).

## Where it comes from

The `twinship-data-pipeline` holds the vessel's **static** description:
`data/RoRo Futuristic Vessel KG Working File.xlsx`, one sheet per component type
(GENSET, ESS, EM, CPP, WASP, PMS…), with the instances — `FV-GN-1`, `FV-CPP-2`,
`FV-WASP-1`… — that `futuristic_extraction.py` turns into the knowledge graph.
There is no time dimension yet: the ontology's `draft_time_mode.ttl` is a
placeholder.

The time series keeps the pipeline's conventions — the KG's component IDs, the
`TWINSHIP-<PARAMETER>-IN-<UNIT>` names of the conventional vessels' operational
sheets (`ALL INFO`, `Engine Parameters`) or of the component sheets — so the
harmonisation can read it later too.

## The sheet

One `TIMESERIES` sheet (plus a `README`): **one row per moment, one column per
reading**, every component side by side. The column's name says whose reading
it is: `<COMPONENT-ID>.TWINSHIP-<PARAMETER>-IN-<UNIT>`.

| Row | What |
|---|---|
| 1 | The component's group — its KG ID, and what it is (`FV-RR-1 · VESSEL: NAVIGATION, MOTION, VOYAGE`) |
| 2 | The column's name, `FV-GN-1.TWINSHIP-EXHAUST-GAS-TEMPERATURE-MAX-IN-°C` — keep as is |
| 3 | Type (`DATETIME`, `DOUBLE`, `ENUM (…)`) |
| 4 | Warning limit: a number (from it up) or `<n` (from it down); empty for none |
| 5 | Alarm limit, the same way |
| 6 on | Data. Column A: `TIMESTAMP-UTC` |

The columns, grouped by component:

| Component | Readings | The viewer shows it as |
|---|---|---|
| `FV-RR-1` navigation, motion, voyage | Position, heading, COG, SOG, STW, rate of turn, draught fore/aft, roll, pitch, heave, operational mode, autonomy level, distance to go | Top bar, Motion, the ship's speed in the scene |
| `FV-RR-1` weather | True wind speed and direction, Hs, cloud cover, precipitation | The scene's wind and sea, relative wind |
| `FV-GN-1`, `FV-GN-2` | Speed, generator power, load, fuel rate and total, cooling water, exhaust max and its cylinder | **Engine** |
| `FV-ESS-1` | State of charge, power | Energy, battery |
| `FV-EMSH-1/2` | Shaft power, speed, torque | **Propellers**: rpm, power, torque; the scene's propellers |
| `FV-CPP-1/2` | Pitch, rudder angle | Propellers, rudder |
| `FV-WASP-1/2` | Propulsive power, power saved, thrust, fan speed | **WAPS** |
| `SG-01` … `SG-05` | Bending stress, % of allowable | **Base Hull** sensors |

## Names and the ontology

Checked against the ontology (`twinship-data-pipeline/ontology`) and the KG
workbook's names (`dagster_pipeline/*extraction.py`): of the 61 columns,

- **18 are properties the ontology has** — blue names in row 2, each named as the KG names it:
  the gensets' speed, fuel rate (in **MT/h**, the ontology's unit), total fuel and cooling water;
  the motor shafts' speed and torque; the rudder angle; the suction sails' power and efficiency.
  Two of them (genset speed, cooling water) have no column of that name in the futuristic
  workbook, only the maximum's: named by the KG's own pattern, to confirm.
- **43 are proposed** — orange names. The ontology has no navigation, motion or weather
  properties (`draft_time_mode.ttl` is a placeholder, `weatherconditions.ttl` defines none), only the
  *maximum* of a draught, a generator's power or a propeller's pitch, and no exhaust, load, state
  of charge, thrust or strain properties for this vessel.

The **`ONTOLOGY` sheet** lists every column with its property (or the one proposed, named as the
ontology names its own: `tw` + component + quantity + `In` + unit), its unit and a note — the
list to give the ontology team. One thing to raise with them: `twEMSHTorqueInKN` says
kilonewtons; a torque is kN·m, and the values here are kN·m.

## How to fill it in

- **Time**: ISO 8601 in UTC (`2026-09-29T06:00:00Z`) or an Excel date, one row
  per moment, increasing. Any regular interval: the viewer plays at 1 Hz and
  interpolates between rows; 1–10 s gives smooth trends.
- **IDs and names**: exactly as in row 2. A column you have no data for can be
  left empty or deleted; one you add is carried along (the viewer uses those it
  knows, below).
- **No reading**: leave the cell empty.
- **Limits** in rows 4–5, not in the data: the viewer raises its warnings and
  alarms from them.

The sample plays a quiet half hour under way at ~18 kn, the design speed (gensets ~82% loaded), with one event:
genset 1's cylinder 4 exhaust rises past 400 °C for ~14 min, peaking at
~424 °C — a warning, briefly an alarm.

## Into the viewer

The viewer does not read Excel — a real ship would stream its readings, not
send a workbook. The workbook is converted beforehand into what a stream would
deliver:

```sh
python scripts/convert-timeseries.py docs/live-data/futuristic-vessel-timeseries-template.xlsx
```

writes `public/live-data/futuristic-vessel-timeseries.json` — the recording the
viewer plays. For data that must not be committed (a partner's), convert it
under a `.local.json` name, which git ignores, and point the viewer at it in
`.env.local` (ignored too):

```sh
python scripts/convert-timeseries.py grimaldi.xlsx public/live-data/grimaldi.local.json
echo "NEXT_PUBLIC_LIVE_RECORDING_URL=/live-data/grimaldi.local.json" >> .env.local
```

The converter checks the layout, the limits and the timestamps, and fails
naming the row or cell at fault.

## How the viewer plays it

`features/live-data/lib/recorded-source.ts`, the live data's source:

- **Plays** the recording at 1 Hz, looped, opening two minutes after its first
  warning, so the cockpit starts on the story. The top bar says `REC`; `SIM`
  when there is no recording.
- **Maps** the columns it knows onto the cockpit's readings
  (`live-data-recording-config.ts`): two gensets as one Engine (mean load and
  speed, fuel summed, the hotter exhaust), the two shafts and propellers, the
  two sails. What the recording lacks stays simulated.
- **Raises alarms** from each column's limits: a warning from the warning
  limit, an alarm from the alarm limit, cleared after a minute back within
  them. The part lights up until it is acknowledged or silenced, and the
  timeline replays it.
- **The scene follows** the recorded speed, shaft speed and wind — its sea is
  the one that wind raises. Roll, pitch, heave and Hs are taken from that
  scene, not from the file, so the instruments agree with the ship as seen.

The 3D model's parts are coarser than the KG's components, so a part stands for several:

| 3D part | KG components |
|---|---|
| Engine | `FV-GN-1/2`, `FV-ESS-1` |
| Propellers | `FV-EMSH-1/2`, `FV-EMM-1/2`, `FV-CPP-1/2` |
| WAPS | `FV-WASP-1/2` |
| Base Hull | `FV-RR-1`, strain gauges |

## Open questions

1. **Exhaust per cylinder**: the template keeps the maximum and its cylinder;
   with the real sensors, one column per cylinder (`…-CYL-1` … `-CYL-10` for the
   Wärtsilä 10V31) is simple to add.
2. **The 43 proposed properties** (see *Names and the ontology*), from navigation
   and weather to hull structural monitoring and the ESS's state of charge, need the
   ontology team.
3. **WAPS**: the KG has **suction sails**; the viewer's texts now say so, and show the fans'
   speed. The ontology's `SuctionSail` is defined as "Flettner rotor or similar": to check.
4. **Operational mode** and **autonomy level** would be the first things for
   `draft_time_mode.ttl` to define.
5. **Recorded attitude and sea state**: played from the file instead, the ship
   seen would not match — until the scene can take a sea state rather than
   raise it from the wind.
6. **Cloud cover and precipitation** are converted but not yet used: the scene's
   weather could follow them.
7. **Sensor tags**: if the real data comes with the ship's own tag names, a row
   mapping them to these names lets the converter rename them.

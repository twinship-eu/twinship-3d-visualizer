import type { LiveSnapshot } from "@/features/live-data/live-data-types";
import type { HudPalette, PaneSystem } from "../bridge-config";

/** What a system's card is drawn with: the system, the data, and how. */
type CardDrawing = {
  system: PaneSystem;
  snapshot: LiveSnapshot;
  history: LiveSnapshot[];
  palette: HudPalette;
  /** Its system has an alarm waiting: the card turns amber. */
  isAlarmed: boolean;
};

/** What a window's HUD is drawn with: its systems' cards, those shown. */
export type WindowDrawing = {
  cards: CardDrawing[];
};

/** Each card's own box, in its drawing's units: scaled to its cell of the window. */
const CARD_WIDTH = 560;
const CARD_HEIGHT = 244;
/** Room round and between the cards, as a share of the window's height. */
const MARGIN_SHARE = 0.05;

const SANS = "600 {size}px system-ui, -apple-system, 'Segoe UI', sans-serif";
const MONO = "600 {size}px ui-monospace, 'SF Mono', Menlo, monospace";
const font = (family: string, size: number) => family.replace("{size}", String(size));

type Ctx = CanvasRenderingContext2D;

function text(ctx: Ctx, value: string, x: number, y: number, family: string, size: number, color: string, align: CanvasTextAlign = "left") {
  ctx.font = font(family, size);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}

/** A reading and its label, side by side: "Fuel 1.43". */
function reading(ctx: Ctx, label: string, value: string, x: number, y: number, palette: HudPalette, valueColor = palette.text) {
  text(ctx, label, x, y, SANS, 22, palette.muted);
  ctx.font = font(SANS, 22);
  const width = ctx.measureText(`${label} `).width;
  text(ctx, value, x + width, y, MONO, 24, valueColor);
}

function card(ctx: Ctx, x: number, y: number, width: number, height: number, palette: HudPalette, isAlarmed: boolean) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 18);
  ctx.fillStyle = palette.card;
  ctx.fill();
  ctx.lineWidth = isAlarmed ? 4 : 2;
  ctx.strokeStyle = isAlarmed ? palette.warn : palette.cardLine;
  ctx.stroke();
}

/** A heading tape: ten-degree ticks round the heading, the heading boxed. */
function headingTape(ctx: Ctx, headingDeg: number, x: number, y: number, width: number, palette: HudPalette) {
  const pxPerDeg = width / 50;
  ctx.strokeStyle = palette.muted;
  ctx.lineWidth = 2;
  for (let deg = Math.floor((headingDeg - 25) / 5) * 5; deg <= headingDeg + 25; deg += 5) {
    const tickX = x + width / 2 + (deg - headingDeg) * pxPerDeg;
    const isMajor = deg % 10 === 0;
    ctx.beginPath();
    ctx.moveTo(tickX, y + 34);
    ctx.lineTo(tickX, y + (isMajor ? 54 : 46));
    ctx.stroke();
    if (isMajor) text(ctx, String(((deg % 360) + 360) % 360).padStart(3, "0"), tickX, y + 24, MONO, 22, palette.muted, "center");
  }
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + width / 2, y + 28);
  ctx.lineTo(x + width / 2, y + 62);
  ctx.stroke();
  text(ctx, `${Math.round(headingDeg).toString().padStart(3, "0")}°`, x + width / 2, y + 104, MONO, 44, palette.text, "center");
}

/** A line of the last minute of a reading, in a box. */
function sparkline(ctx: Ctx, values: number[], x: number, y: number, width: number, height: number, color: string) {
  if (values.length < 2) return;
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  values.forEach((value, index) => {
    const px = x + (index / (values.length - 1)) * width;
    const py = y + height - ((value - low) / span) * height;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
}

/** Each system's card, drawn in its box: the design's glass panels. */
function systemCard(ctx: Ctx, drawing: CardDrawing, x: number, y: number, width: number) {
  const { system, snapshot, history, palette, isAlarmed } = drawing;
  const { energy, windAssist, propulsion, hull, deck } = snapshot.systems;
  const status = isAlarmed ? { label: "WARN", color: palette.warn } : { label: "OK", color: palette.ok };
  const statusText = () => text(ctx, status.label, x + width - 26, y + 44, SANS, 22, status.color, "right");
  const left = x + 26;

  switch (system) {
    case "energy":
      card(ctx, x, y, width, 196, palette, isAlarmed);
      text(ctx, "Engine · gensets", left, y + 44, SANS, 26, palette.text);
      statusText();
      text(ctx, energy.engineLoadPct.toFixed(0), left, y + 112, MONO, 64, isAlarmed ? palette.warn : palette.text);
      text(ctx, "% load", left + 84, y + 110, SANS, 22, palette.muted);
      reading(ctx, "Fuel", `${energy.fuelTph.toFixed(2)} t/h`, left, y + 158, palette);
      reading(ctx, "Exh", `${energy.exhaustTempC.toFixed(0)}°`, left + width / 2 - 10, y + 158, palette, isAlarmed ? palette.warn : palette.text);
      reading(ctx, "Batt", `${energy.batteryPct.toFixed(0)}%`, left, y + 186, palette);
      reading(ctx, "RPM", energy.engineRpm.toFixed(0), left + width / 2 - 10, y + 186, palette);
      return;
    case "wind":
      card(ctx, x, y, width, 196, palette, isAlarmed);
      text(ctx, "Suction sails", left, y + 44, SANS, 26, palette.text);
      statusText();
      text(ctx, windAssist.thrustKn.toFixed(0), left, y + 112, MONO, 64, palette.text);
      text(ctx, "kN", left + 84, y + 110, SANS, 22, palette.muted);
      text(ctx, `−${windAssist.fuelSavingPct.toFixed(0)}% fuel`, left + 140, y + 110, SANS, 22, palette.ok);
      reading(ctx, "Fan 1", windAssist.fanRpm[0].toFixed(0), left, y + 164, palette);
      reading(ctx, "Fan 2", windAssist.fanRpm[1].toFixed(0), left + width / 2 - 10, y + 164, palette);
      return;
    case "nav": {
      headingTape(ctx, snapshot.navigation.headingDeg, x, y - 8, width, palette);
      card(ctx, x + 30, y + 124, width - 60, 104, palette, false);
      const column = (width - 60) / 3;
      [
        ["SOG", snapshot.navigation.speedOverGroundKn.toFixed(1)],
        ["COG", `${snapshot.navigation.courseOverGroundDeg.toFixed(0).padStart(3, "0")}°`],
        ["ROT", snapshot.navigation.rateOfTurnDegPerMin.toFixed(1)],
      ].forEach(([label, value], index) => {
        text(ctx, label, x + 54 + column * index, y + 160, SANS, 22, palette.muted);
        text(ctx, value, x + 54 + column * index, y + 206, MONO, 36, palette.text);
      });
      return;
    }
    case "hull": {
      const stress = snapshot.sensors["SG-03"] ?? 0;
      card(ctx, x, y, width, 196, palette, isAlarmed);
      text(ctx, isAlarmed ? "⚠ Bending stress" : "Bending stress", left, y + 44, SANS, 26, isAlarmed ? palette.warn : palette.text);
      text(ctx, `${stress.toFixed(0)}%`, left, y + 112, MONO, 64, isAlarmed ? palette.warn : palette.text);
      text(ctx, "frame 112", left + 150, y + 110, SANS, 22, palette.muted);
      sparkline(ctx, history.slice(-60).map((entry) => entry.sensors["SG-03"] ?? 0), left, y + 124, width - 52, 30, isAlarmed ? palette.warn : palette.accent);
      reading(ctx, "Roll", `${hull.rollDeg.toFixed(1)}°`, left, y + 186, palette);
      reading(ctx, "Pitch", `${hull.pitchDeg.toFixed(1)}°`, left + width / 2 - 10, y + 186, palette);
      return;
    }
    case "propulsion":
      card(ctx, x, y, width, 196, palette, isAlarmed);
      text(ctx, "Propellers", left, y + 44, SANS, 26, palette.text);
      statusText();
      text(ctx, propulsion.shaftRpm.toFixed(0), left, y + 112, MONO, 64, palette.text);
      text(ctx, "rpm", left + 124, y + 110, SANS, 22, palette.muted);
      reading(ctx, "Pitch", `${propulsion.pitchPct.toFixed(0)}%`, left, y + 158, palette);
      reading(ctx, "Power", `${propulsion.powerMw.toFixed(2)} MW`, left + width / 2 - 10, y + 158, palette);
      reading(ctx, "Reefer", `${deck.reeferTempC.toFixed(1)}°C`, left, y + 186, palette);
      reading(ctx, "Crane", deck.craneState, left + width / 2 - 10, y + 186, palette);
      return;
  }
}

/**
 * A window's HUD, drawn on its canvas: its systems' cards in the grid that
 * draws them largest, each scaled to fill its cell, so it reads from across
 * the room. Transparent where nothing is drawn: the sea shows.
 */
export function drawHudWindow(ctx: Ctx, { cards }: WindowDrawing) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  if (cards.length === 0) return;

  // The grid that draws the cards the largest: stacked, side by side, or between
  const margin = height * MARGIN_SHARE;
  const layouts = Array.from({ length: cards.length }, (_, index) => {
    const columns = index + 1;
    const rows = Math.ceil(cards.length / columns);
    const cellWidth = (width - margin * (columns + 1)) / columns;
    const cellHeight = (height - margin * (rows + 1)) / rows;
    return { columns, cellWidth, cellHeight, scale: Math.min(cellWidth / CARD_WIDTH, cellHeight / CARD_HEIGHT) };
  });
  const { columns, cellWidth, cellHeight, scale } = layouts.reduce((best, layout) => (layout.scale > best.scale ? layout : best));
  cards.forEach((card, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + column * (cellWidth + margin) + (cellWidth - CARD_WIDTH * scale) / 2;
    const y = margin + row * (cellHeight + margin);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    systemCard(ctx, card, 0, card.system === "nav" ? 8 : 0, CARD_WIDTH);
    ctx.restore();
  });
}

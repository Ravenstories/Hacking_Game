import type { Tool } from "../types";

export const tools: Tool[] = [
  {
    id: "scanner",
    name: "Scanner",
    description: "Reveals one stable route hint before the hack starts.",
    requiredHackingStat: 1,
    charges: 1,
    traceModifier: -4,
  },
  {
    id: "spoof-token",
    name: "Spoof Token",
    description: "Absorbs one wrong auth pulse before trace climbs.",
    requiredHackingStat: 1,
    charges: 1,
    traceModifier: -8,
  },
  {
    id: "packet-filter",
    name: "Packet Filter",
    description: "Reduces noise in surveillance contracts.",
    requiredHackingStat: 3,
    charges: 2,
    traceModifier: -6,
  },
  {
    id: "signal-stabilizer",
    name: "Signal Stabilizer",
    description: "Slows trace gain during timing-based hacks.",
    requiredHackingStat: 2,
    charges: 1,
    traceModifier: -5,
  },
];

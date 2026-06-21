import type { HackingStat } from "../../types";

export type DoorRelayOptions = {
  contractId: string;
  hackingStat: HackingStat;
  securityLevel: HackingStat;
  traceRisk: number;
  toolId: string;
  toolTraceModifier: number;
};

export type DoorRelayConfig = {
  contractId: string;
  toolId: string;
  scannerActive: boolean;
  timeLimit: number;
  startingTrace: number;
  tracePerSecond: number;
  mistakeTrace: number;
  correctTraceDrop: number;
  shieldCharges: number;
};

export type DoorRelayState = {
  expectedIndex: number;
  trace: number;
  mistakes: number;
  shieldCharges: number;
  shieldAbsorbed: number;
  completed: boolean;
  failed: boolean;
  message: string;
};

export const routeSequence = ["INTAKE", "BUFFER", "ISOLATOR", "LATCH", "ACTUATOR"] as const;

export function createDoorRelayConfig(options: DoorRelayOptions): DoorRelayConfig {
  const statDelta = options.hackingStat - options.securityLevel;
  const underleveled = Math.max(0, options.securityLevel - options.hackingStat);
  const timeLimit = clamp(45 + statDelta * 4 - underleveled * 6, 24, 56);
  const startingTrace = clamp(
    options.traceRisk - options.hackingStat * 2 + options.toolTraceModifier + underleveled * 12,
    4,
    86,
  );
  const tracePerSecond = clamp(
    0.85 + options.securityLevel * 0.18 - Math.max(0, statDelta) * 0.12 + underleveled * 0.34,
    0.55,
    2.4,
  );
  const mistakeTrace = clamp(16 + options.securityLevel * 4 - options.hackingStat * 2 + underleveled * 8, 10, 44);

  return {
    contractId: options.contractId,
    toolId: options.toolId,
    scannerActive: options.toolId === "scanner",
    timeLimit,
    startingTrace,
    tracePerSecond,
    mistakeTrace,
    correctTraceDrop: Math.max(1, 3 + options.hackingStat - underleveled * 2),
    shieldCharges: options.toolId === "spoof-token" ? 1 : 0,
  };
}

export function createDoorRelayState(config: DoorRelayConfig): DoorRelayState {
  return {
    expectedIndex: 0,
    trace: config.startingTrace,
    mistakes: 0,
    shieldCharges: config.shieldCharges,
    shieldAbsorbed: 0,
    completed: false,
    failed: false,
    message: config.scannerActive
      ? "Scanner tagged the next stable relay node."
      : "Route signal from intake to actuator.",
  };
}

export function applyTraceTick(state: DoorRelayState, config: DoorRelayConfig): DoorRelayState {
  if (state.completed || state.failed) {
    return state;
  }

  const trace = clamp(state.trace + config.tracePerSecond, 0, 100);

  return {
    ...state,
    trace,
    failed: trace >= 100,
    message: trace >= 100 ? "Trace lock reached. Relay burned." : state.message,
  };
}

export function applyRelayNode(state: DoorRelayState, nodeIndex: number, config: DoorRelayConfig): DoorRelayState {
  if (state.completed || state.failed) {
    return state;
  }

  if (nodeIndex === state.expectedIndex) {
    const expectedIndex = state.expectedIndex + 1;
    const completed = expectedIndex >= routeSequence.length;

    return {
      ...state,
      expectedIndex,
      completed,
      trace: Math.max(0, state.trace - config.correctTraceDrop),
      message: completed
        ? "Door relay accepted. Access granted."
        : config.scannerActive
          ? `${routeSequence[nodeIndex]} bridged. Scanner moved to next relay.`
          : `${routeSequence[nodeIndex]} bridged.`,
    };
  }

  if (state.shieldCharges > 0) {
    return {
      ...state,
      mistakes: state.mistakes + 1,
      shieldCharges: state.shieldCharges - 1,
      shieldAbsorbed: state.shieldAbsorbed + 1,
      message: "Spoof token absorbed the bad pulse.",
    };
  }

  const trace = Math.min(100, state.trace + config.mistakeTrace);

  return {
    ...state,
    mistakes: state.mistakes + 1,
    trace,
    failed: trace >= 100,
    message: trace >= 100 ? "Trace lock reached. Relay burned." : "Bad pulse. Trace spike detected.",
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

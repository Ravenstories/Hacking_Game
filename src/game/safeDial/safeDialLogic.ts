import type { HackingStat } from "../../types";

export type SafeDialOptions = {
  contractId: string;
  hackingStat: HackingStat;
  securityLevel: HackingStat;
  lockLevel: HackingStat;
  traceRisk: number;
  toolId: string;
  toolTraceModifier: number;
};

export type SafeDialConfig = {
  contractId: string;
  toolId: string;
  lockLevel: HackingStat;
  stabilizerActive: boolean;
  timeLimit: number;
  startingTrace: number;
  tracePerSecond: number;
  mistakeTrace: number;
  windowSize: number;
  rotationSpeed: number;
  targetAngles: number[];
};

export type SafeDialState = {
  stageIndex: number;
  trace: number;
  mistakes: number;
  hits: number;
  completed: boolean;
  failed: boolean;
  message: string;
  precisionTotal: number;
};

export function createSafeDialConfig(options: SafeDialOptions): SafeDialConfig {
  const statDelta = options.hackingStat - options.lockLevel;
  const underleveled = Math.max(0, options.lockLevel - options.hackingStat);
  const stabilizerActive = options.toolId === "signal-stabilizer";
  const lockPressure = options.lockLevel * 1.6 + options.securityLevel * 0.8;
  const operatorControl = options.hackingStat * 1.7;
  const timeLimit = clamp(46 + statDelta * 5 - options.securityLevel - underleveled * 4, 20, 58);
  const startingTrace = clamp(
    options.traceRisk + options.lockLevel * 2 - options.hackingStat * 3 + options.toolTraceModifier + underleveled * 8,
    4,
    90,
  );
  const tracePerSecond = clamp(
    0.65 +
      options.securityLevel * 0.16 +
      options.lockLevel * 0.18 -
      options.hackingStat * 0.1 +
      underleveled * 0.22 -
      (stabilizerActive ? 0.35 : 0),
    0.45,
    2.8,
  );
  const mistakeTrace = clamp(
    14 + options.securityLevel * 3 + options.lockLevel * 4 - options.hackingStat * 3 + underleveled * 5,
    10,
    54,
  );
  const windowSize = clamp(28 + operatorControl * 4 - lockPressure * 3.3 - underleveled * 4, 7, 44);
  const rotationSpeed = clamp(
    72 + options.lockLevel * 20 + options.securityLevel * 8 - options.hackingStat * 9 + underleveled * 16,
    62,
    220,
  );

  return {
    contractId: options.contractId,
    toolId: options.toolId,
    lockLevel: options.lockLevel,
    stabilizerActive,
    timeLimit,
    startingTrace,
    tracePerSecond,
    mistakeTrace,
    windowSize,
    rotationSpeed,
    targetAngles: [45, 178, 306],
  };
}

export function createSafeDialState(config: SafeDialConfig): SafeDialState {
  return {
    stageIndex: 0,
    trace: config.startingTrace,
    mistakes: 0,
    hits: 0,
    completed: false,
    failed: false,
    message: config.stabilizerActive
      ? "Signal Stabilizer is dampening the watchdog trace."
      : "Catch each tumbler as the dial arm crosses the amber window.",
    precisionTotal: 0,
  };
}

export function applySafeTraceTick(state: SafeDialState, config: SafeDialConfig): SafeDialState {
  if (state.completed || state.failed) {
    return state;
  }

  const trace = clamp(state.trace + config.tracePerSecond, 0, 100);

  return {
    ...state,
    trace,
    failed: trace >= 100,
    message: trace >= 100 ? "Watchdog trace sealed the safe interface." : state.message,
  };
}

export function applySafeAttempt(state: SafeDialState, dialAngle: number, config: SafeDialConfig): SafeDialState {
  if (state.completed || state.failed) {
    return state;
  }

  const targetAngle = config.targetAngles[state.stageIndex];
  const delta = angleDistance(dialAngle, targetAngle);
  const hit = delta <= config.windowSize;

  if (hit) {
    const nextStage = state.stageIndex + 1;
    const completed = nextStage >= config.targetAngles.length;
    const precision = Math.round(100 - (delta / config.windowSize) * 45);

    return {
      ...state,
      stageIndex: nextStage,
      hits: state.hits + 1,
      completed,
      trace: Math.max(0, state.trace - 4),
      precisionTotal: state.precisionTotal + precision,
      message: completed ? "All tumblers aligned. Safe open." : `Tumbler ${nextStage} aligned. Find the next window.`,
    };
  }

  const trace = clamp(state.trace + config.mistakeTrace, 0, 100);

  return {
    ...state,
    mistakes: state.mistakes + 1,
    trace,
    failed: trace >= 100,
    message: trace >= 100 ? "Watchdog trace sealed the safe interface." : "Mistimed contact. Trace spike detected.",
  };
}

export function getSafePrecision(state: SafeDialState) {
  if (state.hits === 0) {
    return 0;
  }

  return Math.round(state.precisionTotal / state.hits);
}

export function getSafePerformanceLabel(precision: number) {
  if (precision >= 90) {
    return "Clean open";
  }

  if (precision >= 76) {
    return "Stable open";
  }

  if (precision > 0) {
    return "Noisy open";
  }

  return "No lock";
}

function angleDistance(a: number, b: number) {
  const diff = Math.abs((((a - b) % 360) + 540) % 360 - 180);
  return diff;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

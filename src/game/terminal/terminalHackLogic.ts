import type { HackingStat } from "../../types";

export type TerminalHackOptions = {
  contractId: string;
  hackingStat: HackingStat;
  securityLevel: HackingStat;
  traceRisk: number;
  toolId: string;
  toolTraceModifier: number;
  runSeed?: number;
};

export type TerminalCandidate = {
  word: string;
  address: string;
  disabled: boolean;
};

export type TerminalHackConfig = {
  contractId: string;
  toolId: string;
  scannerActive: boolean;
  timeLimit: number;
  startingTrace: number;
  tracePerSecond: number;
  mistakeTrace: number;
  shieldCharges: number;
  attempts: number;
  candidates: TerminalCandidate[];
  secretWord: string;
  dudWords: string[];
  wordLength: number;
};

export type TerminalGuess = {
  word: string;
  likeness: number;
};

export type TerminalHackState = {
  trace: number;
  timeRemaining: number;
  attemptsRemaining: number;
  shieldCharges: number;
  shieldAbsorbed: number;
  guesses: TerminalGuess[];
  disabledWords: string[];
  completed: boolean;
  failed: boolean;
  message: string;
};

const wordPools: Record<number, string[]> = {
  5: [
    "CACHE",
    "LOGIN",
    "PATCH",
    "PROXY",
    "ROUTE",
    "TOKEN",
    "TRACE",
    "VAULT",
    "CABLE",
    "MODEM",
    "ARRAY",
    "PULSE",
    "CRYPT",
    "QUERY",
    "STACK",
    "SHELL",
    "DEBUG",
    "DRIVE",
  ],
  6: [
    "ACCESS",
    "BACKUP",
    "BYPASS",
    "CIPHER",
    "FILTER",
    "KERNEL",
    "LOCKED",
    "PACKET",
    "PORTAL",
    "REBOOT",
    "REMOTE",
    "ROUTER",
    "SCRIPT",
    "SIGNAL",
    "SOCKET",
    "SYSTEM",
    "UPLOAD",
    "VECTOR",
  ],
  7: [
    "ARCHIVE",
    "CIRCUIT",
    "DECRYPT",
    "FIREWAL",
    "GATEWAY",
    "HANDLER",
    "HOSTILE",
    "KEYRING",
    "LOCKBOX",
    "MALWARE",
    "NETFLOW",
    "PAYLOAD",
    "ROOTKIT",
    "SANDBOX",
    "TERMINL",
    "WATCHER",
  ],
  8: [
    "BACKDOOR",
    "BOOTDISK",
    "CODEWORD",
    "DATABASE",
    "DATAPORT",
    "FIRMWARE",
    "HARDLINE",
    "KEYCHAIN",
    "MAINROOT",
    "PASSWORD",
    "PROTOCOL",
    "ROOTNODE",
    "SEQUENCE",
    "TERMINAL",
    "WATCHDOG",
    "WIRETAPS",
  ],
};

export function createTerminalHackConfig(options: TerminalHackOptions): TerminalHackConfig {
  const underleveled = Math.max(0, options.securityLevel - options.hackingStat);
  const statDelta = options.hackingStat - options.securityLevel;
  const wordLength = clamp(5 + options.securityLevel + underleveled - Math.max(0, statDelta), 5, 8);
  const pool = wordPools[wordLength];
  const seed = options.runSeed ?? getSeed(`${options.contractId}:${options.hackingStat}:${options.securityLevel}`);
  const random = createSeededRandom(seed);
  const secretWord = pool[Math.floor(random() * pool.length)];
  const candidateCount = clamp(10 + options.securityLevel * 3 + underleveled * 3 - Math.max(0, statDelta), 10, pool.length);
  const words = createCandidateWords(pool, secretWord, candidateCount, random);
  const scannerActive = options.toolId === "scanner";
  const candidates = words.map((word, index) => ({
    word,
    address: `0x${(0xa140 + index * 16 + options.securityLevel * 37 + Math.floor(random() * 12)).toString(16).toUpperCase()}`,
    disabled: false,
  }));
  const attempts = clamp(4 + Math.floor(Math.max(0, statDelta) / 2) - underleveled, 3, 5);
  const startingTrace = clamp(
    options.traceRisk - options.hackingStat * 2 + options.toolTraceModifier + underleveled * 10,
    4,
    88,
  );

  return {
    contractId: options.contractId,
    toolId: options.toolId,
    scannerActive,
    timeLimit: clamp(70 + statDelta * 5 - underleveled * 8, 38, 90),
    startingTrace,
    tracePerSecond: clamp(0.55 + options.securityLevel * 0.13 + underleveled * 0.26 - Math.max(0, statDelta) * 0.08, 0.35, 2),
    mistakeTrace: clamp(16 + options.securityLevel * 6 + underleveled * 9 - options.hackingStat * 2, 12, 54),
    shieldCharges: options.toolId === "spoof-token" ? 1 : 0,
    attempts,
    candidates,
    secretWord,
    dudWords: scannerActive ? chooseDuds(words, secretWord, options.hackingStat >= 3 ? 2 : 1) : [],
    wordLength,
  };
}

export function createTerminalHackState(config: TerminalHackConfig): TerminalHackState {
  return {
    trace: config.startingTrace,
    timeRemaining: config.timeLimit,
    attemptsRemaining: config.attempts,
    shieldCharges: config.shieldCharges,
    shieldAbsorbed: 0,
    guesses: [],
    disabledWords: config.dudWords,
    completed: false,
    failed: false,
    message: config.scannerActive
      ? "Scanner removed probable duds. Pick a password candidate."
      : "Select a password candidate. Likeness shows matching letter positions.",
  };
}

export function applyTerminalTraceTick(state: TerminalHackState, config: TerminalHackConfig): TerminalHackState {
  if (state.completed || state.failed) {
    return state;
  }

  const trace = clamp(state.trace + config.tracePerSecond, 0, 100);
  const timeRemaining = Math.max(0, state.timeRemaining - 1);
  const failed = trace >= 100 || timeRemaining <= 0;

  return {
    ...state,
    trace,
    timeRemaining,
    failed,
    message: failed
      ? timeRemaining <= 0
        ? "Terminal session expired. Firewall locked."
        : "Trace reached 100%. Firewall locked."
      : state.message,
  };
}

export function guessTerminalWord(
  state: TerminalHackState,
  config: TerminalHackConfig,
  word: string,
): TerminalHackState {
  if (state.completed || state.failed || state.disabledWords.includes(word)) {
    return state;
  }

  const likeness = getLikeness(word, config.secretWord);
  const guesses = [...state.guesses, { word, likeness }];
  const disabledWords = [...state.disabledWords, word];

  if (word === config.secretWord) {
    return {
      ...state,
      guesses,
      disabledWords,
      completed: true,
      message: "Password accepted. Firewall session opened.",
    };
  }

  if (state.shieldCharges > 0) {
    return {
      ...state,
      guesses,
      disabledWords,
      shieldCharges: state.shieldCharges - 1,
      shieldAbsorbed: state.shieldAbsorbed + 1,
      message: `Entry denied. Likeness ${likeness}/${config.wordLength}. Spoof token absorbed trace.`,
    };
  }

  const attemptsRemaining = state.attemptsRemaining - 1;
  const trace = clamp(state.trace + config.mistakeTrace, 0, 100);
  const failed = attemptsRemaining <= 0 || trace >= 100;

  return {
    ...state,
    trace,
    attemptsRemaining,
    guesses,
    disabledWords,
    failed,
    message: failed
      ? attemptsRemaining <= 0
        ? "No attempts remaining. Firewall locked."
        : "Trace reached 100%. Firewall locked."
      : `Entry denied. Likeness ${likeness}/${config.wordLength}.`,
  };
}

export function getTerminalProgress(state: TerminalHackState, config: TerminalHackConfig) {
  if (state.completed) {
    return 1;
  }

  const usedAttempts = config.attempts - state.attemptsRemaining;
  return clamp(usedAttempts / config.attempts, 0, 0.95);
}

export function getLikeness(word: string, secretWord: string) {
  return word.split("").reduce((score, letter, index) => score + (secretWord[index] === letter ? 1 : 0), 0);
}

function chooseDuds(words: string[], secretWord: string, count: number) {
  return words
    .filter((word) => word !== secretWord)
    .sort((first, second) => getLikeness(first, secretWord) - getLikeness(second, secretWord))
    .slice(0, count);
}

function createCandidateWords(
  pool: string[],
  secretWord: string,
  candidateCount: number,
  random: () => number,
) {
  const similarWords = pool
    .filter((word) => word !== secretWord)
    .map((word) => ({ word, likeness: getLikeness(word, secretWord), drift: random() }))
    .sort((first, second) => second.likeness - first.likeness || first.drift - second.drift)
    .map((item) => item.word);
  const selected = [secretWord, ...similarWords.slice(0, candidateCount - 1)];

  return shuffle(selected, random);
}

function shuffle<T>(items: T[], random: () => number) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function createSeededRandom(seed: number) {
  let state = Math.abs(Math.floor(seed)) || 1;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function getSeed(value: string) {
  return value.split("").reduce((seed, character) => seed + character.charCodeAt(0), 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

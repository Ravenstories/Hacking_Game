import type { HackingStat, ModuleInventory } from "../../types";

export type RoutingPhase = "setup" | "routing" | "complete";

export type RoutingNodeKind =
  | "start"
  | "exit"
  | "relay"
  | "socket"
  | "unstable"
  | "locked"
  | "hostile"
  | "noisy"
  | "trap";

export type RoutingModuleId = "stabilizer" | "bypass" | "inverter" | "amplifier" | "filter";

export type RoutingBoardOptions = {
  contractId: string;
  hackingStat: HackingStat;
  securityLevel: HackingStat;
  traceRisk: number;
  toolId: string;
  toolTraceModifier: number;
  moduleInventory?: ModuleInventory;
};

export type RoutingNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: RoutingNodeKind;
  revealed: boolean;
  traceCost: number;
  requiredModule?: RoutingModuleId;
};

export type RoutingEdge = {
  from: string;
  to: string;
  long?: boolean;
  requiredModule?: RoutingModuleId;
};

export type RoutingModule = {
  id: RoutingModuleId;
  name: string;
  shortName: string;
  description: string;
  remainingUses: number;
};

export type RoutingBoardConfig = {
  contractId: string;
  toolId: string;
  hackingStat: HackingStat;
  securityLevel: HackingStat;
  scannerActive: boolean;
  timeLimit: number;
  startingTrace: number;
  tracePerSecond: number;
  mistakeTrace: number;
  correctTraceDrop: number;
  shieldCharges: number;
  moduleSlots: number;
  modules: RoutingModule[];
  nodes: RoutingNode[];
  edges: RoutingEdge[];
  recommendedPath: string[];
};

export type RoutingBoardState = {
  phase: RoutingPhase;
  trace: number;
  mistakes: number;
  shieldCharges: number;
  shieldAbsorbed: number;
  placedModules: Record<string, RoutingModuleId>;
  currentPath: string[];
  completed: boolean;
  failed: boolean;
  message: string;
};

export type RoutingValidation = {
  success: boolean;
  traceCost: number;
  stagesCompleted: number;
  blockedNodeId?: string;
  blockedReason?: string;
};

const moduleLibrary: RoutingModule[] = [
  {
    id: "stabilizer",
    name: "Stabilizer",
    shortName: "STAB",
    description: "Neutralizes one unstable relay.",
    remainingUses: 1,
  },
  {
    id: "bypass",
    name: "Bypass",
    shortName: "BYP",
    description: "Crosses one locked relay.",
    remainingUses: 1,
  },
  {
    id: "inverter",
    name: "Inverter",
    shortName: "INV",
    description: "Turns one hostile relay valid.",
    remainingUses: 1,
  },
  {
    id: "amplifier",
    name: "Amplifier",
    shortName: "AMP",
    description: "Carries signal across one long bridge.",
    remainingUses: 1,
  },
  {
    id: "filter",
    name: "Filter",
    shortName: "FLT",
    description: "Lowers trace on one noisy relay.",
    remainingUses: 1,
  },
];

type NodeTemplate = Omit<RoutingNode, "revealed">;

const nodeTemplates: NodeTemplate[] = [
  { id: "input", label: "IN", x: 0.08, y: 0.54, kind: "start", traceCost: 0 },
  { id: "relay-a", label: "A", x: 0.22, y: 0.35, kind: "relay", traceCost: 2 },
  {
    id: "unstable-a",
    label: "U1",
    x: 0.36,
    y: 0.56,
    kind: "unstable",
    traceCost: 8,
    requiredModule: "stabilizer",
  },
  { id: "trap-a", label: "T1", x: 0.32, y: 0.78, kind: "trap", traceCost: 36 },
  { id: "relay-b", label: "B", x: 0.5, y: 0.38, kind: "relay", traceCost: 3 },
  {
    id: "locked-a",
    label: "L1",
    x: 0.58,
    y: 0.65,
    kind: "locked",
    traceCost: 9,
    requiredModule: "bypass",
  },
  {
    id: "noisy-a",
    label: "N1",
    x: 0.7,
    y: 0.33,
    kind: "noisy",
    traceCost: 11,
    requiredModule: "filter",
  },
  {
    id: "hostile-a",
    label: "H1",
    x: 0.73,
    y: 0.66,
    kind: "hostile",
    traceCost: 12,
    requiredModule: "inverter",
  },
  {
    id: "relay-c",
    label: "A2",
    x: 0.84,
    y: 0.44,
    kind: "socket",
    traceCost: 6,
    requiredModule: "amplifier",
  },
  { id: "exit", label: "OUT", x: 0.93, y: 0.56, kind: "exit", traceCost: 0 },
];

const edgeTemplates: RoutingEdge[] = [
  { from: "input", to: "relay-a" },
  { from: "relay-a", to: "unstable-a" },
  { from: "unstable-a", to: "relay-b" },
  { from: "relay-a", to: "trap-a" },
  { from: "relay-a", to: "noisy-a" },
  { from: "trap-a", to: "exit" },
  { from: "trap-a", to: "locked-a" },
  { from: "relay-b", to: "locked-a" },
  { from: "relay-b", to: "noisy-a" },
  { from: "noisy-a", to: "exit" },
  { from: "locked-a", to: "hostile-a" },
  { from: "noisy-a", to: "relay-c", long: true, requiredModule: "amplifier" },
  { from: "hostile-a", to: "relay-c" },
  { from: "relay-c", to: "exit" },
  { from: "relay-b", to: "exit" },
  { from: "locked-a", to: "exit" },
];

export function createRoutingBoardConfig(options: RoutingBoardOptions): RoutingBoardConfig {
  const statDelta = options.hackingStat - options.securityLevel;
  const underleveled = Math.max(0, options.securityLevel - options.hackingStat);
  const nodeCount = clamp(Math.round(6 + options.securityLevel + underleveled), 7, 10);
  const activeNodeIds = chooseNodeIds(nodeCount);
  const scannerActive = options.toolId === "scanner";
  const nodes = nodeTemplates
    .filter((node) => activeNodeIds.includes(node.id))
    .map((node) => ({
      ...node,
      revealed: isNodeRevealed(node, options.hackingStat, options.securityLevel, scannerActive),
    }));
  const edges = edgeTemplates.filter((edge) => activeNodeIds.includes(edge.from) && activeNodeIds.includes(edge.to));
  const recommendedPath = chooseRecommendedPath(activeNodeIds);
  const requiredModules = getRequiredModulesForPath(recommendedPath, nodes, edges);
  const moduleSlots = clamp(requiredModules.length + Math.max(0, options.hackingStat - options.securityLevel), 1, 5);
  const timeLimit = clamp(58 + statDelta * 4 - underleveled * 7 + nodes.length * 2, 34, 75);
  const startingTrace = clamp(
    options.traceRisk - options.hackingStat * 2 + options.toolTraceModifier + underleveled * 12,
    4,
    88,
  );
  const tracePerSecond = clamp(
    0.66 + options.securityLevel * 0.13 - Math.max(0, statDelta) * 0.1 + underleveled * 0.36,
    0.45,
    2.2,
  );
  const mistakeTrace = clamp(14 + options.securityLevel * 5 - options.hackingStat * 2 + underleveled * 9, 10, 48);

  return {
    contractId: options.contractId,
    toolId: options.toolId,
    hackingStat: options.hackingStat,
    securityLevel: options.securityLevel,
    scannerActive,
    timeLimit,
    startingTrace,
    tracePerSecond,
    mistakeTrace,
    correctTraceDrop: Math.max(2, 5 + options.hackingStat - underleveled * 2),
    shieldCharges: options.toolId === "spoof-token" ? 1 : 0,
    moduleSlots,
    modules: moduleLibrary.map((module) => ({
      ...module,
      remainingUses: options.moduleInventory?.[module.id] ?? module.remainingUses,
    })),
    nodes,
    edges,
    recommendedPath,
  };
}

export function createRoutingBoardState(config: RoutingBoardConfig): RoutingBoardState {
  const requiredCount = getRequiredModulesForPath(config.recommendedPath, config.nodes, config.edges).length;

  return {
    phase: "setup",
    trace: config.startingTrace,
    mistakes: 0,
    shieldCharges: config.shieldCharges,
    shieldAbsorbed: 0,
    placedModules: {},
    currentPath: [],
    completed: false,
    failed: false,
    message: config.scannerActive
      ? "Scanner surfaced the safest route. Traps are shortcuts, not hints."
      : `Place ${requiredCount} module${requiredCount === 1 ? "" : "s"}, then route from IN to OUT.`,
  };
}

export function placeRoutingModule(
  state: RoutingBoardState,
  config: RoutingBoardConfig,
  nodeId: string,
  moduleId: RoutingModuleId,
): RoutingBoardState {
  if (state.completed || state.failed) {
    return state;
  }

  const node = config.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || node.kind === "start" || node.kind === "exit" || node.kind === "relay" || node.kind === "trap") {
    return { ...state, message: "That module needs a socketed relay." };
  }

  const alreadyPlacedModule = state.placedModules[nodeId];
  const placedCount = Object.keys(state.placedModules).length;
  if (!alreadyPlacedModule && placedCount >= config.moduleSlots) {
    return { ...state, message: "No module slots left. Remove or reroute." };
  }

  if (!isModuleAvailable(state, config, moduleId, nodeId)) {
    return { ...state, message: "That module is already committed." };
  }

  const placedModules = {
    ...state.placedModules,
    [nodeId]: moduleId,
  };
  const correct = node.requiredModule === moduleId;

  return {
    ...state,
    phase: "setup",
    placedModules,
    message: correct
      ? `${getModuleName(moduleId)} seated on ${node.label}. Route when ready.`
      : `${getModuleName(moduleId)} seated on ${node.label}, but the relay signature looks mismatched.`,
  };
}

export function removeRoutingModule(state: RoutingBoardState, nodeId: string): RoutingBoardState {
  if (!state.placedModules[nodeId] || state.completed || state.failed) {
    return state;
  }

  const placedModules = { ...state.placedModules };
  delete placedModules[nodeId];

  return {
    ...state,
    placedModules,
    message: "Module pulled. Choose another socket.",
  };
}

export function startRoutingPath(state: RoutingBoardState, nodeId: string): RoutingBoardState {
  if (state.completed || state.failed || nodeId !== "input") {
    return state;
  }

  return {
    ...state,
    phase: "routing",
    currentPath: [nodeId],
    message: "Cable armed. Drag through connected relays and release on OUT.",
  };
}

export function extendRoutingPath(
  state: RoutingBoardState,
  config: RoutingBoardConfig,
  nodeId: string,
): RoutingBoardState {
  if (state.completed || state.failed || state.phase !== "routing" || state.currentPath.length === 0) {
    return state;
  }

  const currentPath = state.currentPath;
  const lastNodeId = currentPath[currentPath.length - 1];
  if (nodeId === lastNodeId) {
    return state;
  }

  const previousNodeId = currentPath[currentPath.length - 2];
  if (nodeId === previousNodeId) {
    return {
      ...state,
      currentPath: currentPath.slice(0, -1),
      message: "Route backed up one relay.",
    };
  }

  if (currentPath.includes(nodeId)) {
    return state;
  }

  if (!areNodesConnected(config, lastNodeId, nodeId)) {
    return state;
  }

  return {
    ...state,
    currentPath: [...currentPath, nodeId],
    message: "Signal path extended.",
  };
}

export function resolveRoutingPath(state: RoutingBoardState, config: RoutingBoardConfig): RoutingBoardState {
  if (state.completed || state.failed || state.currentPath.length === 0) {
    return state;
  }

  const validation = validateRoutingPath(state, config);
  if (validation.success) {
    const trace = clamp(state.trace + validation.traceCost - config.correctTraceDrop, 0, 100);

    return {
      ...state,
      phase: "complete",
      trace,
      completed: true,
      failed: trace >= 100,
      message: trace >= 100 ? "Trace lock caught the pulse at the exit." : "Door controller accepted the routed pulse.",
    };
  }

  if (state.shieldCharges > 0) {
    return {
      ...state,
      phase: "setup",
      mistakes: state.mistakes + 1,
      shieldCharges: state.shieldCharges - 1,
      shieldAbsorbed: state.shieldAbsorbed + 1,
      currentPath: [],
      message: "Spoof token absorbed the failed pulse. Rebuild the route.",
    };
  }

  const trace = clamp(state.trace + config.mistakeTrace + validation.traceCost, 0, 100);

  return {
    ...state,
    phase: trace >= 100 ? "complete" : "setup",
    trace,
    mistakes: state.mistakes + 1,
    currentPath: [],
    failed: trace >= 100,
    message:
      trace >= 100
        ? "Trace lock reached. Relay burned."
        : validation.blockedReason ?? "Invalid pulse. Trace spike detected.",
  };
}

export function applyRoutingTraceTick(state: RoutingBoardState, config: RoutingBoardConfig): RoutingBoardState {
  if (state.completed || state.failed) {
    return state;
  }

  const trace = clamp(state.trace + config.tracePerSecond, 0, 100);

  return {
    ...state,
    trace,
    failed: trace >= 100,
    phase: trace >= 100 ? "complete" : state.phase,
    message: trace >= 100 ? "Trace lock reached. Relay burned." : state.message,
  };
}

export function validateRoutingPath(state: RoutingBoardState, config: RoutingBoardConfig): RoutingValidation {
  const path = state.currentPath;

  if (path.length < 2 || path[0] !== "input") {
    return {
      success: false,
      traceCost: 2,
      stagesCompleted: Math.max(0, path.length - 1),
      blockedReason: "Pulse never anchored to IN.",
    };
  }

  if (path[path.length - 1] !== "exit") {
    return {
      success: false,
      traceCost: 4,
      stagesCompleted: path.length - 1,
      blockedReason: "Pulse released before OUT.",
    };
  }

  let traceCost = 0;

  for (let index = 0; index < path.length; index += 1) {
    const nodeId = path[index];
    const node = config.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      return {
        success: false,
        traceCost: 6,
        stagesCompleted: index,
        blockedNodeId: nodeId,
        blockedReason: "Signal crossed an unknown relay.",
      };
    }

    if (index > 0) {
      const previousNodeId = path[index - 1];
      const edge = getEdge(config, previousNodeId, nodeId);
      if (!edge) {
        return {
          success: false,
          traceCost: 7,
          stagesCompleted: index,
          blockedNodeId: nodeId,
          blockedReason: "Cable crossed a disconnected segment.",
        };
      }

      if (edge.requiredModule && !pathHasModule(state, edge.requiredModule)) {
        return {
          success: false,
          traceCost: 8,
          stagesCompleted: index,
          blockedNodeId: nodeId,
          blockedReason: `${getModuleName(edge.requiredModule)} is required for that long bridge.`,
        };
      }
    }

    if (node.requiredModule && state.placedModules[node.id] !== node.requiredModule) {
      return {
        success: false,
        traceCost: Math.ceil(node.traceCost / 2),
        stagesCompleted: index,
        blockedNodeId: node.id,
        blockedReason: `${node.label} rejected the pulse. It needs ${getModuleName(node.requiredModule)}.`,
      };
    }

    traceCost += node.requiredModule === "filter" && state.placedModules[node.id] === "filter" ? 2 : node.traceCost;
  }

  return {
    success: true,
    traceCost: Math.max(0, Math.round(traceCost / 4)),
    stagesCompleted: path.length,
  };
}

export function getRoutingProgress(state: RoutingBoardState, config: RoutingBoardConfig) {
  if (state.completed) {
    return 1;
  }

  if (state.currentPath.length > 0) {
    return clamp(state.currentPath.length / config.recommendedPath.length, 0, 0.95);
  }

  const requiredModules = getRequiredModulesForPath(config.recommendedPath, config.nodes, config.edges);
  if (requiredModules.length === 0) {
    return 0;
  }

  const correctlyPlaced = requiredModules.filter(({ nodeId, moduleId }) => state.placedModules[nodeId] === moduleId).length;
  return clamp((correctlyPlaced / requiredModules.length) * 0.45, 0, 0.45);
}

export function getConnectedNodeIds(config: RoutingBoardConfig, nodeId: string) {
  return config.edges
    .filter((edge) => edge.from === nodeId || edge.to === nodeId)
    .map((edge) => (edge.from === nodeId ? edge.to : edge.from));
}

export function getRequiredModuleForNode(node: RoutingNode) {
  return node.requiredModule;
}

export function getRequiredModulesForPath(path: string[], nodes: RoutingNode[], edges: RoutingEdge[]) {
  const required: Array<{ nodeId: string; moduleId: RoutingModuleId }> = [];

  path.forEach((nodeId) => {
    const node = nodes.find((candidate) => candidate.id === nodeId);
    if (node?.requiredModule) {
      required.push({ nodeId, moduleId: node.requiredModule });
    }
  });

  for (let index = 1; index < path.length; index += 1) {
    const edge = edges.find(
      (candidate) =>
        (candidate.from === path[index - 1] && candidate.to === path[index]) ||
        (candidate.from === path[index] && candidate.to === path[index - 1]),
    );
    if (edge?.requiredModule) {
      const socketNode = nodes.find((node) => path.includes(node.id) && node.requiredModule === edge.requiredModule);
      if (socketNode) {
        required.push({ nodeId: socketNode.id, moduleId: edge.requiredModule });
      }
    }
  }

  return dedupeRequiredModules(required);
}

export function getModuleName(moduleId: RoutingModuleId) {
  return moduleLibrary.find((module) => module.id === moduleId)?.name ?? moduleId;
}

function chooseNodeIds(nodeCount: number) {
  if (nodeCount <= 7) {
    return ["input", "relay-a", "unstable-a", "trap-a", "relay-b", "noisy-a", "exit"];
  }

  if (nodeCount === 8) {
    return ["input", "relay-a", "unstable-a", "trap-a", "relay-b", "locked-a", "noisy-a", "exit"];
  }

  if (nodeCount === 9) {
    return ["input", "relay-a", "unstable-a", "trap-a", "relay-b", "locked-a", "noisy-a", "relay-c", "exit"];
  }

  return nodeTemplates.map((node) => node.id);
}

function chooseRecommendedPath(activeNodeIds: string[]) {
  const path = ["input", "relay-a", "unstable-a", "relay-b"];

  if (activeNodeIds.includes("noisy-a") && activeNodeIds.includes("relay-c")) {
    return [...path, "noisy-a", "relay-c", "exit"];
  }

  if (activeNodeIds.includes("locked-a")) {
    return [...path, "locked-a", "exit"];
  }

  return [...path, "exit"];
}

function isNodeRevealed(
  node: NodeTemplate,
  hackingStat: HackingStat,
  securityLevel: HackingStat,
  scannerActive: boolean,
) {
  if (node.kind === "start" || node.kind === "exit" || node.kind === "relay") {
    return true;
  }

  if (scannerActive && node.kind !== "trap") {
    return true;
  }

  if (hackingStat >= securityLevel) {
    return node.kind !== "trap" || hackingStat >= 3;
  }

  return node.kind === "unstable" && hackingStat >= 2;
}

function areNodesConnected(config: RoutingBoardConfig, firstNodeId: string, secondNodeId: string) {
  return Boolean(getEdge(config, firstNodeId, secondNodeId));
}

function getEdge(config: RoutingBoardConfig, firstNodeId: string, secondNodeId: string) {
  return config.edges.find(
    (edge) =>
      (edge.from === firstNodeId && edge.to === secondNodeId) || (edge.from === secondNodeId && edge.to === firstNodeId),
  );
}

function isModuleAvailable(
  state: RoutingBoardState,
  config: RoutingBoardConfig,
  moduleId: RoutingModuleId,
  targetNodeId: string,
) {
  const module = config.modules.find((candidate) => candidate.id === moduleId);
  if (!module) {
    return false;
  }

  const usedCount = Object.entries(state.placedModules).filter(
    ([nodeId, placedModuleId]) => placedModuleId === moduleId && nodeId !== targetNodeId,
  ).length;
  return usedCount < module.remainingUses;
}

function pathHasModule(state: RoutingBoardState, moduleId: RoutingModuleId) {
  return Object.values(state.placedModules).includes(moduleId);
}

function dedupeRequiredModules(required: Array<{ nodeId: string; moduleId: RoutingModuleId }>) {
  const seen = new Set<string>();
  return required.filter((item) => {
    const key = `${item.nodeId}:${item.moduleId}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

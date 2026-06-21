import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/game/routing/routingLogic.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});

const sandbox = {
  exports: {},
  module: { exports: {} },
  require() {
    throw new Error("Unexpected runtime import in routingLogic test.");
  },
};
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(compiled.outputText, sandbox);

const {
  createRoutingBoardConfig,
  createRoutingBoardState,
  extendRoutingPath,
  placeRoutingModule,
  resolveRoutingPath,
  startRoutingPath,
  validateRoutingPath,
} = sandbox.module.exports;

const baseOptions = {
  contractId: "maintenance-door-relay",
  hackingStat: 1,
  securityLevel: 1,
  traceRisk: 18,
  toolId: "scanner",
  toolTraceModifier: -4,
};

function routeThrough(state, config, nodeIds) {
  return nodeIds.reduce((currentState, nodeId) => extendRoutingPath(currentState, config, nodeId), state);
}

{
  const config = createRoutingBoardConfig(baseOptions);
  let state = createRoutingBoardState(config);
  state = placeRoutingModule(state, config, "unstable-a", "stabilizer");
  state = startRoutingPath(state, "input");
  state = routeThrough(state, config, ["relay-a", "unstable-a", "relay-b", "exit"]);

  const validation = validateRoutingPath(state, config);
  assert.equal(validation.success, true, "valid route should validate");

  state = resolveRoutingPath(state, config);
  assert.equal(state.completed, true, "valid route should complete");
  assert.equal(state.failed, false, "valid route should not fail");
}

{
  const config = createRoutingBoardConfig(baseOptions);
  let state = createRoutingBoardState(config);
  state = startRoutingPath(state, "input");
  state = { ...state, currentPath: ["input", "exit"] };

  const validation = validateRoutingPath(state, config);
  assert.equal(validation.success, false, "disconnected path should fail");
}

{
  const config = createRoutingBoardConfig(baseOptions);
  let state = createRoutingBoardState(config);
  state = startRoutingPath(state, "input");
  state = routeThrough(state, config, ["relay-a", "unstable-a", "relay-b", "exit"]);

  const validation = validateRoutingPath(state, config);
  assert.equal(validation.success, false, "missing required module should fail");
  assert.match(validation.blockedReason, /Stabilizer/, "failure should explain the missing module");
}

{
  const config = createRoutingBoardConfig(baseOptions);
  let state = createRoutingBoardState(config);
  state = placeRoutingModule(state, config, "unstable-a", "stabilizer");
  state = startRoutingPath(state, "input");
  state = routeThrough(state, config, ["relay-a", "unstable-a", "relay-b", "exit"]);

  assert.equal(validateRoutingPath(state, config).success, true, "correct module placement should enable route");
}

{
  const config = createRoutingBoardConfig(baseOptions);
  let state = createRoutingBoardState(config);
  state = startRoutingPath(state, "input");
  state = routeThrough(state, config, ["relay-a", "trap-a", "exit"]);

  const validation = validateRoutingPath(state, config);
  assert.equal(validation.success, true, "trap shortcut should be a valid risky route");
  assert.ok(validation.traceCost > 4, "trap shortcut should carry meaningful trace cost");
}

{
  const config = createRoutingBoardConfig(baseOptions);
  let state = createRoutingBoardState(config);
  state = placeRoutingModule(state, config, "noisy-a", "filter");
  state = startRoutingPath(state, "input");
  state = routeThrough(state, config, ["relay-a", "noisy-a", "exit"]);

  const validation = validateRoutingPath(state, config);
  assert.equal(validation.success, true, "filtered noisy detour should be a valid alternate route");
}

{
  const overreach = createRoutingBoardConfig({
    ...baseOptions,
    contractId: "server-room-lockstack",
    hackingStat: 1,
    securityLevel: 2,
    traceRisk: 30,
  });
  const inRange = createRoutingBoardConfig({
    ...baseOptions,
    contractId: "server-room-lockstack",
    hackingStat: 2,
    securityLevel: 2,
    traceRisk: 30,
  });

  assert.ok(overreach.startingTrace > inRange.startingTrace, "underleveled attempts should start with more trace");
  assert.ok(overreach.nodes.length >= inRange.nodes.length, "underleveled attempts should not generate easier boards");
}

{
  const scanner = createRoutingBoardConfig({
    ...baseOptions,
    contractId: "server-room-lockstack",
    securityLevel: 2,
    traceRisk: 30,
    toolId: "scanner",
    toolTraceModifier: -4,
  });
  const spoof = createRoutingBoardConfig({
    ...baseOptions,
    contractId: "server-room-lockstack",
    securityLevel: 2,
    traceRisk: 30,
    toolId: "spoof-token",
    toolTraceModifier: -8,
  });
  const scannerRevealed = scanner.nodes.filter((node) => node.revealed).length;
  const spoofRevealed = spoof.nodes.filter((node) => node.revealed).length;

  assert.ok(scannerRevealed > spoofRevealed, "scanner should reveal more node intel");
}

console.log("routingLogic tests passed");

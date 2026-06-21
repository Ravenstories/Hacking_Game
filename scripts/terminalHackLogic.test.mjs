import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/game/terminal/terminalHackLogic.ts", import.meta.url), "utf8");
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
    throw new Error("Unexpected runtime import in terminalHackLogic test.");
  },
};
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(compiled.outputText, sandbox);

const {
  createTerminalHackConfig,
  createTerminalHackState,
  getLikeness,
  guessTerminalWord,
} = sandbox.module.exports;

const baseOptions = {
  contractId: "archive-terminal-breach",
  hackingStat: 1,
  securityLevel: 1,
  traceRisk: 20,
  toolId: "scanner",
  toolTraceModifier: -4,
  runSeed: 12345,
};

{
  assert.equal(getLikeness("ACCESS", "ANCHOR"), 2, "likeness should count same-position letters");
  assert.equal(getLikeness("ACCESS", "ACCESS"), 6, "exact match should score full word length");
}

{
  const config = createTerminalHackConfig(baseOptions);
  let state = createTerminalHackState(config);
  state = guessTerminalWord(state, config, config.secretWord);

  assert.equal(state.completed, true, "secret word should complete terminal hack");
  assert.equal(state.failed, false, "secret word should not fail");
}

{
  const config = createTerminalHackConfig({ ...baseOptions, toolId: "spoof-token", toolTraceModifier: -8 });
  const wrongWord = config.candidates.find((candidate) => candidate.word !== config.secretWord).word;
  const state = guessTerminalWord(createTerminalHackState(config), config, wrongWord);

  assert.equal(state.shieldAbsorbed, 1, "spoof token should absorb one wrong guess");
  assert.equal(state.attemptsRemaining, config.attempts, "absorbed guess should not consume an attempt");
}

{
  const scanner = createTerminalHackConfig({ ...baseOptions, toolId: "scanner", toolTraceModifier: -4 });
  const noScanner = createTerminalHackConfig({ ...baseOptions, toolId: "none", toolTraceModifier: 0 });

  assert.ok(scanner.dudWords.length > 0, "scanner should remove probable duds");
  assert.equal(noScanner.dudWords.length, 0, "non-scanner tools should not remove duds");
}

{
  const first = createTerminalHackConfig({ ...baseOptions, runSeed: 111 });
  const second = createTerminalHackConfig({ ...baseOptions, runSeed: 222 });
  const repeat = createTerminalHackConfig({ ...baseOptions, runSeed: 111 });

  assert.equal(first.secretWord, repeat.secretWord, "same seed should repeat the same secret");
  assert.equal(
    first.candidates.map((candidate) => candidate.word).join(","),
    repeat.candidates.map((candidate) => candidate.word).join(","),
    "same seed should repeat the same candidate board",
  );
  assert.notEqual(
    first.candidates.map((candidate) => candidate.word).join(","),
    second.candidates.map((candidate) => candidate.word).join(","),
    "different seeds should generate different candidate boards",
  );
}

{
  const config = createTerminalHackConfig(baseOptions);

  assert.ok(config.candidates.length >= 10, "terminal should present a larger candidate list");
  assert.ok(config.attempts <= 4, "terminal should use tighter default attempts");
}

{
  const overreach = createTerminalHackConfig({
    ...baseOptions,
    hackingStat: 1,
    securityLevel: 3,
    traceRisk: 38,
  });
  const inRange = createTerminalHackConfig({
    ...baseOptions,
    hackingStat: 3,
    securityLevel: 3,
    traceRisk: 38,
  });

  assert.ok(overreach.candidates.length >= inRange.candidates.length, "underleveled terminal should not be easier");
  assert.ok(overreach.startingTrace > inRange.startingTrace, "underleveled terminal should start with more trace");
}

console.log("terminalHackLogic tests passed");

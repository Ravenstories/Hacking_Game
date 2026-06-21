import { useEffect, useMemo, useState } from "react";
import type { TerminalHackOptions } from "../game/terminal/terminalHackLogic";
import {
  applyTerminalTraceTick,
  createTerminalHackConfig,
  createTerminalHackState,
  getLikeness,
  getTerminalModuleRewards,
  getTerminalProgress,
  guessTerminalWord,
} from "../game/terminal/terminalHackLogic";
import { gameEvents } from "../game/gameEvents";

type TerminalHackStageProps = {
  options: TerminalHackOptions;
};

const glyphRows = [
  "<>{}[]()/$#",
  "##..::==//",
  "[]<>{}..??",
  "/SYS/BOOT/",
  "$$::MEM::",
  "(())./VAR/",
];

export function TerminalHackStage({ options }: TerminalHackStageProps) {
  const [runSeed] = useState(() => Math.floor(Math.random() * 1_000_000_000));
  const config = useMemo(() => createTerminalHackConfig({ ...options, runSeed }), [options, runSeed]);
  const [state, setState] = useState(() => createTerminalHackState(config));
  const latestGuess = state.guesses[state.guesses.length - 1];

  useEffect(() => {
    setState(createTerminalHackState(config));
  }, [config]);

  useEffect(() => {
    gameEvents.emit("terminal-hack:status", {
      trace: state.trace,
      timeRemaining: state.timeRemaining,
      progress: getTerminalProgress(state, config),
      mistakes: config.attempts - state.attemptsRemaining,
      shieldCharges: state.shieldCharges,
      phase: state.completed || state.failed ? "complete" : "routing",
      message: state.message,
    });
  }, [config, state]);

  useEffect(() => {
    if (state.completed || state.failed) {
      const timeout = window.setTimeout(() => {
        gameEvents.emit("terminal-hack:complete", {
          contractId: config.contractId,
          success: state.completed && !state.failed,
          trace: Math.round(state.trace),
          timeRemaining: state.timeRemaining,
          mistakes: config.attempts - state.attemptsRemaining,
          shieldAbsorbed: state.shieldAbsorbed,
          toolId: config.toolId,
          stagesCompleted: state.guesses.length,
          performanceLabel: state.completed ? "Password accepted" : "Terminal lockout",
          moduleRewards: state.completed ? getTerminalModuleRewards(config) : undefined,
        });
      }, 700);

      return () => window.clearTimeout(timeout);
    }
  }, [config, state]);

  useEffect(() => {
    if (state.completed || state.failed) {
      return;
    }

    const interval = window.setInterval(() => {
      setState((currentState) => applyTerminalTraceTick(currentState, config));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [config, state.completed, state.failed]);

  function handleGuess(word: string) {
    setState((currentState) => guessTerminalWord(currentState, config, word));
  }

  return (
    <div className="terminal-stage" aria-label="Firewall terminal password hack">
      <div className="terminal-bezel">
        <header className="terminal-header">
          <div>
            <span>RETROTERM 80</span>
            <strong>FIREWALL PASSWORD MATRIX</strong>
          </div>
          <div className="terminal-attempts" aria-label={`${state.attemptsRemaining} attempts remaining`}>
            {Array.from({ length: config.attempts }).map((_, index) => (
              <span key={index} className={index < state.attemptsRemaining ? "active" : ""} />
            ))}
          </div>
        </header>

        <section className="terminal-screen">
          <div className="terminal-copy">
            <p>{">"} INIT PASSWORD RECOVERY</p>
            <p>{">"} WORD LENGTH: {config.wordLength}</p>
            <p>{">"} ATTEMPTS: {state.attemptsRemaining}</p>
            {config.scannerActive ? <p>{">"} SCANNER REMOVED {config.dudWords.length} DUDS</p> : null}
            {latestGuess ? (
              <p>
                {">"} {latestGuess.word} :: LIKENESS {latestGuess.likeness}/{config.wordLength}
              </p>
            ) : (
              <p>{">"} SELECT A CANDIDATE WORD</p>
            )}
          </div>

          <div className="terminal-grid">
            {config.candidates.map((candidate, index) => {
              const disabled = state.disabledWords.includes(candidate.word);
              const likeness = getLikeness(candidate.word, config.secretWord);
              return (
                <button
                  className={disabled ? "terminal-word disabled" : "terminal-word"}
                  key={candidate.word}
                  type="button"
                  onClick={() => handleGuess(candidate.word)}
                  disabled={disabled || state.completed || state.failed}
                  title={
                    config.scannerActive && config.dudWords.includes(candidate.word)
                      ? "Scanner flagged this as a dud."
                      : `Candidate ${candidate.word}`
                  }
                >
                  <span>{candidate.address}</span>
                  <strong>{disabled ? "......" : candidate.word}</strong>
                  <em>{disabled && candidate.word !== config.secretWord ? `${likeness}/${config.wordLength}` : glyphRows[index % glyphRows.length]}</em>
                </button>
              );
            })}
          </div>

          <aside className="terminal-log" aria-label="Terminal output">
            <p>{state.message}</p>
            {state.guesses
              .slice()
              .reverse()
              .map((guess) => (
                <p key={`${guess.word}-${guess.likeness}`}>
                  {guess.word}: {guess.likeness}/{config.wordLength} MATCH
                </p>
              ))}
          </aside>
        </section>
      </div>
    </div>
  );
}

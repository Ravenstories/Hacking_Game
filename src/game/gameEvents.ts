import type { HackResult } from "../types";

export type HackStatus = {
  trace: number;
  timeRemaining: number;
  progress: number;
  mistakes: number;
  shieldCharges: number;
  phase?: "setup" | "routing" | "complete";
  modulesPlaced?: number;
  scannerHintIndex?: number;
  message: string;
};

export type DoorHackStatus = HackStatus;
export type SafeHackStatus = HackStatus;
export type TerminalHackStatus = HackStatus;

type GameEventMap = {
  "door-hack:status": DoorHackStatus;
  "door-hack:complete": HackResult;
  "safe-hack:status": SafeHackStatus;
  "safe-hack:complete": HackResult;
  "terminal-hack:status": TerminalHackStatus;
  "terminal-hack:complete": HackResult;
};

class TypedGameEvents extends EventTarget {
  emit<T extends keyof GameEventMap>(type: T, detail: GameEventMap[T]) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  on<T extends keyof GameEventMap>(type: T, listener: (detail: GameEventMap[T]) => void) {
    const wrapped = (event: Event) => listener((event as CustomEvent<GameEventMap[T]>).detail);
    this.addEventListener(type, wrapped);
    return () => this.removeEventListener(type, wrapped);
  }
}

export const gameEvents = new TypedGameEvents();

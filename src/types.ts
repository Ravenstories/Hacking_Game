export type HackingStat = 1 | 2 | 3 | 4 | 5;

export type MinigameType = "door" | "safe" | "firewall" | "surveillance" | "duel";

export type PlayerProfile = {
  id: string;
  displayName: string;
  hackingStat: HackingStat;
  reputation: number;
  credits: number;
  unlockedTools: string[];
  unlockedMinigames: MinigameType[];
  completedContracts: string[];
  failedContracts: string[];
};

export type Contract = {
  id: string;
  title: string;
  targetType: MinigameType;
  securityLevel: HackingStat;
  lockLevel?: HackingStat;
  requiredHackingStat: HackingStat;
  payout: number;
  reputationReward: number;
  traceRisk: number;
  minigames: MinigameType[];
  summary: string;
  intelByStat: Record<HackingStat, string>;
};

export type Tool = {
  id: string;
  name: string;
  description: string;
  requiredHackingStat: HackingStat;
  charges?: number;
  traceModifier?: number;
};

export type HackResult = {
  contractId: string;
  success: boolean;
  trace: number;
  timeRemaining: number;
  mistakes: number;
  shieldAbsorbed: number;
  toolId: string;
  stagesCompleted?: number;
  precision?: number;
  performanceLabel?: string;
};

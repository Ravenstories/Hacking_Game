import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HackResult, PlayerProfile } from "../types";
import { contracts } from "../data/contracts";

const starterProfile: PlayerProfile = {
  id: "local-player",
  displayName: "Operator",
  hackingStat: 1,
  reputation: 0,
  credits: 0,
  unlockedTools: ["scanner", "spoof-token"],
  unlockedMinigames: ["door", "firewall"],
  completedContracts: [],
  failedContracts: [],
};

type ProfileStore = {
  profile: PlayerProfile;
  lastResult?: HackResult;
  applyHackResult: (result: HackResult) => void;
  resetProfile: () => void;
};

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      profile: starterProfile,
      applyHackResult: (result) =>
        set((state) => {
          const contract = contracts.find((item) => item.id === result.contractId);
          const alreadyCompleted = state.profile.completedContracts.includes(result.contractId);

          if (!contract) {
            return { lastResult: result };
          }

          if (!result.success) {
            return {
              lastResult: result,
              profile: {
                ...state.profile,
                failedContracts: state.profile.failedContracts.includes(result.contractId)
                  ? state.profile.failedContracts
                  : [...state.profile.failedContracts, result.contractId],
              },
            };
          }

          const reputation = alreadyCompleted
            ? state.profile.reputation
            : state.profile.reputation + contract.reputationReward;
          const credits = alreadyCompleted ? state.profile.credits : state.profile.credits + contract.payout;
          const hackingStat = getHackingStatForReputation(reputation);

          return {
            lastResult: result,
            profile: {
              ...state.profile,
              hackingStat,
              unlockedTools:
                hackingStat >= 2 && !state.profile.unlockedTools.includes("signal-stabilizer")
                  ? [...state.profile.unlockedTools, "signal-stabilizer"]
                  : state.profile.unlockedTools,
              unlockedMinigames:
                hackingStat >= 2 && !state.profile.unlockedMinigames.includes("safe")
                  ? [...state.profile.unlockedMinigames, "safe"]
                  : state.profile.unlockedMinigames,
              reputation,
              credits,
              completedContracts: alreadyCompleted
                ? state.profile.completedContracts
                : [...state.profile.completedContracts, result.contractId],
            },
          };
        }),
      resetProfile: () => set({ profile: starterProfile, lastResult: undefined }),
    }),
    {
      name: "hacking-game-profile",
      version: 1,
    },
  ),
);

function getHackingStatForReputation(reputation: number) {
  if (reputation >= 140) {
    return 5;
  }

  if (reputation >= 80) {
    return 4;
  }

  if (reputation >= 36) {
    return 3;
  }

  if (reputation >= 8) {
    return 2;
  }

  return 1;
}

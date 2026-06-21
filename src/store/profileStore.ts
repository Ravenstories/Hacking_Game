import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HackResult, HackingStat, ModuleInventory, PlayerProfile } from "../types";
import { contracts } from "../data/contracts";

export const starterModuleInventory: ModuleInventory = {
  stabilizer: 3,
  bypass: 2,
  inverter: 1,
  amplifier: 1,
  filter: 2,
};

const starterProfile: PlayerProfile = {
  id: "local-player",
  displayName: "Operator",
  hackingStat: 1,
  reputation: 0,
  credits: 0,
  moduleInventory: starterModuleInventory,
  unlockedTools: ["scanner", "spoof-token"],
  unlockedMinigames: ["door", "firewall"],
  completedContracts: [],
  failedContracts: [],
};

type ProfileStore = {
  profile: PlayerProfile;
  lastResult?: HackResult;
  applyHackResult: (result: HackResult) => void;
  updateProfileForTesting: (patch: Partial<Pick<PlayerProfile, "displayName" | "hackingStat" | "reputation" | "credits">>) => void;
  updateModuleInventoryForTesting: (inventory: Partial<ModuleInventory>) => void;
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
          const moduleInventory = applyModuleRewards(
            consumeModules(state.profile.moduleInventory, result.consumedModules ?? []),
            result.success ? result.moduleRewards : undefined,
          );

          if (!contract) {
            return {
              lastResult: result,
              profile: {
                ...state.profile,
                moduleInventory,
              },
            };
          }

          if (!result.success) {
            return {
              lastResult: result,
              profile: {
                ...state.profile,
                moduleInventory,
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
          const hackingStat = Math.max(state.profile.hackingStat, getHackingStatForReputation(reputation)) as HackingStat;

          return {
            lastResult: result,
            profile: {
              ...state.profile,
              hackingStat,
              moduleInventory,
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
      updateProfileForTesting: (patch) =>
        set((state) => ({
          profile: normalizeProfile({
            ...state.profile,
            ...patch,
          }),
        })),
      updateModuleInventoryForTesting: (inventory) =>
        set((state) => ({
          profile: {
            ...state.profile,
            moduleInventory: normalizeModuleInventory({
              ...state.profile.moduleInventory,
              ...inventory,
            }),
          },
        })),
      resetProfile: () => set({ profile: starterProfile, lastResult: undefined }),
    }),
    {
      name: "hacking-game-profile",
      version: 2,
      merge: (persisted, current) => {
        const persistedStore = persisted as Partial<ProfileStore> | undefined;

        return {
          ...current,
          ...persistedStore,
          profile: normalizeProfile({
            ...current.profile,
            ...persistedStore?.profile,
          }),
        };
      },
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

function normalizeProfile(profile: PlayerProfile): PlayerProfile {
  return {
    ...profile,
    displayName: profile.displayName || starterProfile.displayName,
    hackingStat: clampStat(profile.hackingStat),
    reputation: Math.max(0, Math.floor(profile.reputation || 0)),
    credits: Math.max(0, Math.floor(profile.credits || 0)),
    moduleInventory: normalizeModuleInventory(profile.moduleInventory),
    unlockedTools: profile.unlockedTools?.length ? profile.unlockedTools : starterProfile.unlockedTools,
    unlockedMinigames: profile.unlockedMinigames?.length ? profile.unlockedMinigames : starterProfile.unlockedMinigames,
    completedContracts: profile.completedContracts ?? [],
    failedContracts: profile.failedContracts ?? [],
  };
}

function normalizeModuleInventory(inventory?: Partial<ModuleInventory>): ModuleInventory {
  return {
    stabilizer: normalizeCount(inventory?.stabilizer ?? starterModuleInventory.stabilizer),
    bypass: normalizeCount(inventory?.bypass ?? starterModuleInventory.bypass),
    inverter: normalizeCount(inventory?.inverter ?? starterModuleInventory.inverter),
    amplifier: normalizeCount(inventory?.amplifier ?? starterModuleInventory.amplifier),
    filter: normalizeCount(inventory?.filter ?? starterModuleInventory.filter),
  };
}

function consumeModules(inventory: ModuleInventory, modules: HackResult["consumedModules"]): ModuleInventory {
  const nextInventory = normalizeModuleInventory(inventory);
  modules?.forEach((moduleId) => {
    nextInventory[moduleId] = Math.max(0, nextInventory[moduleId] - 1);
  });

  return nextInventory;
}

function applyModuleRewards(inventory: ModuleInventory, rewards?: HackResult["moduleRewards"]): ModuleInventory {
  const nextInventory = normalizeModuleInventory(inventory);
  Object.entries(rewards ?? {}).forEach(([moduleId, amount]) => {
    const id = moduleId as keyof ModuleInventory;
    nextInventory[id] = normalizeCount(nextInventory[id] + (amount ?? 0));
  });

  return nextInventory;
}

function normalizeCount(value: number) {
  return Math.max(0, Math.min(99, Math.floor(Number.isFinite(value) ? value : 0)));
}

function clampStat(value: number): HackingStat {
  return Math.min(5, Math.max(1, Math.floor(value || 1))) as HackingStat;
}

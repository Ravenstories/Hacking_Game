import type { RoutingBoardConfig, RoutingBoardOptions, RoutingBoardState } from "../routing/routingLogic";
import {
  applyRoutingTraceTick,
  createRoutingBoardConfig,
  createRoutingBoardState,
  getRoutingProgress,
  resolveRoutingPath,
  type RoutingModuleId,
} from "../routing/routingLogic";

export type DoorRelayOptions = RoutingBoardOptions;
export type DoorRelayConfig = RoutingBoardConfig;
export type DoorRelayState = RoutingBoardState;
export type DoorRelayModuleId = RoutingModuleId;

export function createDoorRelayConfig(options: DoorRelayOptions): DoorRelayConfig {
  return createRoutingBoardConfig(options);
}

export function createDoorRelayState(config: DoorRelayConfig): DoorRelayState {
  return createRoutingBoardState(config);
}

export const applyTraceTick = applyRoutingTraceTick;
export const resolveDoorRelayPath = resolveRoutingPath;
export const getDoorRelayProgress = getRoutingProgress;

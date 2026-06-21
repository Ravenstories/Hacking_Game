import Phaser from "phaser";
import type { MinigameType } from "../types";
import type { DoorRelayOptions } from "./doorRelay/doorRelayLogic";
import type { SafeDialOptions } from "./safeDial/safeDialLogic";
import { DoorRelayScene } from "./scenes/DoorRelayScene";
import { SafeDialScene } from "./scenes/SafeDialScene";

export type MinigameStageOptions = {
  contractType: MinigameType;
  doorOptions: DoorRelayOptions;
  safeOptions: SafeDialOptions;
};

export function createMinigameGame(parent: HTMLElement, options: MinigameStageOptions) {
  const rect = parent.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(360, Math.floor(rect.height));

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width,
    height,
    backgroundColor: "#081016",
    scale: {
      mode: Phaser.Scale.NONE,
    },
    scene: [createScene(options)],
    render: {
      antialias: true,
      pixelArt: false,
    },
  });
}

function createScene(options: MinigameStageOptions) {
  if (options.contractType === "safe") {
    return new SafeDialScene(options.safeOptions);
  }

  return new DoorRelayScene(options.doorOptions);
}

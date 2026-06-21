import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import type { MinigameType } from "../types";
import { createMinigameGame } from "../game/createMinigameGame";
import type { DoorRelayOptions } from "../game/doorRelay/doorRelayLogic";
import type { SafeDialOptions } from "../game/safeDial/safeDialLogic";

type PhaserGameStageProps = {
  contractType: MinigameType;
  doorOptions: DoorRelayOptions;
  safeOptions: SafeDialOptions;
};

export function PhaserGameStage({ contractType, doorOptions, safeOptions }: PhaserGameStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) {
      return;
    }

    const parent = containerRef.current;
    gameRef.current = createMinigameGame(parent, { contractType, doorOptions, safeOptions });

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !gameRef.current) {
        return;
      }

      const width = Math.max(320, Math.floor(entry.contentRect.width));
      const height = Math.max(360, Math.floor(entry.contentRect.height));
      gameRef.current.scale.resize(width, height);
    });

    resizeObserver.observe(parent);

    return () => {
      resizeObserver.disconnect();
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [contractType, doorOptions, safeOptions]);

  return <div ref={containerRef} className="phaser-host" aria-label={`${contractType} minigame`} />;
}

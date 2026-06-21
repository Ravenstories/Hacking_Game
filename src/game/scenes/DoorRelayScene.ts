import Phaser from "phaser";
import { gameEvents } from "../gameEvents";
import { drawGrid, getDoorRelayLayout, getSceneBounds } from "../stageLayout";
import {
  applyRelayNode,
  applyTraceTick,
  createDoorRelayConfig,
  createDoorRelayState,
  routeSequence,
  type DoorRelayConfig,
  type DoorRelayOptions,
  type DoorRelayState,
} from "../doorRelay/doorRelayLogic";

export class DoorRelayScene extends Phaser.Scene {
  private readonly relayConfig: DoorRelayConfig;
  private relayState: DoorRelayState;
  private timeRemaining: number;
  private labels: Phaser.GameObjects.Text[] = [];
  private nodes: Phaser.GameObjects.Arc[] = [];
  private renderObjects: Phaser.GameObjects.GameObject[] = [];
  private hintRing?: Phaser.GameObjects.Arc;
  private timer?: Phaser.Time.TimerEvent;
  private completed = false;

  constructor(options: DoorRelayOptions) {
    super("DoorRelayScene");
    this.relayConfig = createDoorRelayConfig(options);
    this.relayState = createDoorRelayState(this.relayConfig);
    this.timeRemaining = this.relayConfig.timeLimit;
  }

  create() {
    this.cameras.main.setBackgroundColor("#081016");

    this.renderScene();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.renderScene, this);
    this.emitStatus();

    this.timer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.relayState.completed || this.relayState.failed) {
          return;
        }

        this.timeRemaining -= 1;
        this.relayState = applyTraceTick(this.relayState, this.relayConfig);

        if (this.timeRemaining <= 0 || this.relayState.trace >= 100) {
          this.relayState = {
            ...this.relayState,
            failed: true,
            message: this.timeRemaining <= 0 ? "Relay timed out. Access denied." : "Trace lock reached. Relay burned.",
          };
          this.complete(false);
          return;
        }

        this.emitStatus();
      },
    });
  }

  shutdown() {
    this.timer?.destroy();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.renderScene, this);
  }

  private renderScene() {
    this.renderObjects.forEach((object) => object.destroy());
    this.renderObjects = [];
    this.nodes = [];
    this.labels = [];
    this.hintRing = undefined;

    const { width, height } = getSceneBounds(this);
    const layout = getDoorRelayLayout(width, height);

    const graphics = this.add.graphics();
    this.renderObjects.push(graphics);
    drawGrid(graphics, width, height);
    graphics.lineStyle(2, 0x1a6670, 0.35);
    graphics.strokeRoundedRect(layout.frame.x, layout.frame.y, layout.frame.width, layout.frame.height, 12);

    const title = this.add
      .text(layout.title.x, layout.title.y, "DOOR RELAY / CIRCUIT BRIDGE", {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: "16px",
        color: "#dceff2",
        letterSpacing: 1,
      })
      .setAlpha(0.9);
    this.renderObjects.push(title);

    const toolLabel =
      this.relayConfig.toolId === "scanner"
        ? "Scanner marks the next stable node."
        : this.relayConfig.toolId === "spoof-token"
          ? "Spoof token blocks one mistake."
          : "Click nodes in sequence. A bad pulse raises trace.";

    const instruction = this.add.text(layout.instruction.x, layout.instruction.y, toolLabel, {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "14px",
      color: "#7f9da6",
    });
    this.renderObjects.push(instruction);

    graphics.lineStyle(3, 0x2ce6ff, 0.18);

    for (let index = 0; index < layout.nodes.length - 1; index += 1) {
      const current = layout.nodes[index];
      const next = layout.nodes[index + 1];
      graphics.lineBetween(current.x, current.y, next.x, next.y);
    }

    layout.nodes.forEach((position, index) => {
      const node = this.add.circle(position.x, position.y, layout.nodeRadius, 0x0e2630, 1);
      node.setStrokeStyle(2, 0x34d7e7, 0.85);
      node.setInteractive({ useHandCursor: true });
      node.on("pointerdown", () => this.handleNodeClick(index));
      this.renderObjects.push(node);

      const label = this.add
        .text(position.x, position.y + layout.nodeRadius + 18, routeSequence[index], {
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: "12px",
          color: "#9ab9c1",
        })
        .setOrigin(0.5);
      this.renderObjects.push(label);

      const ordinal = this.add
        .text(position.x, position.y - 5, ["A", "B", "C", "D", "E"][index], {
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: `${Math.round(layout.nodeRadius * 0.72)}px`,
          color: "#dffcff",
          fontStyle: "700",
        })
        .setOrigin(0.5);
      this.renderObjects.push(ordinal);

      this.nodes.push(node);
      this.labels.push(label, ordinal);
    });

    this.updateCompletedNodeVisuals();
    this.updateScannerHint();
  }

  private handleNodeClick(index: number) {
    if (this.relayState.completed || this.relayState.failed) {
      return;
    }

    const previousStep = this.relayState.expectedIndex;
    const previousShield = this.relayState.shieldCharges;
    this.relayState = applyRelayNode(this.relayState, index, this.relayConfig);
    this.updateNodeVisuals(previousStep, index);
    this.updateShieldPulse(previousShield);
    this.updateScannerHint();
    this.emitStatus();

    if (this.relayState.completed) {
      this.complete(true);
    } else if (this.relayState.failed) {
      this.complete(false);
    }
  }

  private updateNodeVisuals(previousStep: number, clickedIndex: number) {
    const clicked = this.nodes[clickedIndex];
    const correct = clickedIndex === previousStep;
    clicked.setFillStyle(correct ? 0x2ce6ff : 0xff4b5d, correct ? 0.92 : 0.85);
    clicked.setStrokeStyle(3, correct ? 0xdffcff : 0xffa1aa, 1);

    this.tweens.add({
      targets: clicked,
      scale: correct ? 1.12 : 0.92,
      duration: 120,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  private updateShieldPulse(previousShield: number) {
    if (this.relayState.shieldCharges === previousShield || this.relayState.shieldAbsorbed === 0) {
      return;
    }

    this.cameras.main.flash(160, 243, 183, 77, false);
  }

  private updateScannerHint() {
    if (!this.relayConfig.scannerActive || this.relayState.completed || this.relayState.failed) {
      this.hintRing?.setVisible(false);
      return;
    }

    const { width, height } = getSceneBounds(this);
    const position = getDoorRelayLayout(width, height).nodes[this.relayState.expectedIndex];
    if (!position) {
      this.hintRing?.setVisible(false);
      return;
    }

    if (!this.hintRing) {
      this.hintRing = this.add.circle(position.x, position.y, 39, 0x000000, 0);
      this.hintRing.setStrokeStyle(3, 0xf3b74d, 0.95);
      this.renderObjects.push(this.hintRing);
      this.tweens.add({
        targets: this.hintRing,
        alpha: 0.35,
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    }

    this.hintRing.setPosition(position.x, position.y);
    this.hintRing.setVisible(true);
  }

  private updateCompletedNodeVisuals() {
    for (let index = 0; index < this.relayState.expectedIndex; index += 1) {
      const node = this.nodes[index];
      node?.setFillStyle(0x2ce6ff, 0.92);
      node?.setStrokeStyle(3, 0xdffcff, 1);
    }
  }

  private emitStatus() {
    gameEvents.emit("door-hack:status", {
      trace: this.relayState.trace,
      timeRemaining: this.timeRemaining,
      progress: this.relayState.expectedIndex / routeSequence.length,
      mistakes: this.relayState.mistakes,
      shieldCharges: this.relayState.shieldCharges,
      scannerHintIndex: this.relayConfig.scannerActive ? this.relayState.expectedIndex : undefined,
      message: this.relayState.message,
    });
  }

  private complete(success: boolean) {
    if (this.completed) {
      return;
    }

    this.completed = true;
    this.timer?.destroy();
    this.emitStatus();

    const { width, height } = getSceneBounds(this);
    const overlayLayout = getDoorRelayLayout(width, height).overlay;
    const overlay = this.add.rectangle(
      overlayLayout.x,
      overlayLayout.y,
      overlayLayout.width,
      overlayLayout.height,
      success ? 0x09251d : 0x2a0d14,
      0.9,
    );
    overlay.setStrokeStyle(2, success ? 0x8ff7bf : 0xff4b5d, 0.9);
    this.add
      .text(overlayLayout.x, overlayLayout.y, success ? "ACCESS GRANTED" : "ACCESS DENIED", {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: "28px",
        color: success ? "#8ff7bf" : "#ff9aa5",
        fontStyle: "900",
      })
      .setOrigin(0.5);

    this.time.delayedCall(700, () => {
      gameEvents.emit("door-hack:complete", {
        contractId: this.relayConfig.contractId,
        success,
        trace: Math.round(this.relayState.trace),
        timeRemaining: Math.max(0, this.timeRemaining),
        mistakes: this.relayState.mistakes,
        shieldAbsorbed: this.relayState.shieldAbsorbed,
        toolId: this.relayConfig.toolId,
      });
    });
  }
}

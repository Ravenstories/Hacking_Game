import Phaser from "phaser";
import { gameEvents } from "../gameEvents";
import { drawGrid, getSafeDialLayout, getSceneBounds } from "../stageLayout";
import {
  applySafeAttempt,
  applySafeTraceTick,
  createSafeDialConfig,
  createSafeDialState,
  getSafePerformanceLabel,
  getSafePrecision,
  type SafeDialConfig,
  type SafeDialOptions,
  type SafeDialState,
} from "../safeDial/safeDialLogic";

export class SafeDialScene extends Phaser.Scene {
  private readonly safeConfig: SafeDialConfig;
  private safeState: SafeDialState;
  private timeRemaining: number;
  private dialAngle = 0;
  private armGraphics?: Phaser.GameObjects.Graphics;
  private targetGraphics?: Phaser.GameObjects.Graphics;
  private stageText?: Phaser.GameObjects.Text;
  private renderObjects: Phaser.GameObjects.GameObject[] = [];
  private timer?: Phaser.Time.TimerEvent;
  private completed = false;

  constructor(options: SafeDialOptions) {
    super("SafeDialScene");
    this.safeConfig = createSafeDialConfig(options);
    this.safeState = createSafeDialState(this.safeConfig);
    this.timeRemaining = this.safeConfig.timeLimit;
  }

  create() {
    this.cameras.main.setBackgroundColor("#081016");

    this.renderScene();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.renderScene, this);
    this.addInputHandlers();
    this.emitStatus();

    this.timer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.safeState.completed || this.safeState.failed) {
          return;
        }

        this.timeRemaining -= 1;
        this.safeState = applySafeTraceTick(this.safeState, this.safeConfig);

        if (this.timeRemaining <= 0 || this.safeState.trace >= 100) {
          this.safeState = {
            ...this.safeState,
            failed: true,
            message:
              this.timeRemaining <= 0 ? "Safe emulator timed out. Lock reset." : this.safeState.message,
          };
          this.complete(false);
          return;
        }

        this.emitStatus();
      },
    });
  }

  update(_: number, delta: number) {
    if (this.safeState.completed || this.safeState.failed) {
      return;
    }

    this.dialAngle = (this.dialAngle + (this.safeConfig.rotationSpeed * delta) / 1000) % 360;
    this.updateArm();
  }

  shutdown() {
    this.timer?.destroy();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.renderScene, this);
  }

  private renderScene() {
    this.renderObjects.forEach((object) => object.destroy());
    this.renderObjects = [];
    this.armGraphics = undefined;
    this.targetGraphics = undefined;
    this.stageText = undefined;

    const { width, height } = getSceneBounds(this);
    const layout = getSafeDialLayout(width, height);

    const graphics = this.add.graphics();
    this.renderObjects.push(graphics);
    drawGrid(graphics, width, height);
    graphics.lineStyle(2, 0x1a6670, 0.35);
    graphics.strokeRoundedRect(layout.frame.x, layout.frame.y, layout.frame.width, layout.frame.height, 12);

    const title = this.add
      .text(layout.title.x, layout.title.y, "SAFE DIAL / TUMBLER CATCH", {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: "18px",
        color: "#dceff2",
      })
      .setAlpha(0.9);
    this.renderObjects.push(title);

    this.stageText = this.add.text(layout.instruction.x, layout.instruction.y, "", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "16px",
      color: "#7f9da6",
      wordWrap: {
        width: layout.frame.width - 52,
        useAdvancedWrap: true,
      },
    });
    this.renderObjects.push(this.stageText);

    graphics.lineStyle(14, 0x183943, 1);
    graphics.strokeCircle(layout.center.x, layout.center.y, layout.radius);
    graphics.lineStyle(2, 0x2ce6ff, 0.45);
    graphics.strokeCircle(layout.center.x, layout.center.y, layout.radius + 24);
    graphics.strokeCircle(layout.center.x, layout.center.y, layout.radius - 34);

    for (let angle = 0; angle < 360; angle += 30) {
      const outer = this.pointOnDial(angle, layout.radius + 26);
      const inner = this.pointOnDial(angle, layout.radius + 10);
      graphics.lineStyle(angle % 90 === 0 ? 3 : 1, 0x7f9da6, angle % 90 === 0 ? 0.8 : 0.35);
      graphics.lineBetween(inner.x, inner.y, outer.x, outer.y);
    }

    this.targetGraphics = this.add.graphics();
    this.renderObjects.push(this.targetGraphics);

    this.armGraphics = this.add.graphics();
    this.renderObjects.push(this.armGraphics);

    const centerDot = this.add.circle(layout.center.x, layout.center.y, 17, 0x2ce6ff, 0.9);
    this.renderObjects.push(centerDot);

    this.updateTargetArc();
    this.updateArm();
  }

  private addInputHandlers() {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.handlePointerAttempt(pointer));
    this.input.keyboard?.on("keydown-SPACE", () => this.handleAttempt(this.dialAngle));
  }

  private handlePointerAttempt(pointer: Phaser.Input.Pointer) {
    const { width, height } = getSceneBounds(this);
    const layout = getSafeDialLayout(width, height);
    const pointerPosition = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const dx = pointerPosition.x - layout.center.x;
    const dy = pointerPosition.y - layout.center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const ringMin = layout.radius - 58;
    const ringMax = layout.radius + 58;

    if (distance < ringMin || distance > ringMax) {
      return;
    }

    this.handleAttempt(angleFromDialDelta(dx, dy));
  }

  private handleAttempt(attemptAngle: number) {
    if (this.safeState.completed || this.safeState.failed) {
      return;
    }

    const previousStage = this.safeState.stageIndex;
    this.safeState = applySafeAttempt(this.safeState, attemptAngle, this.safeConfig);

    if (this.safeState.stageIndex > previousStage) {
      this.cameras.main.flash(140, 143, 247, 191, false);
      this.updateTargetArc();
    } else {
      this.cameras.main.shake(140, 0.006);
    }

    this.emitStatus();

    if (this.safeState.completed) {
      this.complete(true);
    } else if (this.safeState.failed) {
      this.complete(false);
    }
  }

  private updateTargetArc() {
    const targetAngle = this.safeConfig.targetAngles[this.safeState.stageIndex];

    if (!this.targetGraphics || targetAngle === undefined) {
      this.targetGraphics?.clear();
      return;
    }

    const { width, height } = getSceneBounds(this);
    const layout = getSafeDialLayout(width, height);
    this.targetGraphics.clear();
    this.targetGraphics.lineStyle(16, 0xf3b74d, 0.95);
    this.drawDialArc(
      this.targetGraphics,
      layout.center,
      layout.radius + 1,
      targetAngle - this.safeConfig.windowSize,
      targetAngle + this.safeConfig.windowSize,
    );

    this.stageText?.setText(
      `Tumbler ${Math.min(this.safeState.stageIndex + 1, this.safeConfig.targetAngles.length)} / ${
        this.safeConfig.targetAngles.length
      } - click the amber band or press Space as the arm crosses it.`,
    );
  }

  private updateArm() {
    if (!this.armGraphics) {
      return;
    }

    const { width, height } = getSceneBounds(this);
    const layout = getSafeDialLayout(width, height);
    const point = pointOnDial(layout.center, this.dialAngle, layout.radius + 26);
    this.armGraphics.clear();
    this.armGraphics.lineStyle(5, 0x2ce6ff, 1);
    this.armGraphics.lineBetween(layout.center.x, layout.center.y, point.x, point.y);
  }

  private pointOnDial(angle: number, distance: number) {
    const { width, height } = getSceneBounds(this);
    const { center } = getSafeDialLayout(width, height);
    return pointOnDial(center, angle, distance);
  }

  private drawDialArc(
    graphics: Phaser.GameObjects.Graphics,
    center: { x: number; y: number },
    radius: number,
    startAngle: number,
    endAngle: number,
  ) {
    const normalizedStart = Phaser.Math.Angle.WrapDegrees(startAngle);
    const normalizedEnd = Phaser.Math.Angle.WrapDegrees(endAngle);
    const sweep = ((normalizedEnd - normalizedStart + 360) % 360) || 360;
    const segmentCount = Math.max(8, Math.ceil(sweep / 4));
    const first = pointOnDial(center, normalizedStart, radius);

    graphics.beginPath();
    graphics.moveTo(first.x, first.y);

    for (let index = 1; index <= segmentCount; index += 1) {
      const angle = normalizedStart + (sweep * index) / segmentCount;
      const point = pointOnDial(center, angle, radius);
      graphics.lineTo(point.x, point.y);
    }

    graphics.strokePath();
  }

  private emitStatus() {
    gameEvents.emit("safe-hack:status", {
      trace: this.safeState.trace,
      timeRemaining: this.timeRemaining,
      progress: this.safeState.stageIndex / this.safeConfig.targetAngles.length,
      mistakes: this.safeState.mistakes,
      shieldCharges: 0,
      message: this.safeState.message,
    });
  }

  private complete(success: boolean) {
    if (this.completed) {
      return;
    }

    this.completed = true;
    this.timer?.destroy();
    this.emitStatus();

    const precision = getSafePrecision(this.safeState);
    const { width, height } = getSceneBounds(this);
    const overlayLayout = getSafeDialLayout(width, height).overlay;
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
      .text(overlayLayout.x, overlayLayout.y, success ? "SAFE OPEN" : "SAFE LOCKED", {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: "30px",
        color: success ? "#8ff7bf" : "#ff9aa5",
        fontStyle: "900",
      })
      .setOrigin(0.5);

    this.time.delayedCall(700, () => {
      gameEvents.emit("safe-hack:complete", {
        contractId: this.safeConfig.contractId,
        success,
        trace: Math.round(this.safeState.trace),
        timeRemaining: Math.max(0, this.timeRemaining),
        mistakes: this.safeState.mistakes,
        shieldAbsorbed: 0,
        toolId: this.safeConfig.toolId,
        stagesCompleted: this.safeState.hits,
        precision,
        performanceLabel: getSafePerformanceLabel(precision),
      });
    });
  }
}

function pointOnDial(center: { x: number; y: number }, angle: number, distance: number) {
  const radians = Phaser.Math.DegToRad(angle - 90);
  return {
    x: center.x + Math.cos(radians) * distance,
    y: center.y + Math.sin(radians) * distance,
  };
}

function angleFromDialDelta(dx: number, dy: number) {
  return (Phaser.Math.RadToDeg(Math.atan2(dy, dx)) + 90 + 360) % 360;
}

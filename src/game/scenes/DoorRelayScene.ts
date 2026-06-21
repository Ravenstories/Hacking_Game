import Phaser from "phaser";
import type { Point } from "../stageLayout";
import { drawGrid, getDoorRelayLayout, getSceneBounds } from "../stageLayout";
import {
  applyTraceTick,
  createDoorRelayConfig,
  createDoorRelayState,
  getDoorRelayProgress,
  type DoorRelayConfig,
  type DoorRelayOptions,
  type DoorRelayState,
} from "../doorRelay/doorRelayLogic";
import { gameEvents } from "../gameEvents";
import {
  extendRoutingPath,
  getConnectedNodeIds,
  getModuleName,
  getRequiredModuleForNode,
  getRequiredModulesForPath,
  placeRoutingModule,
  removeRoutingModule,
  resolveRoutingPath,
  startRoutingPath,
  type RoutingModule,
  type RoutingModuleId,
  type RoutingNode,
} from "../routing/routingLogic";

type ModuleButton = {
  id: RoutingModuleId;
  objects: Phaser.GameObjects.GameObject[];
};

type BoardLayout = {
  frame: { x: number; y: number; width: number; height: number };
  board: { x: number; y: number; width: number; height: number };
  palette: { x: number; y: number; width: number; height: number };
  nodeRadius: number;
  overlay: { x: number; y: number; width: number; height: number };
};

export class DoorRelayScene extends Phaser.Scene {
  private readonly relayConfig: DoorRelayConfig;
  private relayState: DoorRelayState;
  private timeRemaining: number;
  private renderObjects: Phaser.GameObjects.GameObject[] = [];
  private nodeObjects = new Map<string, Phaser.GameObjects.Arc>();
  private nodePositions = new Map<string, Point>();
  private moduleButtons: ModuleButton[] = [];
  private selectedModule?: RoutingModuleId;
  private timer?: Phaser.Time.TimerEvent;
  private completed = false;
  private dragging = false;
  private dragMoved = false;

  constructor(options: DoorRelayOptions) {
    super("DoorRelayScene");
    this.relayConfig = createDoorRelayConfig(options);
    this.relayState = createDoorRelayState(this.relayConfig);
    this.timeRemaining = this.relayConfig.timeLimit;
  }

  create() {
    this.cameras.main.setBackgroundColor("#081016");

    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.renderScene, this);

    this.renderScene();
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
            phase: "complete",
            failed: true,
            message:
              this.timeRemaining <= 0 ? "Relay timed out. Access denied." : "Trace lock reached. Relay burned.",
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
    this.input.off("pointermove", this.handlePointerMove, this);
    this.input.off("pointerup", this.handlePointerUp, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.renderScene, this);
  }

  private renderScene() {
    this.renderObjects.forEach((object) => object.destroy());
    this.renderObjects = [];
    this.nodeObjects.clear();
    this.nodePositions.clear();
    this.moduleButtons = [];

    const { width, height } = getSceneBounds(this);
    const baseLayout = getDoorRelayLayout(width, height);
    const layout = this.getBoardLayout(width, height);
    const graphics = this.add.graphics();
    this.renderObjects.push(graphics);

    drawGrid(graphics, width, height);
    graphics.lineStyle(2, 0x1a6670, 0.45);
    graphics.strokeRoundedRect(layout.frame.x, layout.frame.y, layout.frame.width, layout.frame.height, 12);

    const compact = width < 520;
    const title = this.add
      .text(layout.frame.x + 16, Math.max(16, layout.frame.y - 30), compact ? "DOOR RELAY / ROUTING" : "DOOR RELAY / MODULAR SIGNAL ROUTING", {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: compact ? "14px" : "16px",
        color: "#dceff2",
      })
      .setAlpha(0.92);
    this.renderObjects.push(title);

    this.drawEdges(graphics, layout);
    this.drawCablePath(graphics);
    this.drawNodes(layout);
    this.drawModulePalette(layout);
    this.drawInstruction(layout);

    const overlay = baseLayout.overlay;
    layout.overlay = overlay;
  }

  private drawEdges(graphics: Phaser.GameObjects.Graphics, layout: BoardLayout) {
    const scannerPath = new Set<string>();
    if (this.relayConfig.scannerActive) {
      for (let index = 1; index < this.relayConfig.recommendedPath.length; index += 1) {
        scannerPath.add(edgeKey(this.relayConfig.recommendedPath[index - 1], this.relayConfig.recommendedPath[index]));
      }
    }

    this.relayConfig.edges.forEach((edge) => {
      const from = this.getNodePosition(edge.from, layout);
      const to = this.getNodePosition(edge.to, layout);
      const isScanned = scannerPath.has(edgeKey(edge.from, edge.to));

      graphics.lineStyle(edge.long ? 2 : 3, isScanned ? 0xf3b74d : 0x2ce6ff, isScanned ? 0.36 : 0.18);
      if (edge.long) {
        this.drawDashedLine(graphics, from, to, 14, 8);
      } else {
        graphics.lineBetween(from.x, from.y, to.x, to.y);
      }
    });
  }

  private drawCablePath(graphics: Phaser.GameObjects.Graphics) {
    if (this.relayState.currentPath.length < 2) {
      return;
    }

    graphics.lineStyle(5, 0x35f1ff, 0.88);
    for (let index = 1; index < this.relayState.currentPath.length; index += 1) {
      const from = this.nodePositions.get(this.relayState.currentPath[index - 1]);
      const to = this.nodePositions.get(this.relayState.currentPath[index]);
      if (from && to) {
        graphics.lineBetween(from.x, from.y, to.x, to.y);
      }
    }
  }

  private drawNodes(layout: BoardLayout) {
    this.relayConfig.nodes.forEach((node) => {
      const position = this.getNodePosition(node.id, layout);
      const placedModule = this.relayState.placedModules[node.id];
      const visibleKind = node.revealed || Boolean(placedModule);
      const style = this.getNodeStyle(node, visibleKind);
      const hitRadius = this.getNodeHitRadius(layout, node);
      const routeTarget = this.getRouteTargetStyle(node);

      if (routeTarget) {
        const target = this.add.circle(position.x, position.y, hitRadius, routeTarget.fill, 0.08);
        target.setStrokeStyle(3, routeTarget.stroke, routeTarget.alpha);
        this.renderObjects.push(target);
      }

      const hitCircle = this.add.circle(position.x, position.y, hitRadius, 0x000000, 0.001);
      hitCircle.setInteractive({ useHandCursor: true });
      hitCircle.on("pointerdown", () => this.handleNodePointerDown(node));
      this.renderObjects.push(hitCircle);

      const circle = this.add.circle(position.x, position.y, layout.nodeRadius, style.fill, style.fillAlpha);

      circle.setStrokeStyle(style.strokeWidth, style.stroke, style.strokeAlpha);
      circle.setInteractive({ useHandCursor: true });
      circle.on("pointerdown", () => this.handleNodePointerDown(node));
      this.renderObjects.push(circle);
      this.nodeObjects.set(node.id, circle);

      const label = this.add
        .text(position.x, position.y - 1, visibleKind ? node.label : "?", {
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: `${Math.round(layout.nodeRadius * 0.58)}px`,
          color: style.text,
          fontStyle: "800",
        })
        .setOrigin(0.5);
      this.renderObjects.push(label);

      const caption = this.getNodeCaption(node, visibleKind, placedModule);
      const captionText = this.add
        .text(position.x, position.y + layout.nodeRadius + 16, caption, {
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: "11px",
          color: placedModule ? "#f5cf74" : "#89a9b1",
        })
        .setOrigin(0.5);
      this.renderObjects.push(captionText);

      if (this.relayConfig.scannerActive && this.relayConfig.recommendedPath.includes(node.id) && node.kind !== "start") {
        const hint = this.add.circle(position.x, position.y, layout.nodeRadius + 9, 0x000000, 0);
        hint.setStrokeStyle(2, 0xf3b74d, 0.55);
        hint.setInteractive({ useHandCursor: true });
        hint.on("pointerdown", () => this.handleNodePointerDown(node));
        this.renderObjects.push(hint);
      }
    });
  }

  private drawModulePalette(layout: BoardLayout) {
    const graphics = this.add.graphics();
    this.renderObjects.push(graphics);
    graphics.fillStyle(0x081820, 0.92);
    graphics.fillRoundedRect(layout.palette.x, layout.palette.y, layout.palette.width, layout.palette.height, 10);
    graphics.lineStyle(1, 0x1a6670, 0.65);
    graphics.strokeRoundedRect(layout.palette.x, layout.palette.y, layout.palette.width, layout.palette.height, 10);

    const title = this.add.text(layout.palette.x + 14, layout.palette.y + 11, "MODULES", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "12px",
      color: "#dceff2",
      fontStyle: "800",
    });
    this.renderObjects.push(title);

    const slotText = this.add.text(
      layout.palette.x + layout.palette.width - 14,
      layout.palette.y + 11,
      `${Object.keys(this.relayState.placedModules).length}/${this.relayConfig.moduleSlots} SLOTS`,
      {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: "12px",
        color: "#8eb0b8",
        fontStyle: "700",
      },
    );
    slotText.setOrigin(1, 0);
    this.renderObjects.push(slotText);

    const columns = layout.palette.width < 360 ? 3 : 5;
    const buttonWidth = Math.min(92, Math.max(50, (layout.palette.width - 28 - (columns - 1) * 8) / columns));
    const buttonHeight = layout.palette.width < 360 ? 32 : 36;
    const startX = layout.palette.x + 14;
    const buttonY = layout.palette.y + 38;

    this.relayConfig.modules.forEach((module, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + column * (buttonWidth + 8);
      const y = buttonY + row * (buttonHeight + 8);
      this.drawModuleButton(module, x, y, buttonWidth, buttonHeight);
    });
  }

  private drawModuleButton(module: RoutingModule, x: number, y: number, width: number, height: number) {
    const usedCount = Object.values(this.relayState.placedModules).filter((moduleId) => moduleId === module.id).length;
    const remaining = Math.max(0, module.remainingUses - usedCount);
    const isSelected = this.selectedModule === module.id;
    const background = this.add.rectangle(x, y, width, height, isSelected ? 0x143b43 : 0x07131a, 0.96);
    background.setOrigin(0, 0);
    background.setStrokeStyle(1, isSelected ? 0x35f1ff : remaining > 0 ? 0x245762 : 0x273842, isSelected ? 0.95 : 0.7);
    background.setInteractive({ useHandCursor: remaining > 0 });
    background.on("pointerdown", () => {
      if (remaining <= 0) {
        return;
      }

      this.selectedModule = isSelected ? undefined : module.id;
      this.relayState = {
        ...this.relayState,
        message: this.selectedModule ? `${module.name} selected. Click a matching relay socket.` : "Module deselected.",
      };
      this.renderScene();
      this.emitStatus();
    });

    const label = this.add
      .text(x + width / 2, y + 10, module.shortName, {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: "12px",
        color: remaining > 0 ? "#dffcff" : "#53676f",
        fontStyle: "900",
      })
      .setOrigin(0.5);
    const count = this.add
      .text(x + width / 2, y + 25, `x${remaining}`, {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: "10px",
        color: remaining > 0 ? "#f3b74d" : "#53676f",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    this.renderObjects.push(background, label, count);
    this.moduleButtons.push({ id: module.id, objects: [background, label, count] });
  }

  private drawInstruction(layout: BoardLayout) {
    const requiredModules = getRequiredModulesForPath(
      this.relayConfig.recommendedPath,
      this.relayConfig.nodes,
      this.relayConfig.edges,
    );
    const moduleHint = requiredModules
      .map(({ moduleId }) => getModuleName(moduleId))
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(" + ");
    const firstMissingModule = requiredModules.find(({ nodeId, moduleId }) => this.relayState.placedModules[nodeId] !== moduleId);
    const firstMissingNode = firstMissingModule
      ? this.relayConfig.nodes.find((node) => node.id === firstMissingModule.nodeId)
      : undefined;
    const routeText = this.relayConfig.scannerActive
      ? ` Route: ${this.relayConfig.recommendedPath
          .map((nodeId) => this.relayConfig.nodes.find((node) => node.id === nodeId)?.label ?? nodeId)
          .join(" > ")}.`
      : "";
    const instruction =
      this.relayState.phase === "routing"
        ? "Click the next connected node, or drag the cable. Reach OUT to send the pulse."
        : firstMissingModule && firstMissingNode
          ? `Step 1: select ${getModuleName(firstMissingModule.moduleId)}. Step 2: click ${firstMissingNode.label}.${routeText}`
          : `Modules seated. Click IN, then click each connected node to OUT.${routeText || ` Tools needed: ${moduleHint}.`}`;
    const text = this.add.text(layout.frame.x + 16, layout.frame.y + layout.frame.height - 24, instruction, {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: layout.frame.width < 360 ? "10px" : "12px",
      color: "#8eb0b8",
      wordWrap: { width: layout.frame.width - 32 },
    });
    this.renderObjects.push(text);
  }

  private handleNodePointerDown(node: RoutingNode) {
    if (this.relayState.completed || this.relayState.failed) {
      return;
    }

    if (!this.selectedModule && this.relayState.phase === "routing") {
      this.handleRouteNodeClick(node);
      return;
    }

    if (this.selectedModule && canReceiveModule(node)) {
      this.relayState = placeRoutingModule(this.relayState, this.relayConfig, node.id, this.selectedModule);
      this.pulseNode(node.id, this.relayState.placedModules[node.id] === getRequiredModuleForNode(node));
      this.renderScene();
      this.emitStatus();
      return;
    }

    if (!this.selectedModule && this.relayState.placedModules[node.id]) {
      this.relayState = removeRoutingModule(this.relayState, node.id);
      this.renderScene();
      this.emitStatus();
      return;
    }

    if (node.kind === "start") {
      this.dragging = true;
      this.dragMoved = false;
      this.selectedModule = undefined;
      this.relayState = startRoutingPath(this.relayState, node.id);
      this.renderScene();
      this.emitStatus();
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.dragging || this.relayState.phase !== "routing") {
      return;
    }

    this.dragMoved = true;
    const nearestNode = this.getNearestNode(pointer.x, pointer.y);
    if (!nearestNode) {
      return;
    }

    const previousPath = this.relayState.currentPath;
    const nextState = extendRoutingPath(this.relayState, this.relayConfig, nearestNode.id);
    if (nextState.currentPath !== previousPath) {
      this.relayState = nextState;
      this.renderScene();
      this.emitStatus();
    }
  }

  private handlePointerUp() {
    if (!this.dragging || this.relayState.phase !== "routing") {
      return;
    }

    if (!this.dragMoved) {
      this.dragging = false;
      this.emitStatus();
      return;
    }

    this.dragging = false;
    const previousShield = this.relayState.shieldCharges;
    this.relayState = resolveRoutingPath(this.relayState, this.relayConfig);
    this.updateShieldPulse(previousShield);
    this.renderScene();
    this.emitStatus();

    if (this.relayState.completed) {
      this.complete(!this.relayState.failed);
    } else if (this.relayState.failed) {
      this.complete(false);
    } else {
      this.cameras.main.shake(140, 0.004);
    }
  }

  private handleRouteNodeClick(node: RoutingNode) {
    const previousPath = this.relayState.currentPath;
    const nextState = extendRoutingPath(this.relayState, this.relayConfig, node.id);

    if (nextState.currentPath === previousPath) {
      this.relayState = {
        ...this.relayState,
        message: "That node is not connected to the current cable.",
      };
      this.renderScene();
      this.emitStatus();
      return;
    }

    this.relayState = nextState;

    if (node.kind === "exit") {
      const previousShield = this.relayState.shieldCharges;
      this.relayState = resolveRoutingPath(this.relayState, this.relayConfig);
      this.updateShieldPulse(previousShield);
    }

    this.renderScene();
    this.emitStatus();

    if (this.relayState.completed) {
      this.complete(!this.relayState.failed);
    } else if (this.relayState.failed) {
      this.complete(false);
    }
  }

  private getNearestNode(x: number, y: number) {
    const lastNodeId = this.relayState.currentPath[this.relayState.currentPath.length - 1];
    const connectedNodeIds = new Set(getConnectedNodeIds(this.relayConfig, lastNodeId));
    const previousNodeId = this.relayState.currentPath[this.relayState.currentPath.length - 2];
    if (previousNodeId) {
      connectedNodeIds.add(previousNodeId);
    }

    let nearest: RoutingNode | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    const { width, height } = getSceneBounds(this);
    const layout = this.getBoardLayout(width, height);
    const threshold = layout.nodeRadius * 1.75;

    this.relayConfig.nodes.forEach((node) => {
      if (!connectedNodeIds.has(node.id)) {
        return;
      }

      const position = this.nodePositions.get(node.id);
      if (!position) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(x, y, position.x, position.y);
      if (distance <= threshold && distance < nearestDistance) {
        nearest = node;
        nearestDistance = distance;
      }
    });

    return nearest;
  }

  private getNodePosition(nodeId: string, layout: BoardLayout) {
    const existing = this.nodePositions.get(nodeId);
    if (existing) {
      return existing;
    }

    const node = this.relayConfig.nodes.find((candidate) => candidate.id === nodeId);
    const position = {
      x: layout.board.x + (node?.x ?? 0.5) * layout.board.width,
      y: layout.board.y + (node?.y ?? 0.5) * layout.board.height,
    };
    this.nodePositions.set(nodeId, position);
    return position;
  }

  private getBoardLayout(width: number, height: number): BoardLayout {
    const base = getDoorRelayLayout(width, height);
    const paletteHeight = width < 520 ? 128 : 92;
    const boardTop = base.frame.y + 16;
    const boardBottom = base.frame.y + base.frame.height - paletteHeight - 34;

    return {
      frame: base.frame,
      board: {
        x: base.frame.x + 20,
        y: boardTop,
        width: base.frame.width - 40,
        height: Math.max(220, boardBottom - boardTop),
      },
      palette: {
        x: base.frame.x + 16,
        y: base.frame.y + base.frame.height - paletteHeight - 10,
        width: base.frame.width - 32,
        height: paletteHeight,
      },
      nodeRadius: clamp(Math.min(width, height) * 0.04, 20, 30),
      overlay: base.overlay,
    };
  }

  private getNodeStyle(node: RoutingNode, visibleKind: boolean) {
    if (!visibleKind) {
      return {
        fill: 0x07131a,
        fillAlpha: 1,
        stroke: 0x48626b,
        strokeAlpha: 0.72,
        strokeWidth: 2,
        text: "#91a8ae",
      };
    }

    const styles: Record<string, { fill: number; stroke: number; text: string }> = {
      start: { fill: 0x0a2d33, stroke: 0x35f1ff, text: "#dffcff" },
      exit: { fill: 0x0f3024, stroke: 0x8ff7bf, text: "#dcffe8" },
      relay: { fill: 0x0e2630, stroke: 0x34d7e7, text: "#dffcff" },
      unstable: { fill: 0x30260e, stroke: 0xf3b74d, text: "#fff1c7" },
      locked: { fill: 0x241f34, stroke: 0xa891ff, text: "#ece7ff" },
      hostile: { fill: 0x351018, stroke: 0xff5b6e, text: "#ffe0e4" },
      noisy: { fill: 0x123019, stroke: 0x8ff7bf, text: "#e3ffed" },
      socket: { fill: 0x102d35, stroke: 0x35f1ff, text: "#dffcff" },
      trap: { fill: 0x2a0d14, stroke: 0xff4b5d, text: "#ffccd2" },
    };
    const style = styles[node.kind];

    return {
      fill: style.fill,
      fillAlpha: 1,
      stroke: style.stroke,
      strokeAlpha: 0.92,
      strokeWidth: 2,
      text: style.text,
    };
  }

  private getNodeHitRadius(layout: BoardLayout, node: RoutingNode) {
    const scannerHighlighted = this.relayConfig.scannerActive && this.relayConfig.recommendedPath.includes(node.id);
    const routeTarget = Boolean(this.getRouteTargetStyle(node));
    return layout.nodeRadius + (scannerHighlighted || routeTarget ? 22 : 12);
  }

  private getRouteTargetStyle(node: RoutingNode) {
    if (this.relayState.phase !== "routing" || this.relayState.currentPath.length === 0) {
      return undefined;
    }

    const lastNodeId = this.relayState.currentPath[this.relayState.currentPath.length - 1];
    const connected = getConnectedNodeIds(this.relayConfig, lastNodeId);
    const previousNodeId = this.relayState.currentPath[this.relayState.currentPath.length - 2];
    const isBacktrack = node.id === previousNodeId;
    if ((!connected.includes(node.id) || this.relayState.currentPath.includes(node.id)) && !isBacktrack) {
      return undefined;
    }

    const routeIsOnScannerPath = this.relayState.currentPath.every(
      (nodeId, index) => this.relayConfig.recommendedPath[index] === nodeId,
    );
    const scannerNextNodeId = routeIsOnScannerPath
      ? this.relayConfig.recommendedPath[this.relayState.currentPath.length]
      : undefined;

    if (this.relayConfig.scannerActive && node.id === scannerNextNodeId) {
      return { fill: 0xf3b74d, stroke: 0xf3b74d, alpha: 0.92 };
    }

    if (node.kind === "trap") {
      return { fill: 0xff4b5d, stroke: 0xff4b5d, alpha: 0.72 };
    }

    if (isBacktrack) {
      return { fill: 0x8eb0b8, stroke: 0x8eb0b8, alpha: 0.45 };
    }

    return { fill: 0x35f1ff, stroke: 0x35f1ff, alpha: 0.55 };
  }

  private getNodeCaption(node: RoutingNode, visibleKind: boolean, placedModule?: RoutingModuleId) {
    if (placedModule) {
      return getModuleName(placedModule).toUpperCase();
    }

    if (!visibleKind) {
      return "UNKNOWN";
    }

    if (node.kind === "start") {
      return "INPUT";
    }

    if (node.kind === "exit") {
      return "EXIT";
    }

    const requiredModule = getRequiredModuleForNode(node);
    if (requiredModule) {
      return getModuleName(requiredModule).toUpperCase();
    }

    return node.kind.toUpperCase();
  }

  private pulseNode(nodeId: string, success: boolean) {
    const node = this.nodeObjects.get(nodeId);
    if (!node) {
      return;
    }

    node.setStrokeStyle(3, success ? 0xf3b74d : 0xff4b5d, 1);
    this.tweens.add({
      targets: node,
      scale: success ? 1.13 : 0.92,
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

  private drawDashedLine(graphics: Phaser.GameObjects.Graphics, from: Point, to: Point, dash: number, gap: number) {
    const distance = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const angle = Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y);
    let traveled = 0;

    while (traveled < distance) {
      const start = traveled;
      const end = Math.min(traveled + dash, distance);
      graphics.lineBetween(
        from.x + Math.cos(angle) * start,
        from.y + Math.sin(angle) * start,
        from.x + Math.cos(angle) * end,
        from.y + Math.sin(angle) * end,
      );
      traveled += dash + gap;
    }
  }

  private emitStatus() {
    gameEvents.emit("door-hack:status", {
      trace: this.relayState.trace,
      timeRemaining: Math.max(0, this.timeRemaining),
      progress: getDoorRelayProgress(this.relayState, this.relayConfig),
      mistakes: this.relayState.mistakes,
      shieldCharges: this.relayState.shieldCharges,
      phase: this.relayState.phase,
      modulesPlaced: Object.keys(this.relayState.placedModules).length,
      scannerHintIndex: this.relayConfig.scannerActive ? this.relayState.currentPath.length : undefined,
      message: this.relayState.message,
    });
  }

  private complete(success: boolean) {
    if (this.completed) {
      return;
    }

    this.completed = true;
    this.dragging = false;
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
        stagesCompleted: this.relayState.currentPath.length,
        performanceLabel: success ? "Clean route" : "Burned route",
        consumedModules: Object.values(this.relayState.placedModules),
      });
    });
  }
}

function canReceiveModule(node: RoutingNode) {
  return Boolean(getRequiredModuleForNode(node));
}

function edgeKey(firstNodeId: string, secondNodeId: string) {
  return [firstNodeId, secondNodeId].sort().join(":");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

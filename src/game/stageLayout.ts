import type Phaser from "phaser";

export type Point = {
  x: number;
  y: number;
};

export type Frame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getSceneBounds(scene: Phaser.Scene) {
  return {
    width: scene.scale.width,
    height: scene.scale.height,
  };
}

export function getDoorRelayLayout(width: number, height: number) {
  const padding = clamp(Math.min(width, height) * 0.055, 24, 44);
  const frame: Frame = {
    x: padding,
    y: padding + 18,
    width: width - padding * 2,
    height: height - padding * 2 - 18,
  };
  const nodeRadius = clamp(Math.min(width, height) * 0.052, 24, 36);
  const nodeYHigh = frame.y + frame.height * 0.34;
  const nodeYLow = frame.y + frame.height * 0.58;

  return {
    frame,
    title: {
      x: frame.x + 12,
      y: Math.max(16, frame.y - 28),
    },
    instruction: {
      x: frame.x + 12,
      y: frame.y + frame.height - 34,
    },
    nodeRadius,
    nodes: [
      { x: frame.x + frame.width * 0.11, y: nodeYLow },
      { x: frame.x + frame.width * 0.29, y: nodeYHigh },
      { x: frame.x + frame.width * 0.5, y: nodeYLow },
      { x: frame.x + frame.width * 0.71, y: nodeYHigh },
      { x: frame.x + frame.width * 0.89, y: nodeYLow },
    ],
    overlay: {
      x: width / 2,
      y: height / 2,
      width: clamp(width * 0.58, 360, 520),
      height: 112,
    },
  };
}

export function getSafeDialLayout(width: number, height: number) {
  const padding = clamp(Math.min(width, height) * 0.055, 24, 44);
  const frame: Frame = {
    x: padding,
    y: padding,
    width: width - padding * 2,
    height: height - padding * 2,
  };
  const radius = clamp(Math.min(frame.width * 0.27, frame.height * 0.32), 122, 190);
  const center: Point = {
    x: frame.x + frame.width / 2,
    y: frame.y + frame.height * 0.54,
  };

  return {
    frame,
    center,
    radius,
    title: {
      x: frame.x + 18,
      y: frame.y + 16,
    },
    instruction: {
      x: frame.x + 26,
      y: frame.y + frame.height - clamp(height * 0.07, 44, 58),
    },
    overlay: {
      x: center.x,
      y: center.y,
      width: clamp(width * 0.58, 360, 540),
      height: 124,
    },
  };
}

export function drawGrid(graphics: Phaser.GameObjects.Graphics, width: number, height: number) {
  graphics.lineStyle(1, 0x14303a, 0.5);

  for (let x = 0; x <= width; x += 40) {
    graphics.lineBetween(x, 0, x, height);
  }

  for (let y = 0; y <= height; y += 40) {
    graphics.lineBetween(0, y, width, y);
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

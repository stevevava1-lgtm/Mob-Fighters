const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const menuOverlay = document.getElementById("menuOverlay");
const menuTitle = document.getElementById("menuTitle");
const menuDesc = document.getElementById("menuDesc");
const menuActions = document.getElementById("menuActions");
const closeMenuBtn = document.getElementById("closeMenuBtn");

const player = {
  x: 160,
  y: 400,
  radius: 24,
  speed: 3.3,
  color: "#8a4fff",
};

const gameState = {
  money: 20,
  selectedHotbar: 0,
  inventoryOpen: false,
  openMenuType: null,
  message: "",
  messageUntil: 0,
};

const STORAGE_KEY = "grow_some_plants_save";
const LEGACY_STORAGE_KEYS = ["grow_some_plants_save_v2", "grow_some_plants_save_v1"];

const items = {
  carrotSeed: {
    id: "carrotSeed",
    name: "Carrot Seed",
    icon: "seed",
    price: 5,
    tint: "#d6862f",
    stackable: true,
  },
  mintSeed: {
    id: "mintSeed",
    name: "Mint Seed",
    icon: "mintSeed",
    price: 70,
    tint: "#5eb88a",
    stackable: true,
  },
  carrot: {
    id: "carrot",
    name: "Carrot",
    icon: "carrot",
    sellPrice: 8,
    tint: "#e8721d",
    stackable: false,
  },
  mint: {
    id: "mint",
    name: "Mint",
    icon: "mint",
    sellPrice: 110,
    tint: "#6ecf9a",
    stackable: true,
  },
};

const inventory = Array.from({ length: 100 }, () => null);

const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
};

const WEST_GARDEN_W = 400;
const MAIN_GARDEN_W = 670;
const DIRT_RIGHT = WEST_GARDEN_W + MAIN_GARDEN_W;
const SHOP_ZONE_W = 280;
const CLEARING_W = MAIN_GARDEN_W;

const stands = [
  {
    type: "sell",
    x: DIRT_RIGHT + 20,
    y: 148,
    w: 210,
    h: 165,
    stripeA: "#da3434",
    stripeB: "#ffffff",
    text: "SELL",
    textColor: "#7a1010",
    menuTitle: "Sell Stand",
    menuDesc: "Sell carrots, mint, and other goods here for cash.",
  },
  {
    type: "buy",
    x: DIRT_RIGHT + 20,
    y: 338,
    w: 210,
    h: 165,
    stripeA: "#2e67e6",
    stripeB: "#ffffff",
    text: "BUY",
    textColor: "#12367d",
    menuTitle: "Buy Stand",
    menuDesc: "Carrot seeds $5 · Mint seeds $70. Left-click buys 1, right-click for quantity.",
  },
];

const WORLD_WIDTH = DIRT_RIGHT + SHOP_ZONE_W + CLEARING_W;
const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 600;
canvas.width = VIEW_WIDTH;
canvas.height = VIEW_HEIGHT;
const world = { width: WORLD_WIDTH, height: VIEW_HEIGHT };
const camera = { x: 0, y: 0 };
let cameraMode = "follow";

const PLANT_GROW_MS = 5000;
const MINT_GROW_MS = 15000;
const PLANT_GRID = 30;
const plants = [];
let lastAutoSaveAt = 0;

function now() {
  return Date.now();
}

function showMessage(text, duration = 1600) {
  gameState.message = text;
  gameState.messageUntil = now() + duration;
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(num, max));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function toFixedNumber(num, digits = 2) {
  return Number(num.toFixed(digits));
}

function circleIntersectsRect(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function drawDirtTexture(rectX, rectY, rectW, rectH, base, dark, light) {
  ctx.fillStyle = base;
  ctx.fillRect(rectX, rectY, rectW, rectH);
  for (let i = 0; i < 50; i += 1) {
    const px = rectX + ((i * 47) % rectW);
    const py = rectY + ((i * 29) % rectH);
    ctx.fillStyle = i % 2 === 0 ? dark : light;
    ctx.fillRect(px, py, 3, 2);
  }
}

function drawWoodTexture(rectX, rectY, rectW, rectH) {
  ctx.fillStyle = "#8c6642";
  ctx.fillRect(rectX, rectY, rectW, rectH);

  for (let y = rectY; y < rectY + rectH; y += 34) {
    ctx.fillStyle = "rgba(66, 42, 24, 0.35)";
    ctx.fillRect(rectX, y, rectW, 2);
    ctx.fillStyle = "rgba(223, 188, 143, 0.12)";
    ctx.fillRect(rectX, y + 3, rectW, 1);
  }

  for (let i = 0; i < 120; i += 1) {
    const knotX = rectX + ((i * 61) % rectW);
    const knotY = rectY + ((i * 43) % rectH);
    ctx.strokeStyle = "rgba(70, 45, 27, 0.35)";
    ctx.beginPath();
    ctx.ellipse(knotX, knotY, 4, 2, 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawGardenBackground() {
  drawDirtTexture(0, 0, DIRT_RIGHT, world.height, "#775635", "#5f422a", "#8a6640");

  ctx.fillStyle = "rgba(45, 32, 20, 0.35)";
  ctx.fillRect(WEST_GARDEN_W - 2, 96, 4, world.height - 116);

  drawWoodTexture(DIRT_RIGHT, 0, world.width - DIRT_RIGHT, world.height);

  const shopClearingSplit = DIRT_RIGHT + SHOP_ZONE_W;
  ctx.fillStyle = "rgba(55, 38, 22, 0.45)";
  ctx.fillRect(shopClearingSplit - 2, 0, 4, world.height);

  ctx.fillStyle = "rgba(44, 26, 15, 0.52)";
  ctx.fillRect(DIRT_RIGHT - 2, 0, 4, world.height);
}

function getCarrotValueMultiplier(weightKg) {
  const minW = 0.3;
  const midW = 1.09;
  const maxW = 2.3;
  const minMul = 1 / 3;
  const midMul = 1;
  const maxMul = 2.9;
  const w = clamp(weightKg, minW, maxW);
  if (w <= midW) {
    return lerp(minMul, midMul, (w - minW) / (midW - minW));
  }
  return lerp(midMul, maxMul, (w - midW) / (maxW - midW));
}

function getCarrotVisualScale(weightKg) {
  const minW = 0.3;
  const maxW = 2.3;
  const minScale = 0.7;
  const maxScale = 2;
  const w = clamp(weightKg, minW, maxW);
  return lerp(minScale, maxScale, (w - minW) / (maxW - minW));
}

function rollCarrotWeight() {
  const table = [
    { weight: 1.09, chance: 0.4 },
    { weight: 0.3, chance: 1 / 756 },
    { weight: 0.4, chance: 0.02 },
    { weight: 0.5, chance: 1 / 20 },
    { weight: 0.7, chance: 0.12 },
    { weight: 0.9, chance: 0.11 },
    { weight: 1.3, chance: 0.14 },
    { weight: 1.5, chance: 0.08 },
    { weight: 1.8, chance: 0.05 },
    { weight: 2.1, chance: 0.025 },
    { weight: 2.2, chance: 0.052356 },
    { weight: 2.3, chance: 1 / 756 },
  ];
  const r = Math.random();
  let cursor = 0;
  for (const entry of table) {
    cursor += entry.chance;
    if (r <= cursor) return entry.weight;
  }
  return 1.09;
}

function drawStand(stand) {
  const awningHeight = 52;
  const counterHeight = 42;
  const postW = 10;
  const stripeWidth = 18;

  ctx.fillStyle = "#4c311f";
  ctx.fillRect(stand.x + 18, stand.y + awningHeight, postW, stand.h - awningHeight - 8);
  ctx.fillRect(stand.x + stand.w - 28, stand.y + awningHeight, postW, stand.h - awningHeight - 8);

  for (let x = stand.x; x < stand.x + stand.w; x += stripeWidth) {
    const isA = ((x - stand.x) / stripeWidth) % 2 === 0;
    ctx.fillStyle = isA ? stand.stripeA : stand.stripeB;
    ctx.fillRect(x, stand.y, stripeWidth, awningHeight);
  }

  ctx.fillStyle = "#3f2719";
  ctx.beginPath();
  ctx.moveTo(stand.x - 8, stand.y + awningHeight);
  ctx.lineTo(stand.x + stand.w + 8, stand.y + awningHeight);
  ctx.lineTo(stand.x + stand.w, stand.y + awningHeight + 10);
  ctx.lineTo(stand.x, stand.y + awningHeight + 10);
  ctx.closePath();
  ctx.fill();

  drawDirtTexture(
    stand.x + 20,
    stand.y + awningHeight + 10,
    stand.w - 40,
    stand.h - awningHeight - counterHeight - 16,
    "#8f603c",
    "#7f5333",
    "#a06f47"
  );

  ctx.fillStyle = "#6e462a";
  ctx.fillRect(stand.x, stand.y + stand.h - counterHeight, stand.w, counterHeight);
  for (let i = 0; i < 8; i += 1) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.moveTo(stand.x + 10 + i * 24, stand.y + stand.h - counterHeight + 6);
    ctx.lineTo(stand.x + 10 + i * 24, stand.y + stand.h - 6);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
  ctx.fillRect(stand.x + 26, stand.y + 73, stand.w - 52, 48);
  ctx.strokeStyle = "#2f2f2f";
  ctx.lineWidth = 2;
  ctx.strokeRect(stand.x + 26, stand.y + 73, stand.w - 52, 48);

  ctx.fillStyle = stand.textColor;
  ctx.font = "bold 34px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(stand.text, stand.x + stand.w / 2, stand.y + 96);

  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.fillRect(stand.x + 6, stand.y + stand.h + 2, stand.w - 12, 10);
}

function drawMintSerratedLeaf(cx, cy, baseY, tipY, maxHalfW, teeth, fill, stroke, drawVeins) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  for (let i = 0; i <= teeth; i += 1) {
    const t = i / teeth;
    const y = baseY + t * (tipY - baseY);
    const envelope = maxHalfW * Math.sin(Math.PI * (1 - t) * 0.98);
    const bump = i & 1 ? envelope * 0.78 : envelope * 1.16;
    ctx.lineTo(bump, y);
  }
  ctx.lineTo(0, tipY);
  for (let i = teeth; i >= 0; i -= 1) {
    const t = i / teeth;
    const y = baseY + t * (tipY - baseY);
    const envelope = maxHalfW * Math.sin(Math.PI * (1 - t) * 0.98);
    const bump = i & 1 ? envelope * 0.78 : envelope * 1.16;
    ctx.lineTo(-bump, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.1;
  ctx.stroke();

  if (drawVeins) {
    ctx.beginPath();
    ctx.moveTo(0, baseY - 1);
    ctx.lineTo(0, tipY + 2);
    ctx.strokeStyle = "#1a5a3a";
    ctx.lineWidth = 1.35;
    ctx.stroke();
    const laterals = 4;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 1; i <= laterals; i += 1) {
        const t = i / (laterals + 1);
        const y = baseY + t * (tipY - baseY);
        const wAtY = maxHalfW * Math.sin(Math.PI * (1 - t)) * 0.62;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.quadraticCurveTo(side * wAtY * 0.45, y + side * 1.5, side * wAtY, y - 2);
        ctx.strokeStyle = "#1a5a3a";
        ctx.lineWidth = 0.85;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawMintPlant(plant) {
  const age = now() - plant.plantedAt;
  plant.mature = age >= MINT_GROW_MS;
  const px = plant.x;
  const groundY = plant.y;
  const phase = age < 4000 ? 0 : age < 8000 ? 1 : age < 12000 ? 2 : 3;

  const fillMain = "#52c98a";
  const fillHi = "#6ed9a0";
  const strokeCol = "#2a7a52";

  if (phase === 0) {
    ctx.fillStyle = "#8a603e";
    ctx.beginPath();
    ctx.ellipse(px, groundY, 9, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1e3d24";
    ctx.fillRect(px - 2, groundY - 3, 4, 5);
    return;
  }

  if (phase === 1) {
    ctx.strokeStyle = "#2d6b45";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, groundY);
    ctx.lineTo(px, groundY - 8);
    ctx.stroke();
    drawMintSerratedLeaf(px, groundY - 6, 5, -16, 5.5, 3, fillMain, strokeCol, false);
    return;
  }

  if (phase === 2) {
    ctx.strokeStyle = "#2d6b45";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, groundY);
    ctx.lineTo(px, groundY - 10);
    ctx.stroke();
    drawMintSerratedLeaf(px - 4, groundY - 8, 6, -22, 7, 4, fillHi, strokeCol, false);
    drawMintSerratedLeaf(px + 5, groundY - 7, 6, -20, 6.5, 4, fillMain, strokeCol, false);
    return;
  }

  ctx.strokeStyle = "#256341";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, groundY);
  ctx.lineTo(px, groundY - 12);
  ctx.stroke();
  drawMintSerratedLeaf(px - 7, groundY - 10, 7, -30, 11, 6, fillHi, strokeCol, true);
  drawMintSerratedLeaf(px + 8, groundY - 9, 7, -28, 10.5, 6, fillMain, strokeCol, true);
}

function drawPlant(plant) {
  if (plant.type === "mint") {
    drawMintPlant(plant);
    return;
  }

  const age = now() - plant.plantedAt;
  const progress = clamp(age / PLANT_GROW_MS, 0, 1);
  plant.mature = progress >= 1;

  const px = plant.x;
  const groundY = plant.y;
  const sway = Math.sin(now() / 220 + plant.x * 0.02) * 1.8;

  if (progress < 0.22) {
    const moundW = 4 + progress * 18;
    const moundH = 2 + progress * 5;
    ctx.fillStyle = "#8a603e";
    ctx.beginPath();
    ctx.ellipse(px, groundY, moundW, moundH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f1cd87";
    ctx.beginPath();
    ctx.ellipse(px + 1, groundY - 1, 2, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (progress < 0.95) {
    const stemH = 8 + progress * 36;
    const topY = groundY - stemH;
    ctx.strokeStyle = "#2f8f34";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px, groundY);
    ctx.quadraticCurveTo(px + sway * 0.4, groundY - stemH * 0.5, px + sway, topY);
    ctx.stroke();

    const leafSpread = 5 + progress * 10;
    ctx.fillStyle = "#46aa4a";
    ctx.beginPath();
    ctx.ellipse(px - leafSpread, topY + 8, 7, 4, -0.75, 0, Math.PI * 2);
    ctx.ellipse(px + leafSpread, topY + 8, 7, 4, 0.75, 0, Math.PI * 2);
    ctx.fill();

    if (progress > 0.55) {
      ctx.fillStyle = "#54c15a";
      ctx.beginPath();
      ctx.ellipse(px - 4, topY + 1, 6, 3.2, -0.3, 0, Math.PI * 2);
      ctx.ellipse(px + 4, topY - 1, 6, 3.2, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  const weightScale = getCarrotVisualScale(plant.weightKg ?? 1.09);
  const carrotHalfW = 9 * weightScale;
  const carrotHalfH = 14 * weightScale;
  const carrotTopY = groundY - 9 * weightScale;

  ctx.fillStyle = "#df6e1d";
  ctx.beginPath();
  ctx.ellipse(px, carrotTopY, carrotHalfW, carrotHalfH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#bc5610";
  ctx.stroke();

  ctx.strokeStyle = "#2f8f34";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(px, groundY - 18 * weightScale);
  ctx.lineTo(px, groundY - 42 * weightScale);
  ctx.stroke();
  ctx.fillStyle = "#4fb653";
  ctx.beginPath();
  ctx.ellipse(px - 7 * weightScale, groundY - 38 * weightScale, 8 * weightScale, 5 * weightScale, -0.5, 0, Math.PI * 2);
  ctx.ellipse(px + 7 * weightScale, groundY - 38 * weightScale, 8 * weightScale, 5 * weightScale, 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlants() {
  plants.forEach(drawPlant);
}

function drawPlayer() {
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();

  const blobGradient = ctx.createRadialGradient(
    player.x - 10,
    player.y - 12,
    4,
    player.x,
    player.y,
    player.radius
  );
  blobGradient.addColorStop(0, "rgba(255,255,255,0.35)");
  blobGradient.addColorStop(1, "rgba(66,36,124,0.25)");
  ctx.fillStyle = blobGradient;
  ctx.fill();

  ctx.strokeStyle = "#55338f";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(player.x, player.y + 7, player.radius - 6, 0, Math.PI);
  ctx.strokeStyle = "rgba(55, 26, 102, 0.35)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(player.x - 8, player.y - 5, 5.4, 0, Math.PI * 2);
  ctx.arc(player.x + 8, player.y - 5, 5.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#23153a";
  ctx.beginPath();
  ctx.arc(player.x - 8, player.y - 4, 2.4, 0, Math.PI * 2);
  ctx.arc(player.x + 8, player.y - 4, 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(player.x - 7.2, player.y - 4.8, 0.8, 0, Math.PI * 2);
  ctx.arc(player.x + 8.8, player.y - 4.8, 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(player.x, player.y + 5, 7, 0.18 * Math.PI, 0.82 * Math.PI);
  ctx.strokeStyle = "#3a255f";
  ctx.lineWidth = 2.2;
  ctx.stroke();
}

function findEmptyInventorySlot() {
  for (let i = 0; i < inventory.length; i += 1) {
    if (!inventory[i]) return i;
  }
  return -1;
}

function addItem(itemId, amount = 1, meta = null) {
  const itemDef = items[itemId];
  if (!itemDef) return false;

  if (itemDef.stackable) {
    for (let i = 0; i < inventory.length; i += 1) {
      const slot = inventory[i];
      if (slot && slot.itemId === itemId) {
        slot.amount += amount;
        return true;
      }
    }
    const empty = findEmptyInventorySlot();
    if (empty === -1) return false;
    inventory[empty] = { itemId, amount };
    return true;
  }

  for (let n = 0; n < amount; n += 1) {
    const empty = findEmptyInventorySlot();
    if (empty === -1) return false;
    inventory[empty] = { itemId, amount: 1, meta: meta ? { ...meta } : null };
  }
  return true;
}

function removeItem(itemId, amount = 1) {
  for (let i = 0; i < inventory.length; i += 1) {
    const slot = inventory[i];
    if (slot && slot.itemId === itemId && slot.amount >= amount) {
      slot.amount -= amount;
      if (slot.amount === 0) inventory[i] = null;
      return true;
    }
  }
  return false;
}

function popFirstItem(itemId) {
  for (let i = 0; i < inventory.length; i += 1) {
    const slot = inventory[i];
    if (!slot || slot.itemId !== itemId) continue;
    inventory[i] = null;
    return slot;
  }
  return null;
}

function getUnitSellValueForSlot(slot) {
  if (!slot) return 0;
  const itemDef = items[slot.itemId];
  if (!itemDef || !Number.isFinite(itemDef.sellPrice)) return 0;

  if (slot.itemId === "carrot") {
    const weightKg = clamp(Number(slot.meta?.weightKg) || 1.09, 0.3, 2.3);
    const multiplier = getCarrotValueMultiplier(weightKg);
    return Math.max(1, Math.round(itemDef.sellPrice * multiplier));
  }

  return Math.max(1, Math.round(itemDef.sellPrice));
}

function getSlotSellValue(slot) {
  if (!slot) return 0;
  const unit = getUnitSellValueForSlot(slot);
  const amount = Math.max(1, Number(slot.amount) || 1);
  return unit * amount;
}

function getMaxBuyableCount(itemId) {
  const item = items[itemId];
  if (!item || !Number.isFinite(item.price) || item.price <= 0) return 0;
  return Math.floor(gameState.money / item.price);
}

function getHotbarSlot(index) {
  return inventory[index];
}

function getSelectedItem() {
  const slot = getHotbarSlot(gameState.selectedHotbar);
  return slot ? items[slot.itemId] : null;
}

function renderItemIcon(item, x, y, size) {
  if (item.icon === "seed") {
    ctx.fillStyle = "#f1cc84";
    ctx.beginPath();
    ctx.ellipse(x + size / 2, y + size / 2, size * 0.24, size * 0.16, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#be9a52";
    ctx.stroke();
    return;
  }

  if (item.icon === "carrot") {
    ctx.fillStyle = "#de6e20";
    ctx.beginPath();
    ctx.moveTo(x + size * 0.5, y + size * 0.2);
    ctx.lineTo(x + size * 0.75, y + size * 0.8);
    ctx.lineTo(x + size * 0.25, y + size * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#4dbb54";
    ctx.fillRect(x + size * 0.44, y + size * 0.06, size * 0.12, size * 0.18);
    return;
  }

  if (item.icon === "mintSeed") {
    ctx.fillStyle = "#c8e8d8";
    ctx.beginPath();
    ctx.ellipse(x + size * 0.5, y + size * 0.55, size * 0.18, size * 0.12, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3d8f65";
    ctx.stroke();
    ctx.fillStyle = "#2a5c40";
    ctx.fillRect(x + size * 0.46, y + size * 0.38, size * 0.08, size * 0.12);
    return;
  }

  if (item.icon === "mint") {
    const cx = x + size * 0.5;
    const cy = y + size * 0.62;
    const sc = size / 30;
    drawMintSerratedLeaf(cx - 5 * sc, cy, 2.5 * sc, -11 * sc, 4.8 * sc, 5, "#6ed9a0", "#2a7a52", true);
    drawMintSerratedLeaf(cx + 5 * sc, cy, 2.5 * sc, -10 * sc, 4.5 * sc, 5, "#52c98a", "#2a7a52", true);
  }
}

function drawHotbar() {
  const { x, y, barW, barH } = getHotbarLayout();
  drawDirtTexture(x, y, barW, barH, "rgba(66, 45, 29, 0.85)", "rgba(54,35,22,0.85)", "rgba(84,57,37,0.85)");
  ctx.strokeStyle = "#efe3cf";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, barW, barH);

  for (let i = 0; i < 5; i += 1) {
    const slotX = x + 10 + i * 70;
    const slotY = y + 10;
    const isSelected = i === gameState.selectedHotbar;
    ctx.fillStyle = isSelected ? "#ecd8b7" : "#b89269";
    ctx.fillRect(slotX, slotY, 62, 52);
    ctx.strokeStyle = isSelected ? "#fff9e8" : "#5a3f27";
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.strokeRect(slotX, slotY, 62, 52);

    const stack = getHotbarSlot(i);
    if (stack) {
      const item = items[stack.itemId];
      renderItemIcon(item, slotX + 10, slotY + 6, 34);
      ctx.fillStyle = "#1f140b";
      ctx.font = "bold 13px Arial";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(String(stack.amount), slotX + 56, slotY + 48);
    }

    ctx.fillStyle = "#2e1f12";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(String(i + 1), slotX + 31, slotY + 54);
  }
}

function drawMoneyAndHints() {
  drawDirtTexture(14, 12, 240, 68, "rgba(73, 49, 32, 0.86)", "rgba(58,37,24,0.86)", "rgba(89,61,40,0.86)");
  ctx.strokeStyle = "#f4e7cf";
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 12, 240, 68);

  ctx.fillStyle = "#fff4de";
  ctx.font = "bold 26px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`$${gameState.money}`, 26, 20);

  const selectedStack = getHotbarSlot(gameState.selectedHotbar);
  const selectedItem = getSelectedItem();
  let holdingText = "Empty";
  if (selectedItem) {
    if (selectedItem.id === "carrot" && selectedStack?.meta?.weightKg) {
      holdingText = `${selectedItem.name} (${toFixedNumber(selectedStack.meta.weightKg, 2)}kg)`;
    } else {
      holdingText = selectedItem.name;
    }
  }
  ctx.font = "13px Arial";
  ctx.fillStyle = "#ebdfc9";
  ctx.fillText(`Holding: ${holdingText}`, 26, 52);

  ctx.fillStyle = "rgba(38, 24, 14, 0.75)";
  ctx.fillRect(14, 88, 530, 46);
  ctx.fillStyle = "#f7ead5";
  ctx.font = "12px Arial";
  ctx.fillText("E plant/harvest | B inventory | Click hotbar | Wheel = switch slot | Right-click Buy for qty", 22, 94);
  ctx.fillText("Middle-click (scroll wheel button): center map — move with WASD to follow player again", 22, 110);
}

function getHotbarLayout() {
  const barW = 360;
  const barH = 72;
  const x = VIEW_WIDTH / 2 - barW / 2;
  const y = VIEW_HEIGHT - barH - 16;
  return { x, y, barW, barH };
}

function pickHotbarSlotFromPoint(mouseX, mouseY) {
  const { x, y } = getHotbarLayout();
  for (let i = 0; i < 5; i += 1) {
    const slotX = x + 10 + i * 70;
    const slotY = y + 10;
    if (mouseX >= slotX && mouseX <= slotX + 62 && mouseY >= slotY && mouseY <= slotY + 52) {
      return i;
    }
  }
  return -1;
}

function sanitizeInventorySlot(slot) {
  if (!slot || !items[slot.itemId]) return null;
  const itemDef = items[slot.itemId];
  const amount = Math.max(1, Math.floor(Number(slot.amount) || 1));
  if (itemDef.stackable) {
    return { itemId: slot.itemId, amount };
  }
  return {
    itemId: slot.itemId,
    amount: 1,
    meta: slot.meta ? { ...slot.meta } : null,
  };
}

function saveProgress() {
  const payload = {
    money: gameState.money,
    selectedHotbar: gameState.selectedHotbar,
    player: { x: player.x, y: player.y },
    inventory: inventory.map(sanitizeInventorySlot),
    plants: plants.map((plant) => {
      const row = {
        type: plant.type === "mint" ? "mint" : "carrot",
        x: plant.x,
        y: plant.y,
        plantedAt: plant.plantedAt,
        mature: !!plant.mature,
      };
      if (row.type === "carrot") {
        row.weightKg = plant.weightKg ?? 1.09;
      }
      return row;
    }),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (_error) {
    // Ignore storage failures silently to avoid gameplay interruption.
  }
}

function loadProgress() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (_error) {
    raw = null;
  }
  if (!raw) {
    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      try {
        raw = localStorage.getItem(legacyKey);
        if (raw) break;
      } catch (_e) {
        raw = null;
      }
    }
  }
  if (!raw) return false;

  try {
    const save = JSON.parse(raw);
    if (Number.isFinite(save.money)) {
      gameState.money = Math.max(0, Math.floor(save.money));
    }
    if (Number.isFinite(save.selectedHotbar)) {
      gameState.selectedHotbar = clamp(Math.floor(save.selectedHotbar), 0, 4);
    }
    if (save.player && Number.isFinite(save.player.x) && Number.isFinite(save.player.y)) {
      player.x = clamp(save.player.x, player.radius, world.width - player.radius);
      player.y = clamp(save.player.y, player.radius, world.height - player.radius);
    }

    if (Array.isArray(save.inventory)) {
      for (let i = 0; i < inventory.length; i += 1) {
        inventory[i] = sanitizeInventorySlot(save.inventory[i] ?? null);
      }
    }

    if (Array.isArray(save.plants)) {
      plants.length = 0;
      for (const p of save.plants) {
        if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y) || !Number.isFinite(p?.plantedAt)) continue;
        if (!isDirtArea(p.x, p.y)) continue;
        const plantType = p.type === "mint" ? "mint" : "carrot";
        const base = {
          type: plantType,
          x: clamp(p.x, 24, DIRT_RIGHT - 24),
          y: clamp(p.y, 110, world.height - 24),
          plantedAt: p.plantedAt,
          mature: !!p.mature,
        };
        if (plantType === "carrot") {
          base.weightKg = clamp(Number(p.weightKg) || 1.09, 0.3, 2.3);
        }
        plants.push(base);
      }
    }
    try {
      saveProgress();
      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        localStorage.removeItem(legacyKey);
      }
    } catch (_e) {
      // Still keep in-memory progress even if migrate write fails.
    }
    return true;
  } catch (_error) {
    return false;
  }
}

function drawInventoryOverlay() {
  if (!gameState.inventoryOpen) return;

  ctx.fillStyle = "rgba(0, 0, 0, 0.56)";
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  const panelW = 520;
  const panelH = 540;
  const panelX = VIEW_WIDTH / 2 - panelW / 2;
  const panelY = VIEW_HEIGHT / 2 - panelH / 2;
  drawDirtTexture(panelX, panelY, panelW, panelH, "#795635", "#67472b", "#89623d");
  ctx.strokeStyle = "#f1e4cd";
  ctx.lineWidth = 3;
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  ctx.fillStyle = "#f9efd9";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Inventory (100 Slots)", panelX + 18, panelY + 14);
  ctx.font = "15px Arial";
  ctx.fillText("Press B to close", panelX + panelW - 130, panelY + 18);

  const cols = 10;
  const rows = 10;
  const slotSize = 44;
  const gap = 4;
  const gridX = panelX + 20;
  const gridY = panelY + 60;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const idx = row * cols + col;
      const x = gridX + col * (slotSize + gap);
      const y = gridY + row * (slotSize + gap);
      const hotbarSlot = idx < 5;
      ctx.fillStyle = hotbarSlot ? "#d2b089" : "#ba956c";
      ctx.fillRect(x, y, slotSize, slotSize);
      ctx.strokeStyle = hotbarSlot ? "#fff0d8" : "#5a3c22";
      ctx.lineWidth = hotbarSlot ? 2.6 : 1.8;
      ctx.strokeRect(x, y, slotSize, slotSize);

      const stack = inventory[idx];
      if (stack) {
        renderItemIcon(items[stack.itemId], x + 8, y + 7, 28);
        ctx.fillStyle = "#2d1b0e";
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(String(stack.amount), x + slotSize - 8, y + slotSize - 6);
      }
    }
  }
}

function drawMessage() {
  if (now() > gameState.messageUntil) return;
  const w = 460;
  const h = 46;
  const x = VIEW_WIDTH / 2 - w / 2;
  const y = 16;
  ctx.fillStyle = "rgba(33, 21, 12, 0.86)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#f2dfc2";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#f8ecd9";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(gameState.message, x + w / 2, y + h / 2);
}

function appendBuyProductRow(itemId, label) {
  const item = items[itemId];
  const buyBtn = document.createElement("button");
  buyBtn.type = "button";
  buyBtn.textContent = label;
  menuActions.appendChild(buyBtn);

  const qtyWrap = document.createElement("div");
  qtyWrap.className = "qty-wrap";
  qtyWrap.style.display = "none";

  const minusBtn = document.createElement("button");
  minusBtn.type = "button";
  minusBtn.textContent = "-";
  minusBtn.className = "qty-btn";

  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.min = "1";
  qtyInput.step = "1";
  qtyInput.value = "1";
  qtyInput.className = "qty-input";

  const plusBtn = document.createElement("button");
  plusBtn.type = "button";
  plusBtn.textContent = "+";
  plusBtn.className = "qty-btn";

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.textContent = "All";
  allBtn.className = "qty-btn";

  const buyQtyBtn = document.createElement("button");
  buyQtyBtn.type = "button";
  buyQtyBtn.textContent = "Buy";
  buyQtyBtn.className = "qty-buy-btn";

  const sanitizeQty = (fallback = 1) => {
    const max = Math.max(1, getMaxBuyableCount(itemId));
    const parsed = Math.floor(Number(qtyInput.value));
    const rawVal = Number.isFinite(parsed) ? parsed : fallback;
    const safe = clamp(rawVal, 1, max);
    qtyInput.value = String(safe);
    return safe;
  };

  const buyAmount = (amount) => {
    const maxBuy = getMaxBuyableCount(itemId);
    if (maxBuy <= 0) {
      showMessage("Not enough money.");
      return;
    }
    const qty = clamp(Math.floor(amount), 1, maxBuy);
    if (!addItem(itemId, qty)) {
      showMessage("Inventory is full.");
      return;
    }
    gameState.money -= qty * item.price;
    saveProgress();
    showMessage(`Bought ${qty} × ${item.name}.`);
    sanitizeQty();
  };

  buyBtn.addEventListener("click", () => {
    buyAmount(1);
  });

  buyBtn.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    qtyWrap.style.display = "flex";
    sanitizeQty();
    showMessage(`Quantity for ${item.name}: type, +/-, or All.`);
  });

  minusBtn.addEventListener("click", () => {
    qtyInput.value = String(Math.max(1, (Math.floor(Number(qtyInput.value) || 1) - 1)));
    sanitizeQty();
  });

  plusBtn.addEventListener("click", () => {
    qtyInput.value = String(Math.floor(Number(qtyInput.value) || 1) + 1);
    sanitizeQty();
  });

  qtyInput.addEventListener("focus", () => {
    qtyInput.select();
  });

  qtyInput.addEventListener("input", () => {
    const cleaned = qtyInput.value.replace(/[^\d]/g, "");
    qtyInput.value = cleaned;
  });

  qtyInput.addEventListener("blur", () => {
    sanitizeQty();
  });

  allBtn.addEventListener("click", () => {
    const maxBuy = getMaxBuyableCount(itemId);
    if (maxBuy <= 0) {
      showMessage("Not enough money.");
      return;
    }
    qtyInput.value = String(maxBuy);
    buyAmount(maxBuy);
  });

  buyQtyBtn.addEventListener("click", () => {
    buyAmount(sanitizeQty());
  });

  qtyWrap.append(minusBtn, qtyInput, plusBtn, allBtn, buyQtyBtn);
  menuActions.appendChild(qtyWrap);
}

function setMenu(stand) {
  gameState.openMenuType = stand.type;
  menuTitle.textContent = stand.menuTitle;
  menuDesc.textContent = stand.menuDesc;
  menuActions.innerHTML = "";

  if (stand.type === "buy") {
    appendBuyProductRow("carrotSeed", `Buy Carrot Seed ($${items.carrotSeed.price})`);
    appendBuyProductRow("mintSeed", `Buy Mint Seed ($${items.mintSeed.price})`);
  }

  if (stand.type === "sell") {
    const sellAllBtn = document.createElement("button");
    sellAllBtn.type = "button";
    sellAllBtn.textContent = "No.1 Sell all inventory";
    sellAllBtn.addEventListener("click", () => {
      let total = 0;
      let soldCount = 0;
      for (let i = 0; i < inventory.length; i += 1) {
        const slot = inventory[i];
        if (!slot) continue;
        const value = getSlotSellValue(slot);
        if (value <= 0) continue;
        total += value;
        soldCount += Math.max(1, Number(slot.amount) || 1);
        inventory[i] = null;
      }
      if (total <= 0) {
        showMessage("No sellable items in inventory.");
        return;
      }
      gameState.money += total;
      saveProgress();
      showMessage(`Sold ${soldCount} item(s) for $${total}.`);
    });
    menuActions.appendChild(sellAllBtn);

    const sellHoldingBtn = document.createElement("button");
    sellHoldingBtn.type = "button";
    sellHoldingBtn.textContent = "No.2 Sell holding";
    sellHoldingBtn.addEventListener("click", () => {
      const slotIdx = gameState.selectedHotbar;
      const holding = inventory[slotIdx];
      if (!holding) {
        showMessage("You are not holding any item.");
        return;
      }
      const value = getSlotSellValue(holding);
      if (value <= 0) {
        showMessage("This item cannot be sold.");
        return;
      }
      gameState.money += value;
      inventory[slotIdx] = null;
      saveProgress();
      showMessage(`Sold holding item for $${value}.`);
    });
    menuActions.appendChild(sellHoldingBtn);

    const priceBtn = document.createElement("button");
    priceBtn.type = "button";
    priceBtn.textContent = "No.3 What is the price of this";
    priceBtn.addEventListener("click", () => {
      const holding = inventory[gameState.selectedHotbar];
      if (!holding) {
        showMessage("You are holding nothing.");
        return;
      }
      const value = getSlotSellValue(holding);
      if (value <= 0) {
        showMessage("This item has no sell price.");
        return;
      }
      if (holding.itemId === "carrot") {
        const weightKg = clamp(Number(holding.meta?.weightKg) || 1.09, 0.3, 2.3);
        showMessage(`Holding carrot ${toFixedNumber(weightKg, 2)}kg -> $${value}.`);
        return;
      }
      if (holding.itemId === "mint") {
        showMessage(`Holding mint -> $${value} (stack ${holding.amount}).`);
        return;
      }
      showMessage(`Holding value: $${value}.`);
    });
    menuActions.appendChild(priceBtn);
  }

  menuOverlay.classList.remove("hidden");
}

function closeMenu() {
  menuOverlay.classList.add("hidden");
  gameState.openMenuType = null;
}

function updateCamera() {
  if (cameraMode === "centered") {
    camera.x = clamp((world.width - VIEW_WIDTH) / 2, 0, Math.max(0, world.width - VIEW_WIDTH));
    camera.y = 0;
    return;
  }
  camera.x = player.x - VIEW_WIDTH / 2;
  camera.x = clamp(camera.x, 0, world.width - VIEW_WIDTH);
  camera.y = 0;
}

function updatePlayer() {
  if (gameState.openMenuType || gameState.inventoryOpen) return;

  let dx = 0;
  let dy = 0;
  if (keys.left) dx -= 1;
  if (keys.right) dx += 1;
  if (keys.up) dy -= 1;
  if (keys.down) dy += 1;

  if (dx !== 0 && dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
  }

  if (dx !== 0 || dy !== 0) {
    cameraMode = "follow";
  }
  player.x += dx * player.speed;
  player.y += dy * player.speed;
  player.x = clamp(player.x, player.radius, world.width - player.radius);
  player.y = clamp(player.y, player.radius, world.height - player.radius);
}

function tryOpenStandMenu() {
  if (gameState.openMenuType || gameState.inventoryOpen) return;
  for (const stand of stands) {
    if (circleIntersectsRect(player, stand)) {
      setMenu(stand);
      return;
    }
  }
}

function findNearbyPlant(maxDistance = 56) {
  let nearest = null;
  let nearestDistSq = maxDistance * maxDistance;
  for (const plant of plants) {
    const dx = plant.x - player.x;
    const dy = plant.y - player.y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= nearestDistSq) {
      nearest = plant;
      nearestDistSq = distSq;
    }
  }
  return nearest;
}

function isDirtArea(x, y) {
  return x > 16 && x < DIRT_RIGHT - 14 && y > 96 && y < world.height - 20;
}

function getPlantingPositionFromPlayer() {
  if (!isDirtArea(player.x, player.y)) return null;
  const snappedX = Math.round(player.x / PLANT_GRID) * PLANT_GRID;
  const snappedY = Math.round((player.y + player.radius * 0.45) / PLANT_GRID) * PLANT_GRID;
  const plantX = clamp(snappedX, 24, DIRT_RIGHT - 24);
  const plantY = clamp(snappedY, 110, world.height - 24);
  if (!isDirtArea(plantX, plantY)) return null;
  return { x: plantX, y: plantY };
}

function hasPlantAt(x, y) {
  return plants.some((plant) => Math.hypot(plant.x - x, plant.y - y) < 12);
}

function interactWithGround() {
  if (gameState.openMenuType || gameState.inventoryOpen) return;

  const nearbyPlant = findNearbyPlant();
  if (nearbyPlant && nearbyPlant.mature) {
    if (nearbyPlant.type === "mint") {
      if (!addItem("mint", 1)) {
        showMessage("Inventory full. Cannot harvest.");
        return;
      }
      const plantIndex = plants.indexOf(nearbyPlant);
      if (plantIndex !== -1) plants.splice(plantIndex, 1);
      saveProgress();
      showMessage("Harvested mint.");
      return;
    }
    const harvestWeight = clamp(Number(nearbyPlant.weightKg) || 1.09, 0.3, 2.3);
    if (!addItem("carrot", 1, { weightKg: harvestWeight })) {
      showMessage("Inventory full. Cannot harvest.");
      return;
    }
    const plantIndex = plants.indexOf(nearbyPlant);
    if (plantIndex !== -1) plants.splice(plantIndex, 1);
    saveProgress();
    showMessage(`Harvested carrot: ${toFixedNumber(harvestWeight, 2)}kg.`);
    return;
  }

  if (nearbyPlant && !nearbyPlant.mature) {
    showMessage("Still growing...");
    return;
  }

  const plantPos = getPlantingPositionFromPlayer();
  if (!plantPos) {
    showMessage("You can only plant on dirt.");
    return;
  }

  if (hasPlantAt(plantPos.x, plantPos.y)) {
    showMessage("This spot is already occupied.");
    return;
  }

  const selectedStack = getHotbarSlot(gameState.selectedHotbar);
  if (!selectedStack) {
    showMessage("Hold a seed in hotbar to plant.");
    return;
  }
  if (selectedStack.itemId === "carrotSeed") {
    removeItem("carrotSeed", 1);
    plants.push({
      type: "carrot",
      x: plantPos.x,
      y: plantPos.y,
      plantedAt: now(),
      mature: false,
      weightKg: rollCarrotWeight(),
    });
    saveProgress();
    showMessage("Planted carrot seed.");
    return;
  }
  if (selectedStack.itemId === "mintSeed") {
    removeItem("mintSeed", 1);
    plants.push({
      type: "mint",
      x: plantPos.x,
      y: plantPos.y,
      plantedAt: now(),
      mature: false,
    });
    saveProgress();
    showMessage("Planted mint seed.");
    return;
  }
  showMessage("Hold carrot or mint seed in hotbar to plant.");
}

function drawScene() {
  updateCamera();
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawGardenBackground();
  drawPlants();
  stands.forEach(drawStand);
  drawPlayer();
  ctx.restore();
  drawHotbar();
  drawMoneyAndHints();
  drawMessage();
  drawInventoryOverlay();
}

function gameLoop() {
  updatePlayer();
  tryOpenStandMenu();
  drawScene();
  if (now() - lastAutoSaveAt > 3000) {
    saveProgress();
    lastAutoSaveAt = now();
  }
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "arrowup" || key === "w") keys.up = true;
  if (key === "arrowdown" || key === "s") keys.down = true;
  if (key === "arrowleft" || key === "a") keys.left = true;
  if (key === "arrowright" || key === "d") keys.right = true;

  if (key === "escape") closeMenu();
  if (key === "b") {
    if (!gameState.openMenuType) {
      gameState.inventoryOpen = !gameState.inventoryOpen;
      saveProgress();
    }
  }
  if (key === "e") {
    if (gameState.openMenuType) return;
    interactWithGround();
  }
  if (["1", "2", "3", "4", "5"].includes(key)) {
    gameState.selectedHotbar = Number(key) - 1;
    saveProgress();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key === "arrowup" || key === "w") keys.up = false;
  if (key === "arrowdown" || key === "s") keys.down = false;
  if (key === "arrowleft" || key === "a") keys.left = false;
  if (key === "arrowright" || key === "d") keys.right = false;
});

window.addEventListener("wheel", (event) => {
  event.preventDefault();
  if (gameState.openMenuType || gameState.inventoryOpen) return;
  const dir = Math.sign(event.deltaY);
  if (dir > 0) gameState.selectedHotbar = (gameState.selectedHotbar + 1) % 5;
  if (dir < 0) gameState.selectedHotbar = (gameState.selectedHotbar + 4) % 5;
  saveProgress();
}, { passive: false });

function centerMapCamera() {
  cameraMode = "centered";
}

canvas.addEventListener("mousedown", (event) => {
  if (event.button === 1) {
    event.preventDefault();
    centerMapCamera();
    return;
  }
  if (event.button !== 0) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = VIEW_WIDTH / rect.width;
  const scaleY = VIEW_HEIGHT / rect.height;
  const mouseX = (event.clientX - rect.left) * scaleX;
  const mouseY = (event.clientY - rect.top) * scaleY;
  const slot = pickHotbarSlotFromPoint(mouseX, mouseY);
  if (slot !== -1) {
    gameState.selectedHotbar = slot;
    saveProgress();
  }
});

canvas.addEventListener("auxclick", (event) => {
  if (event.button === 1) {
    event.preventDefault();
    centerMapCamera();
  }
});

closeMenuBtn.addEventListener("click", closeMenu);
menuOverlay.addEventListener("click", (event) => {
  if (event.target === menuOverlay) closeMenu();
});

const hasLoadedSave = loadProgress();
if (!hasLoadedSave) {
  saveProgress();
}
drawScene();

let bootSequenceStarted = false;

function beginPlaySession() {
  if (bootSequenceStarted) return;
  bootSequenceStarted = true;
  const bootGate = document.getElementById("bootGate");
  const loadingScreen = document.getElementById("loadingScreen");
  if (bootGate) {
    bootGate.classList.add("hidden");
    bootGate.setAttribute("aria-hidden", "true");
  }
  if (loadingScreen) {
    loadingScreen.classList.remove("hidden");
    loadingScreen.setAttribute("aria-hidden", "false");
  }
  window.setTimeout(() => {
    if (loadingScreen) {
      loadingScreen.classList.add("hidden");
      loadingScreen.setAttribute("aria-hidden", "true");
    }
    if (hasLoadedSave) {
      showMessage("Save loaded.");
    } else {
      showMessage("Start with $20. Buy seeds and grow carrots!");
    }
    drawScene();
    gameLoop();
  }, 1000);
}

const bootGateEl = document.getElementById("bootGate");
if (bootGateEl) {
  bootGateEl.addEventListener("click", beginPlaySession);
  bootGateEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      beginPlaySession();
    }
  });
}

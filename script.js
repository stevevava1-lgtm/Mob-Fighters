const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// --------- Save / Economy ----------
const SAVE_KEY = "bossFightingSave_v1";
const isTriggerOn = (id) => (typeof window.getTrigger === "function" ? window.getTrigger(id) : true);
const MODS_KEY = "bossFightingMods_v1";
const LOCAL_EVENT_TRIGGERS_KEY = "bossFightingLocalEventTriggers_v1";
const LOCAL_EVENT_TRIGGER_DEFAULTS = Object.freeze({
  LIMITED_RELEASE_CRATE_TRIGGER: false,
});
const loadLocalEventTriggers = () => {
  try {
    const raw = localStorage.getItem(LOCAL_EVENT_TRIGGERS_KEY);
    if (!raw) return { ...LOCAL_EVENT_TRIGGER_DEFAULTS };
    const parsed = JSON.parse(raw);
    const out = { ...LOCAL_EVENT_TRIGGER_DEFAULTS };
    if (parsed && typeof parsed === "object") {
      for (const k of Object.keys(LOCAL_EVENT_TRIGGER_DEFAULTS)) {
        if (Object.prototype.hasOwnProperty.call(parsed, k)) out[k] = !!parsed[k];
      }
    }
    return out;
  } catch {
    return { ...LOCAL_EVENT_TRIGGER_DEFAULTS };
  }
};
const saveLocalEventTriggers = (state) => {
  try {
    localStorage.setItem(LOCAL_EVENT_TRIGGERS_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
};
const getLocalEventTrigger = (id) => {
  const s = loadLocalEventTriggers();
  return !!s[id];
};
const setLocalEventTrigger = (id, enabled) => {
  if (!Object.prototype.hasOwnProperty.call(LOCAL_EVENT_TRIGGER_DEFAULTS, id)) return;
  const s = loadLocalEventTriggers();
  s[id] = !!enabled;
  saveLocalEventTriggers(s);
  window.dispatchEvent(new CustomEvent("triggers:changed", { detail: { id, enabled: !!enabled, local: true } }));
};
const allLocalEventTriggers = () => {
  const s = loadLocalEventTriggers();
  return Object.keys(LOCAL_EVENT_TRIGGER_DEFAULTS).sort().map((id) => ({ id, enabled: !!s[id] }));
};
const loadMods = () => {
  try {
    const raw = localStorage.getItem(MODS_KEY);
    if (!raw) return { powerToolMod: false };
    const parsed = JSON.parse(raw);
    return { powerToolMod: !!parsed?.powerToolMod };
  } catch {
    return { powerToolMod: false };
  }
};
const saveMods = (m) => {
  try {
    localStorage.setItem(MODS_KEY, JSON.stringify(m));
  } catch {
    // ignore
  }
};
const LAST_DELETED_PROGRESS_KEY = "bossFightingLastDeletedProgress_v1";

const generateResetVerification = () => {
  const U = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const L = "abcdefghijklmnopqrstuvwxyz";
  const D = "0123456789";
  let s = "";
  for (let i = 0; i < 3; i++) s += U[(Math.random() * U.length) | 0];
  for (let i = 0; i < 2; i++) s += L[(Math.random() * L.length) | 0];
  for (let i = 0; i < 3; i++) s += D[(Math.random() * D.length) | 0];
  return s;
};

const backupCurrentSaveForRecovery = (reason) => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const payload = {
      reason: reason || "manual-reset",
      savedAt: Date.now(),
      rawSave: raw,
    };
    localStorage.setItem(LAST_DELETED_PROGRESS_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
};

const restoreLastDeletedProgress = () => {
  try {
    const raw = localStorage.getItem(LAST_DELETED_PROGRESS_KEY);
    if (!raw) return { ok: false, reason: "none" };
    const payload = JSON.parse(raw);
    if (!payload?.rawSave) return { ok: false, reason: "bad" };
    localStorage.setItem(SAVE_KEY, payload.rawSave);
    return { ok: true, savedAt: payload.savedAt ?? null, reason: payload.reason ?? "unknown" };
  } catch {
    return { ok: false, reason: "error" };
  }
};

// Powers (unlocked by trigger ".js")
let showHitboxes = false;
let fightMoneyMult = 1;
let goldenEnemy = false;
let rightMouseDown = false;
let powerCloneBeams = []; // {x,y,dir:{x,y},leftMs:number}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw)
      return {
        money: 0,
        magicoin: 0,
        armor: {
          ownedSet: false,
          equipped: { helmet: false, chest: false, legs: false, boots: false }, // legacy releasite toggles
        },
        inventory: { counts: {} }, // itemId -> count (unequipped)
        equipped: { helmet: null, chest: null, legs: null, boots: null, weapon1: null, weapon2: null },
        redeems: { usedCodes: {} }, // code -> true (one-time codes)
        stats: {
          rogueKills: 0,
          singleWins: 0,
          hordeWins: 0,
          technoWins: 0,
          skeletonWins: 0,
          zombieWins: 0,
          zombieDogKills: 0,
          totalEnemiesKilled: 0,
          totalMoneyEarned: 0,
          totalWins: 0,
          basicCratesOpened: 0,
          releaseCratesOpened: 0,
        },
        forever: { stage: 0, lastRandomId: null, currentTask: null, readyToClaim: false },
        compensation: { progressBugClaimed: false },
        settings: { mobileMode: false },
        crafting: { upgrades: { armorSlot: null, weaponSlot: null }, matchState: { goldenAppleUsed: false, goldenDrinkUsesLeft: 3 } },
      };
    const parsed = JSON.parse(raw);
    const craftingFromSave = (() => {
      const c = parsed?.crafting;
      if (!c || typeof c !== "object") return { upgrades: { armorSlot: null, weaponSlot: null }, matchState: { goldenAppleUsed: false, goldenDrinkUsesLeft: 3 } };
      const u = c.upgrades && typeof c.upgrades === "object" ? c.upgrades : {};
      const m = c.matchState && typeof c.matchState === "object" ? c.matchState : {};
      return {
        upgrades: {
          armorSlot: typeof u.armorSlot === "string" ? u.armorSlot : null,
          weaponSlot: typeof u.weaponSlot === "string" ? u.weaponSlot : null,
        },
        matchState: {
          goldenAppleUsed: !!m.goldenAppleUsed,
          goldenDrinkUsesLeft: typeof m.goldenDrinkUsesLeft === "number" ? m.goldenDrinkUsesLeft : 3,
        },
      };
    })();
    return {
      money: typeof parsed.money === "number" ? parsed.money : 0,
      magicoin: typeof parsed.magicoin === "number" ? parsed.magicoin : 0,
      armor: {
        ownedSet: !!parsed?.armor?.ownedSet,
        equipped: {
          helmet: !!parsed?.armor?.equipped?.helmet,
          chest: !!parsed?.armor?.equipped?.chest,
          legs: !!parsed?.armor?.equipped?.legs,
          boots: !!parsed?.armor?.equipped?.boots,
        },
      },
      inventory: {
        // migrate legacy array to counts
        counts: (() => {
          if (parsed?.inventory?.counts && typeof parsed.inventory.counts === "object") return parsed.inventory.counts;
          const counts = {};
          const items = Array.isArray(parsed?.inventory?.items) ? parsed.inventory.items.filter((x) => typeof x === "string") : [];
          for (const id of items) counts[id] = (counts[id] || 0) + 1;
          return counts;
        })(),
      },
      equipped: {
        helmet: typeof parsed?.equipped?.helmet === "string" ? parsed.equipped.helmet : null,
        chest: typeof parsed?.equipped?.chest === "string" ? parsed.equipped.chest : null,
        legs: typeof parsed?.equipped?.legs === "string" ? parsed.equipped.legs : null,
        boots: typeof parsed?.equipped?.boots === "string" ? parsed.equipped.boots : null,
        weapon1: typeof parsed?.equipped?.weapon1 === "string" ? parsed.equipped.weapon1 : null,
        weapon2: typeof parsed?.equipped?.weapon2 === "string" ? parsed.equipped.weapon2 : null,
      },
      redeems: {
        usedCodes: parsed?.redeems?.usedCodes && typeof parsed.redeems.usedCodes === "object" ? parsed.redeems.usedCodes : {},
      },
      stats: {
        rogueKills: Number(parsed?.stats?.rogueKills || 0),
        singleWins: Number(parsed?.stats?.singleWins || 0),
        hordeWins: Number(parsed?.stats?.hordeWins || 0),
        technoWins: Number(parsed?.stats?.technoWins || 0),
        skeletonWins: Number(parsed?.stats?.skeletonWins || 0),
        zombieWins: Number(parsed?.stats?.zombieWins || 0),
        zombieDogKills: Number(parsed?.stats?.zombieDogKills || 0),
        totalEnemiesKilled: Number(parsed?.stats?.totalEnemiesKilled || 0),
        totalMoneyEarned: Number(parsed?.stats?.totalMoneyEarned || 0),
        totalWins: Number(parsed?.stats?.totalWins || 0),
        basicCratesOpened: Number(parsed?.stats?.basicCratesOpened || 0),
        releaseCratesOpened: Number(parsed?.stats?.releaseCratesOpened || 0),
        bossCrates: Number(parsed?.stats?.bossCrates || 0),
      },
      forever: {
        stage: Number(parsed?.forever?.stage || 0),
        lastRandomId: parsed?.forever?.lastRandomId ?? null,
        currentTask: parsed?.forever?.currentTask ?? null,
        readyToClaim: !!parsed?.forever?.readyToClaim,
      },
      compensation: {
        progressBugClaimed: !!parsed?.compensation?.progressBugClaimed,
      },
      settings: {
        mobileMode: !!parsed?.settings?.mobileMode,
      },
      crafting: craftingFromSave,
    };
  } catch {
    return {
      money: 0,
      magicoin: 0,
      armor: { ownedSet: false, equipped: { helmet: false, chest: false, legs: false, boots: false } },
      inventory: { counts: {} },
      equipped: { helmet: null, chest: null, legs: null, boots: null, weapon1: null, weapon2: null },
      redeems: { usedCodes: {} },
      stats: {
        rogueKills: 0,
        singleWins: 0,
        hordeWins: 0,
        technoWins: 0,
        skeletonWins: 0,
        zombieWins: 0,
        zombieDogKills: 0,
        totalEnemiesKilled: 0,
        totalMoneyEarned: 0,
        totalWins: 0,
        basicCratesOpened: 0,
        releaseCratesOpened: 0,
        bossCrates: 0,
      },
      forever: { stage: 0, lastRandomId: null, currentTask: null, readyToClaim: false },
      compensation: { progressBugClaimed: false },
      settings: { mobileMode: false },
      crafting: { upgrades: { armorSlot: null, weaponSlot: null }, matchState: { goldenAppleUsed: false, goldenDrinkUsesLeft: 3 } },
    };
  }
}

function saveGame(state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function addLifetimeMoneyEarned(save, amount) {
  const n = Number(amount) || 0;
  if (n <= 0) return;
  if (!save.stats) save.stats = {};
  save.stats.totalMoneyEarned = Number(save.stats.totalMoneyEarned || 0) + n;
}

/** Call after toggling save.settings.mobileMode so the fight overlay can refresh. */
const mobileModeSubscribers = new Set();
function subscribeMobileMode(fn) {
  mobileModeSubscribers.add(fn);
  return () => mobileModeSubscribers.delete(fn);
}
function notifyMobileModeChanged() {
  for (const fn of mobileModeSubscribers) {
    try {
      fn();
    } catch (_) {
      /* ignore */
    }
  }
}

// --------- Items ----------
const ITEMS = {
  // Weapons
  wooden_sword: { id: "wooden_sword", name: "Wooden Sword", type: "weapon", dmg: 2, rangeMult: 1.0, moveMult: 1.0, hp: 0, tint: "wood" },
  wooden_longsword: {
    id: "wooden_longsword",
    name: "Wooden Longsword",
    type: "weapon",
    dmg: 3,
    rangeMult: 1.7,
    moveMult: 1.0,
    hp: 0,
    tint: "woodLong",
  },
  forgotten_wood_sword: {
    id: "forgotten_wood_sword",
    name: "Forgotten Wood Sword",
    type: "weapon",
    dmg: 10,
    rangeMult: 1.7,
    moveMult: 1.0,
    hp: 0,
    tint: "purpleWood",
  },
  releasite_sword: {
    id: "releasite_sword",
    name: "Releasite Sword",
    type: "weapon",
    dmg: 5,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 0,
    tint: "releasiteWeapon",
  },
  releasite_longsword: {
    id: "releasite_longsword",
    name: "Releasite Longsword",
    type: "weapon",
    dmg: 8,
    rangeMult: 1.7,
    moveMult: 1.0,
    hp: 0,
    tint: "releasiteWeaponLong",
  },

  // Leather armor
  leather_boots: { id: "leather_boots", name: "Leather Boots", type: "boots", dmg: 0, rangeMult: 1.0, moveMult: 1.0, hp: 1, tint: "leather" },
  leather_helmet: {
    id: "leather_helmet",
    name: "Leather Helmet",
    type: "helmet",
    dmg: 0,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 1,
    tint: "leather",
  },
  leather_leggings: {
    id: "leather_leggings",
    name: "Leather Leggings",
    type: "legs",
    dmg: 0,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 2,
    tint: "leather",
  },
  leather_chestplate: {
    id: "leather_chestplate",
    name: "Leather Chestplate",
    type: "chest",
    dmg: 0,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 3,
    tint: "leather",
  },
  leather_wraith_armor: {
    id: "leather_wraith_armor",
    name: "Leather Wraith Armor",
    type: "chest",
    dmg: 0,
    rangeMult: 1.0,
    moveMult: 1.3,
    hp: 5,
    tint: "wraith",
  },

  // Releasite armor (bought as a set)
  releasite_helmet: { id: "releasite_helmet", name: "Releasite Helmet", type: "helmet", dmg: 0, rangeMult: 1.0, moveMult: 1.0, hp: 5, tint: "releasite" },
  releasite_chestplate: { id: "releasite_chestplate", name: "Releasite Chestplate", type: "chest", dmg: 0, rangeMult: 1.0, moveMult: 1.0, hp: 10, tint: "releasite" },
  releasite_leggings: { id: "releasite_leggings", name: "Releasite Leggings", type: "legs", dmg: 0, rangeMult: 1.0, moveMult: 1.0, hp: 7, tint: "releasite" },
  releasite_boots: { id: "releasite_boots", name: "Releasite Boots", type: "boots", dmg: 0, rangeMult: 1.0, moveMult: 1.0, hp: 4, tint: "releasite" },
  releasite_wraith_armor: {
    id: "releasite_wraith_armor",
    name: "Releasite Wraith Armor",
    type: "chest",
    dmg: 0,
    rangeMult: 1.0,
    moveMult: 2.0,
    hp: 10,
    tint: "releasiteWraith",
  },

  // Undead crate
  bone_sword: {
    id: "bone_sword",
    name: "Bone Sword",
    type: "weapon",
    dmg: 7,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 0,
    tint: "boneWeapon",
  },
  bone_boots: { id: "bone_boots", name: "Bone Boots", type: "boots", dmg: 0, rangeMult: 1.0, moveMult: 1.0, hp: 5, tint: "bone" },
  bone_helmet: { id: "bone_helmet", name: "Bone Helmet", type: "helmet", dmg: 0, rangeMult: 1.0, moveMult: 1.0, hp: 6, tint: "bone" },
  bone_leggings: { id: "bone_leggings", name: "Bone Leggings", type: "legs", dmg: 0, rangeMult: 1.0, moveMult: 1.0, hp: 8, tint: "bone" },
  bone_chestplate: { id: "bone_chestplate", name: "Bone Chestplate", type: "chest", dmg: 0, rangeMult: 1.0, moveMult: 1.0, hp: 11, tint: "bone" },
  undead_blade: {
    id: "undead_blade",
    name: "Undead Blade",
    type: "weapon",
    dmg: 13,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 0,
    tint: "undeadBlade",
  },
  bone_bow: {
    id: "bone_bow",
    name: "Bow",
    type: "weapon",
    dmg: 0,
    bow: true,
    bowDmg: 10,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 0,
    tint: "boneBow",
  },
  phantom_sniper: {
    id: "phantom_sniper",
    name: "Phantom Sniper",
    type: "weapon",
    dmg: 0,
    phantomSniper: true,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 0,
    tint: "phantomSniper",
  },
  boss_blade: { id: "boss_blade", name: "Boss Blade", type: "weapon", dmg: 15, rangeMult: 1.0, moveMult: 1.0, hp: 0, tint: "bossWeapon" },
  boss_boots: { id: "boss_boots", name: "Boss Boots", type: "boots", dmg: 0, rangeMult: 1.0, moveMult: 1.0, hp: 5, tint: "bossArmor" },
  boss_helmet: { id: "boss_helmet", name: "Boss Helmet", type: "helmet", dmg: 0, rangeMult: 1.0, moveMult: 1.0, hp: 6, tint: "bossArmor" },
  boss_leggings: { id: "boss_leggings", name: "Boss Leggings", type: "legs", dmg: 0, rangeMult: 1.0, moveMult: 1.0, hp: 10, tint: "bossArmor" },
  boss_chestplate: {
    id: "boss_chestplate",
    name: "Boss Chestplate",
    type: "chest",
    dmg: 0,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 12,
    dashMult: 1.2,
    tint: "bossArmor",
  },
  laser_blast: { id: "laser_blast", name: "Laser Blast", type: "weapon", dmg: 0, laserBlast: true, rangeMult: 1.0, moveMult: 1.0, hp: 0, tint: "bossWeapon" },
  gattling: { id: "gattling", name: "Gattling", type: "weapon", dmg: 0, gattling: true, rangeMult: 1.0, moveMult: 1.0, hp: 0, tint: "bossWeapon" },
  rpg: { id: "rpg", name: "RPG", type: "weapon", dmg: 0, rpg: true, rangeMult: 1.0, moveMult: 1.0, hp: 0, tint: "bossWeapon" },
  // Power Tool crate (mod)
  laser_blaster: {
    id: "laser_blaster",
    name: "Laser Blaster",
    type: "weapon",
    dmg: 0,
    laserBlaster: true,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 0,
    tint: "bossWeapon",
  },
  chainsaw: {
    id: "chainsaw",
    name: "Chainsaw",
    type: "weapon",
    dmg: 0,
    chainsaw: true,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 0,
    tint: "bossWeapon",
  },
  health_battery: {
    id: "health_battery",
    name: "Health Battery",
    type: "weapon",
    dmg: 0,
    healthBattery: true,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 0,
    tint: "bossWeapon",
  },
  golden_apple: {
    id: "golden_apple",
    name: "Golden Apple",
    type: "weapon",
    dmg: 0,
    goldenApple: true,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 0,
    tint: "bossWeapon",
  },
  golden_drink: {
    id: "golden_drink",
    name: "Golden_Drink",
    type: "weapon",
    dmg: 0,
    goldenDrink: true,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 0,
    tint: "bossWeapon",
  },
  techno_blade: {
    id: "techno_blade",
    name: "Techno_blade",
    type: "weapon",
    dmg: 17,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 0,
    tint: "bossWeapon",
  },
  technoblade: {
    id: "technoblade",
    name: "Technoblade",
    type: "weapon",
    dmg: 20,
    technoBlade: true,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 0,
    tint: "bossWeapon",
  },
  shadow_blade: {
    id: "shadow_blade",
    name: "Shadow Blade",
    type: "weapon",
    dmg: 18,
    shadowBlade: true,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 0,
    tint: "bossWeapon",
  },
  dash_boots: {
    id: "dash_boots",
    name: "Dash Boots",
    type: "boots",
    dmg: 0,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 4,
    dashMult: 1.5,
    tint: "bossArmor",
  },
  armor_speeder: {
    id: "armor_speeder",
    name: "Armor Speeder",
    type: "material",
    dmg: 0,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 0,
    tint: "bossArmor",
  },
  weapon_buffer: {
    id: "weapon_buffer",
    name: "Weapon Buffer",
    type: "material",
    dmg: 0,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 0,
    tint: "bossWeapon",
  },
  undead_wraith_chestplate: {
    id: "undead_wraith_chestplate",
    name: "Undead Wraith Chestplate",
    type: "chest",
    dmg: 0,
    rangeMult: 1.0,
    moveMult: 2.0,
    hp: 10,
    tint: "undeadWraith",
  },
  demonic_bow: {
    id: "demonic_bow",
    name: "Demonic Bow",
    type: "weapon",
    dmg: 0,
    bow: true,
    bowDmg: 30,
    rangeMult: 1.0,
    moveMult: 1.0,
    hp: 0,
    tint: "demonicBow",
  },
};

function getItemDetailText(it) {
  if (!it) return "";
  if (it.rpg) return "RPG: rocket (80 direct / 30 blast), enemies try to dodge";
  if (it.gattling) return "Gattling: 10-shot burst, 7 dmg/shot, 1.0s cooldown";
  if (it.laserBlast) return "Laser Blast: red beam shot, 5 dmg, 3.0s cooldown";
  if (it.laserBlaster) return "Laser Blaster: long-press → 4s beam (11 dmg/s), then 2s reload";
  if (it.chainsaw) return "Chainsaw: long-press → 4s (close) (20 dmg/s), then 2s reload";
  if (it.healthBattery) return "Health Battery: one-use, heals 20% max HP (click to use)";
  if (it.goldenApple) return "Golden Apple: heals 20 HP, once per match (reusable next match)";
  if (it.goldenDrink) return "Golden Drink: heals 12 HP, up to 3 uses per match (reusable next match)";
  if (it.technoBlade) return "Technoblade: +20 DMG, long-press → 1s laser beam";
  if (it.shadowBlade) return "Shadow Blade: +18 DMG, hit applies stackable chip DOT (up to stage 3)";
  if (it.id === "armor_speeder")
    return "Armor Speeder: use Crafting to bind to one armor slot (+20% movement speed, +20% dash distance)";
  if (it.id === "weapon_buffer") return "Weapon Buffer: use Crafting to bind to one weapon slot (+20% reach)";
  if (it.phantomSniper) return "Sniper: long-press on foe → 70 dmg round; slide hits = AoE all";
  if (it.bow) return `Bow: ${it.bowDmg} dmg/arrow (auto-aim)`;
  if (it.type === "weapon") return `+${it.dmg} DMG` + (it.rangeMult > 1 ? `, ${it.rangeMult}x range` : "");
  return (
    `+${it.hp} HP` +
    (it.moveMult > 1 ? `, ${it.moveMult}x movement speed` : "") +
    (it.dashMult > 1 ? `, ${Math.round((it.dashMult - 1) * 100)}% dash distance` : "")
  );
}

/** Weights match design: 1/N rarity → weight ∝ 1/N (see shop description). */
function rollUndeadLoot() {
  const table = [
    { id: "demonic_bow", w: 1 },
    { id: "undead_wraith_chestplate", w: 2 },
    { id: "bone_bow", w: 10 },
    { id: "undead_blade", w: 20 },
    { id: "bone_chestplate", w: 25 },
    { id: "bone_leggings", w: 33 },
    { id: "bone_boots", w: 50 },
    { id: "bone_helmet", w: 50 },
    { id: "bone_sword", w: 100 },
  ];
  const total = table.reduce((a, row) => a + row.w, 0);
  let r = Math.random() * total;
  for (const row of table) {
    r -= row.w;
    if (r < 0) return row.id;
  }
  return "bone_sword";
}

function rollBossCrateLoot() {
  const table = [
    { id: "boss_blade", w: 1 / 1 },
    { id: "boss_boots", w: 1 / 2 },
    { id: "boss_helmet", w: 1 / 3 },
    { id: "boss_leggings", w: 1 / 4 },
    { id: "boss_chestplate", w: 1 / 6 },
    { id: "laser_blast", w: 1 / 7 },
    { id: "gattling", w: 1 / 8 },
    { id: "rpg", w: 1 / 10 },
  ];
  const total = table.reduce((a, row) => a + row.w, 0) || 1;
  let r = Math.random() * total;
  for (const row of table) {
    r -= row.w;
    if (r <= 0) return row.id;
  }
  return "boss_blade";
}

function rollPowerToolLoot() {
  const table = [
    { id: "laser_blaster", w: 1 / 1 },
    { id: "chainsaw", w: 1 / 2 },
    { id: "health_battery", w: 1 / 3 },
    { id: "techno_blade", w: 1 / 4 },
    { id: "technoblade", w: 1 / 10 },
  ].filter((d) => ITEMS[d.id]);
  const total = table.reduce((a, row) => a + row.w, 0) || 1;
  let r = Math.random() * total;
  for (const row of table) {
    r -= row.w;
    if (r <= 0) return row.id;
  }
  return "laser_blaster";
}

function rollAccessoryBundleLoot() {
  const table = [
    { id: "health_battery", w: 1 / 1 },
    { id: "dash_boots", w: 1 / 2 },
    { id: "golden_apple", w: 1 / 3 },
    { id: "armor_speeder", w: 1 / 5 },
    { id: "golden_drink", w: 1 / 10 },
    { id: "weapon_buffer", w: 1 / 10 },
  ].filter((d) => ITEMS[d.id]);
  const total = table.reduce((a, row) => a + row.w, 0) || 1;
  let r = Math.random() * total;
  for (const row of table) {
    r -= row.w;
    if (r <= 0) return row.id;
  }
  return "health_battery";
}

function ensureItemInInventory(save, itemId) {
  if (!save.inventory) save.inventory = { counts: {} };
  if (!save.inventory.counts || typeof save.inventory.counts !== "object") save.inventory.counts = {};
  save.inventory.counts[itemId] = (save.inventory.counts[itemId] || 0) + 1;
}

function getOwnedItems(save) {
  const owned = new Set();
  const counts = save.inventory?.counts ?? {};
  for (const [id, n] of Object.entries(counts)) {
    if (!ITEMS[id]) continue;
    if ((n || 0) > 0) owned.add(id);
  }
  // Always include currently equipped items as selectable
  for (const id of Object.values(save.equipped ?? {})) {
    if (id && ITEMS[id]) owned.add(id);
  }
  // Releasite set implies owning 1 of each piece (if not already equipped)
  if (save.armor?.ownedSet) {
    owned.add("releasite_helmet");
    owned.add("releasite_chestplate");
    owned.add("releasite_leggings");
    owned.add("releasite_boots");
  }
  return Array.from(owned);
}

function normalizeSave(save) {
  if (!save.inventory) save.inventory = { counts: {} };
  if (!save.inventory.counts || typeof save.inventory.counts !== "object") save.inventory.counts = {};
  if (!save.equipped) save.equipped = { helmet: null, chest: null, legs: null, boots: null, weapon1: null, weapon2: null };
  if (!save.redeems) save.redeems = { usedCodes: {} };
  if (!save.redeems.usedCodes || typeof save.redeems.usedCodes !== "object") save.redeems.usedCodes = {};
  if (save.magicoin === undefined || save.magicoin === null) save.magicoin = 0;
  if (!save.stats) {
    save.stats = {
      rogueKills: 0,
      singleWins: 0,
      hordeWins: 0,
      technoWins: 0,
      skeletonWins: 0,
      zombieWins: 0,
      zombieDogKills: 0,
      totalWins: 0,
      basicCratesOpened: 0,
      releaseCratesOpened: 0,
      bossCrates: 0,
    };
  }
  if (save.stats.skeletonWins === undefined || save.stats.skeletonWins === null) save.stats.skeletonWins = 0;
  if (save.stats.zombieWins === undefined || save.stats.zombieWins === null) save.stats.zombieWins = 0;
  if (save.stats.zombieDogKills === undefined || save.stats.zombieDogKills === null) save.stats.zombieDogKills = 0;
  if (save.stats.bossCrates === undefined || save.stats.bossCrates === null) save.stats.bossCrates = 0;
  if (save.stats.totalEnemiesKilled === undefined || save.stats.totalEnemiesKilled === null) save.stats.totalEnemiesKilled = 0;
  if (save.stats.totalMoneyEarned === undefined || save.stats.totalMoneyEarned === null) save.stats.totalMoneyEarned = 0;
  if (!save.forever) save.forever = { stage: 0, lastRandomId: null, currentTask: null, readyToClaim: false };
  if (typeof save.forever.readyToClaim !== "boolean") save.forever.readyToClaim = false;
  if (!save.compensation) save.compensation = { progressBugClaimed: false };
  if (typeof save.compensation.progressBugClaimed !== "boolean") save.compensation.progressBugClaimed = false;
  if (!save.settings || typeof save.settings !== "object") save.settings = {};
  if (typeof save.settings.mobileMode !== "boolean") save.settings.mobileMode = false;
  if (!save.crafting || typeof save.crafting !== "object") save.crafting = {};
  if (!save.crafting.upgrades || typeof save.crafting.upgrades !== "object") save.crafting.upgrades = {};
  if (!save.crafting.matchState || typeof save.crafting.matchState !== "object") save.crafting.matchState = {};
  if (typeof save.crafting.upgrades.armorSlot !== "string") save.crafting.upgrades.armorSlot = null;
  if (typeof save.crafting.upgrades.weaponSlot !== "string") save.crafting.upgrades.weaponSlot = null;
  if (typeof save.crafting.matchState.goldenAppleUsed !== "boolean") save.crafting.matchState.goldenAppleUsed = false;
  if (typeof save.crafting.matchState.goldenDrinkUsesLeft !== "number") save.crafting.matchState.goldenDrinkUsesLeft = 3;

  // Ensure releasite pieces exist as owned when set is purchased.
  // Represent them as "1 total", so if equipped -> count 0, else count 1.
  if (save.armor?.ownedSet) {
    const pieces = ["releasite_helmet", "releasite_chestplate", "releasite_leggings", "releasite_boots"];
    for (const id of pieces) {
      const isEquippedSomewhere = Object.values(save.equipped).includes(id);
      if (!isEquippedSomewhere && (save.inventory.counts[id] ?? 0) <= 0) save.inventory.counts[id] = 1;
    }
  }
  return save;
}

const FIRST_TASKS = [
  { id: "f1", title: "Kill 1x Rogue Dog", reward: 100, type: "abs", goals: [{ key: "rogueKills", target: 1, label: "Rogue Dog kills" }] },
  { id: "f2", title: "Win 3 matches vs Rogue Dog", reward: 100, type: "abs", goals: [{ key: "singleWins", target: 3, label: "Rogue Dog wins" }] },
  { id: "f3", title: "Kill Dog Horde", reward: 100, type: "abs", goals: [{ key: "hordeWins", target: 1, label: "Dog Horde wins" }] },
  { id: "f4", title: "Win 5 matches vs Rogue Dog", reward: 100, type: "abs", goals: [{ key: "singleWins", target: 5, label: "Rogue Dog wins" }] },
  { id: "f5", title: "Win 4 matches vs Dog Horde", reward: 100, type: "abs", goals: [{ key: "hordeWins", target: 4, label: "Dog Horde wins" }] },
  { id: "f6", title: "Win 1 match vs Techno Super Dog", reward: 100, type: "abs", goals: [{ key: "technoWins", target: 1, label: "Techno wins" }] },
  { id: "f7", title: "Win 3 matches vs Techno Super Dog", reward: 100, type: "abs", goals: [{ key: "technoWins", target: 3, label: "Techno wins" }] },
  { id: "f8", title: "Defeat all dogs 10 times", reward: 100, type: "abs", goals: [{ key: "totalWins", target: 10, label: "Total wins" }] },
];

const RANDOM_TASKS = [
  {
    id: "r_all_dogs",
    title: "Kill all types of dogs",
    reward: 300,
    type: "delta",
    goals: [
      { key: "singleWins", target: 1, label: "Rogue Dog wins" },
      { key: "hordeWins", target: 1, label: "Dog Horde wins" },
      { key: "technoWins", target: 1, label: "Techno wins" },
    ],
  },
  { id: "r_rogue", title: "Defeat Rogue Dog", reward: 20, type: "delta", goals: [{ key: "singleWins", target: 1, label: "Rogue Dog wins" }] },
  { id: "r_horde", title: "Defeat Dog Horde", reward: 50, type: "delta", goals: [{ key: "hordeWins", target: 1, label: "Dog Horde wins" }] },
  { id: "r_techno", title: "Defeat Techno Dog", reward: 80, type: "delta", goals: [{ key: "technoWins", target: 1, label: "Techno wins" }] },
  { id: "r_skeleton", title: "Defeat a Skeleton", reward: 50, type: "delta", goals: [{ key: "skeletonWins", target: 1, label: "Skeleton wins" }] },
  { id: "r_basic_crate", title: "Open 1 Basic Loot Crate", reward: 40, type: "delta", goals: [{ key: "basicCratesOpened", target: 1, label: "Basic crates opened" }] },
  { id: "r_zombie_1", title: "Slay 1 zombie", reward: 100, type: "delta", goals: [{ key: "zombieWins", target: 1, label: "Zombie wins" }] },
  {
    id: "r_zombie_5",
    title: "Slay 5 zombies",
    reward: 800,
    type: "delta",
    goals: [{ key: "zombieWins", target: 5, label: "Zombie wins" }],
  },
  {
    id: "r_zombie_dogs_10",
    title: "Slay 10 zombie dogs",
    reward: 300,
    type: "delta",
    goals: [{ key: "zombieDogKills", target: 10, label: "Zombie dog kills" }],
  },
];

function cloneStats(stats) {
  return {
    rogueKills: Number(stats?.rogueKills || 0),
    singleWins: Number(stats?.singleWins || 0),
    hordeWins: Number(stats?.hordeWins || 0),
    technoWins: Number(stats?.technoWins || 0),
    skeletonWins: Number(stats?.skeletonWins || 0),
    zombieWins: Number(stats?.zombieWins || 0),
    zombieDogKills: Number(stats?.zombieDogKills || 0),
    totalWins: Number(stats?.totalWins || 0),
    basicCratesOpened: Number(stats?.basicCratesOpened || 0),
    releaseCratesOpened: Number(stats?.releaseCratesOpened || 0),
  };
}

function makeTaskState(def, baseStats = null) {
  return {
    id: def.id,
    title: def.title,
    reward: def.reward,
    rewardKind: def.rewardKind || "money",
    type: def.type,
    goals: def.goals,
    baseStats,
  };
}

function getTaskProgress(task, stats) {
  const parts = [];
  let done = true;
  for (const g of task.goals) {
    const curRaw = Number(stats?.[g.key] || 0);
    const base = task.type === "delta" ? Number(task.baseStats?.[g.key] || 0) : 0;
    const cur = Math.max(0, curRaw - base);
    const val = Math.min(cur, g.target);
    if (cur < g.target) done = false;
    parts.push(`${g.label}: ${val}/${g.target}`);
  }
  return { done, text: parts.join(" | ") };
}

function pickRandomTask(lastRandomId, stats) {
  const sk = Number(stats?.skeletonWins || 0);
  const allowRareZombie5 = Math.random() < 0.01;
  let candidates = RANDOM_TASKS.filter((t) => t.id !== lastRandomId);
  candidates = candidates.filter((t) => !(t.id === "r_skeleton" && sk < 1));
  if (!allowRareZombie5) candidates = candidates.filter((t) => t.id !== "r_zombie_5");
  const pick = candidates[(Math.random() * candidates.length) | 0] || RANDOM_TASKS[0];
  return makeTaskState(pick, cloneStats(stats));
}

/** Fix stuck/old tasks (e.g. dual goal + open crate) when definitions change. */
function repairForeverTaskIfStale(save) {
  const t = save.forever?.currentTask;
  if (!t || !t.id) return;
  const def = RANDOM_TASKS.find((d) => d.id === t.id);
  if (!def) return;
  const hasReleaseGoal = Array.isArray(t.goals) && t.goals.some((g) => g.key === "releaseCratesOpened");
  const goalsMismatch =
    !Array.isArray(t.goals) ||
    t.goals.length !== def.goals.length ||
    t.goals.some((g, i) => !def.goals[i] || g.key !== def.goals[i].key || Number(g.target) !== Number(def.goals[i].target));
  if (!hasReleaseGoal && !goalsMismatch) return;

  const bs = cloneStats(save.stats);
  save.forever.currentTask = makeTaskState(def, bs);
  save.forever.readyToClaim = false;
}

/** Event release tasks removed — swap to a normal random task (existing items stay in inventory). */
function migrateOffEventReleaseTasks(save) {
  const id = save.forever?.currentTask?.id;
  if (id !== "r_event_horde_release" && id !== "r_event_techno_release") return;
  const next = pickRandomTask(save.forever.lastRandomId, save.stats);
  save.forever.lastRandomId = next.id;
  save.forever.currentTask = next;
  save.forever.readyToClaim = false;
}

/** Migrate old "all mobs" task id to all-dogs task. */
function migrateAllMobsTask(save) {
  const t = save.forever?.currentTask;
  if (t?.id === "r_all_mobs") {
    const def = RANDOM_TASKS.find((d) => d.id === "r_all_dogs");
    if (def) {
      save.forever.currentTask = makeTaskState(def, t.baseStats ? cloneStats(t.baseStats) : cloneStats(save.stats));
      save.forever.readyToClaim = false;
    }
  }
}

function ensureForeverTaskState(save) {
  const s = normalizeSave(save);
  migrateOffEventReleaseTasks(s);
  repairForeverTaskIfStale(s);
  migrateAllMobsTask(s);
  const cur = s.forever?.currentTask;
  if (cur?.id === "r_skeleton" && Number(s.stats?.skeletonWins || 0) < 1) {
    const next = pickRandomTask(s.forever.lastRandomId, s.stats);
    s.forever.lastRandomId = next.id;
    s.forever.currentTask = next;
    s.forever.readyToClaim = false;
  }
  if (s.forever.currentTask) return s;
  if (s.forever.stage < FIRST_TASKS.length) s.forever.currentTask = makeTaskState(FIRST_TASKS[s.forever.stage], null);
  else s.forever.currentTask = pickRandomTask(s.forever.lastRandomId, s.stats);
  return s;
}

function runForeverTaskEngine() {
  const s = ensureForeverTaskState(normalizeSave(loadSave()));
  if (s.forever.currentTask) {
    const p = getTaskProgress(s.forever.currentTask, s.stats);
    s.forever.readyToClaim = !!p.done;
  } else {
    s.forever.readyToClaim = false;
  }
  saveGame(s);
  updateShopUi?.();
  updateForeverUi?.();
}

function claimForeverTask() {
  const s = ensureForeverTaskState(normalizeSave(loadSave()));
  if (!s.forever.readyToClaim || !s.forever.currentTask) return;
  const p = getTaskProgress(s.forever.currentTask, s.stats);
  if (!p.done) {
    s.forever.readyToClaim = false;
    saveGame(s);
    updateForeverUi?.();
    return;
  }
  const curTask = s.forever.currentTask;
  if ((curTask.rewardKind || "money") === "money") {
    s.money = (s.money || 0) + Number(curTask.reward || 0);
    addLifetimeMoneyEarned(s, Number(curTask.reward || 0));
  }
  if (s.forever.stage < FIRST_TASKS.length) {
    s.forever.stage += 1;
    if (s.forever.stage < FIRST_TASKS.length) s.forever.currentTask = makeTaskState(FIRST_TASKS[s.forever.stage], null);
    else {
      const next = pickRandomTask(s.forever.lastRandomId, s.stats);
      s.forever.lastRandomId = next.id;
      s.forever.currentTask = next;
    }
  } else {
    const next = pickRandomTask(s.forever.lastRandomId, s.stats);
    s.forever.lastRandomId = next.id;
    s.forever.currentTask = next;
  }
  s.forever.readyToClaim = false;
  saveGame(s);
  updateShopUi?.();
  runForeverTaskEngine();
  refreshSettingsStats?.();
}

// --------- Redeem / Limited Release Crate ----------
const isLimitedReleaseCrateEnabled = () => getLocalEventTrigger("LIMITED_RELEASE_CRATE_TRIGGER");

const LIMITED_RELEASE_CODES = Object.freeze(["Hb03", "Lhyu", "Relese!", "z00ms4hur", "uracat", "april9th", "tester-001"]);

const REDEEMABLE_INFINITE = new Set(["tester-001"]);

function rollLimitedReleaseLoot() {
  // Uses your "1 in N" list as weights (smaller N => more common).
  // One item per crate.
  const drops = [
    { id: "releasite_boots", w: 1 / 1 },
    { id: "releasite_helmet", w: 1 / 2 },
    { id: "releasite_sword", w: 1 / 2 },
    { id: "releasite_leggings", w: 1 / 3 },
    { id: "releasite_chestplate", w: 1 / 4 },
    { id: "releasite_wraith_armor", w: 1 / 10 },
    { id: "releasite_longsword", w: 1 / 10 },
  ].filter((d) => ITEMS[d.id]);

  const total = drops.reduce((a, d) => a + d.w, 0) || 1;
  let r = Math.random() * total;
  for (const d of drops) {
    r -= d.w;
    if (r <= 0) return d.id;
  }
  return drops[drops.length - 1]?.id ?? "releasite_boots";
}

function redeemLimitedReleaseCrate(codeRaw) {
  if (!isLimitedReleaseCrateEnabled()) return { ok: false, reason: "disabled" };
  const code = String(codeRaw ?? "");
  if (!LIMITED_RELEASE_CODES.includes(code)) return { ok: false, reason: "invalid" };

  if (REDEEMABLE_INFINITE.has(code)) {
    const itemId = rollLimitedReleaseLoot();
    const save = normalizeSave(loadSave());
    ensureItemInInventory(save, itemId);
    saveGame(save);
    return { ok: true, opened: true, infinite: true, itemId };
  }

  const save = normalizeSave(loadSave());
  const used = !!save.redeems.usedCodes[code];
  if (used) return { ok: false, reason: "used" };

  save.redeems.usedCodes[code] = true;
  const itemId = rollLimitedReleaseLoot();
  ensureItemInInventory(save, itemId);
  saveGame(save);
  return { ok: true, opened: true, infinite: false, itemId };
}

function equipItem(slotKey, newId) {
  const save = normalizeSave(loadSave());
  const counts = save.inventory.counts;
  const cur = save.equipped[slotKey] ?? null;
  const next = newId ? newId : null;
  if (cur === next) return save;

  // return current item to inventory
  if (cur) counts[cur] = (counts[cur] || 0) + 1;

  // take next item from inventory
  if (next) {
    if ((counts[next] || 0) <= 0) {
      // not owned (or already consumed elsewhere)
      // undo return
      if (cur) counts[cur] = Math.max(0, (counts[cur] || 0) - 1);
      return save;
    }
    counts[next] = Math.max(0, (counts[next] || 0) - 1);
  }

  save.equipped[slotKey] = next;
  saveGame(save);
  return save;
}

function setStatus(text) {
  const pill = $("#statusPill");
  if (pill) pill.textContent = text;
}

function getItemDisplayName(save, itemId, slotKey) {
  if (!itemId || !ITEMS[itemId]) return "You don't own any";
  const base = ITEMS[itemId].name;
  const armorSlot = save?.crafting?.upgrades?.armorSlot ?? null;
  const weaponSlot = save?.crafting?.upgrades?.weaponSlot ?? null;
  if (slotKey && slotKey === armorSlot) return `[Armor Speeder] ${base}`;
  if (slotKey && slotKey === weaponSlot) return `[Weapon Buffer] ${base}`;
  return base;
}

function initTabs() {
  const tabs = $$(".tab");
  const panels = $$(".panel");

  const activate = (panelName) => {
    for (const t of tabs) t.classList.toggle("is-active", t.dataset.panel === panelName);
    for (const p of panels) p.classList.toggle("is-active", p.dataset.panel === panelName);
    setStatus(`Panel: ${panelName}`);
    if (panelName === "weapons") updateWeaponsSlots();
    if (panelName === "shop") updateShopUi?.();
    if (panelName === "forever") updateForeverUi?.();
    if (panelName === "settings") refreshSettingsStats?.();
  };

  for (const t of tabs) {
    t.addEventListener("click", () => activate(t.dataset.panel));
  }

  activate("fights");
}

function refreshSettingsStats() {
  const s = normalizeSave(loadSave());
  const enemiesEl = $("#settingsEnemiesKilled");
  const moneyEl = $("#settingsTotalMoneyMade");
  if (enemiesEl) enemiesEl.textContent = String(Number(s.stats?.totalEnemiesKilled || 0));
  if (moneyEl) moneyEl.textContent = `$${Number(s.stats?.totalMoneyEarned || 0)}`;
}

function initSettingsPanel() {
  const toggleBtn = $("#toggleMobileModeBtn");
  if (!toggleBtn) return;
  const sync = () => {
    const s = normalizeSave(loadSave());
    toggleBtn.textContent = s.settings?.mobileMode ? "Computer mode" : "Mobile mode";
    refreshSettingsStats();
  };
  toggleBtn.addEventListener("click", () => {
    const s = normalizeSave(loadSave());
    s.settings.mobileMode = !s.settings.mobileMode;
    saveGame(s);
    notifyMobileModeChanged();
    sync();
  });
  sync();
}

function updateWeaponsSlots() {
  const save = normalizeSave(loadSave());
  // migrate legacy releasite toggles into equipped ids if needed
  if (!save.equipped) save.equipped = { helmet: null, chest: null, legs: null, boots: null, weapon1: null, weapon2: null };
  const legacy = save.armor?.equipped ?? { helmet: false, chest: false, legs: false, boots: false };
  if (legacy.helmet && !save.equipped.helmet) save.equipped.helmet = "releasite_helmet";
  if (legacy.chest && !save.equipped.chest) save.equipped.chest = "releasite_chestplate";
  if (legacy.legs && !save.equipped.legs) save.equipped.legs = "releasite_leggings";
  if (legacy.boots && !save.equipped.boots) save.equipped.boots = "releasite_boots";
  saveGame(save);

  const owned = getOwnedItems(save);

  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  set("slotHelmetValue", getItemDisplayName(save, save.equipped.helmet, "helmet"));
  set("slotChestValue", getItemDisplayName(save, save.equipped.chest, "chest"));
  set("slotLegsValue", getItemDisplayName(save, save.equipped.legs, "legs"));
  set("slotBootsValue", getItemDisplayName(save, save.equipped.boots, "boots"));
  set("slotWeapon1Value", getItemDisplayName(save, save.equipped.weapon1, "weapon1"));
  set("slotWeapon2Value", getItemDisplayName(save, save.equipped.weapon2, "weapon2"));

  const fillSelect = (selectId, slotKey, allowedTypes) => {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const cur = save.equipped?.[slotKey] ?? null;
    const counts = save.inventory?.counts ?? {};
    const options = [
      { id: "", label: "(none)" },
      ...owned
        .filter((id) => allowedTypes.includes(ITEMS[id].type))
        .map((id) => {
          const c = (counts[id] || 0) + (cur === id ? 1 : 0);
          const suffix = c > 1 ? ` x${c}` : c === 1 ? "" : " (equipped)";
          const nm = id === cur ? getItemDisplayName(save, id, slotKey) : ITEMS[id].name;
          return { id, label: `${nm}${suffix}` };
        }),
    ];
    sel.innerHTML = "";
    for (const o of options) {
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = o.label;
      sel.appendChild(opt);
    }
    sel.value = cur ?? "";
    sel.onchange = () => {
      equipItem(slotKey, sel.value || null);
      updateWeaponsSlots();
      setStatus(`Equipped: ${slotKey}`);
    };
  };

  fillSelect("slotHelmetSelect", "helmet", ["helmet"]);
  fillSelect("slotChestSelect", "chest", ["chest"]);
  fillSelect("slotLegsSelect", "legs", ["legs"]);
  fillSelect("slotBootsSelect", "boots", ["boots"]);
  fillSelect("slotWeapon1Select", "weapon1", ["weapon"]);
  fillSelect("slotWeapon2Select", "weapon2", ["weapon"]);
  window.dispatchEvent(new CustomEvent("weapons:updated"));
}

function initCraftingUi() {
  const openBtn = $("#openCraftingBtn");
  const wrap = $("#craftingWrap");
  const armorSel = $("#craftArmorTargetSelect");
  const weaponSel = $("#craftWeaponTargetSelect");
  const applyArmorBtn = $("#applyArmorSpeederBtn");
  const applyWeaponBtn = $("#applyWeaponBufferBtn");
  const armorStatus = $("#armorSpeederStatus");
  const weaponStatus = $("#weaponBufferStatus");
  const note = $("#craftingNote");
  if (!openBtn || !wrap || !armorSel || !weaponSel || !applyArmorBtn || !applyWeaponBtn) return;

  let open = false;
  const render = () => {
    const s = normalizeSave(loadSave());
    const enabled = isTriggerOn("BOSS_UPDATE_TRIGGER");
    const eq = s.equipped ?? { helmet: null, chest: null, legs: null, boots: null, weapon1: null, weapon2: null };
    openBtn.style.display = enabled ? "" : "none";
    wrap.style.display = enabled && open ? "" : "none";
    if (!enabled) return;
    if (armorStatus) armorStatus.textContent = `Owned: ${Number(s.inventory?.counts?.armor_speeder || 0)}`;
    if (weaponStatus) weaponStatus.textContent = `Owned: ${Number(s.inventory?.counts?.weapon_buffer || 0)}`;
    if (note) {
      const a = s.crafting?.upgrades?.armorSlot ?? "none";
      const w = s.crafting?.upgrades?.weaponSlot ?? "none";
      note.textContent = `Current: armor speeder on ${a}, weapon buffer on ${w}.`;
    }
    armorSel.innerHTML = "";
    for (const slot of ["helmet", "chest", "legs", "boots"]) {
      const id = eq[slot];
      if (!id || !ITEMS[id]) continue;
      const opt = document.createElement("option");
      opt.value = slot;
      opt.textContent = `${slot}: ${ITEMS[id].name}`;
      armorSel.appendChild(opt);
    }
    weaponSel.innerHTML = "";
    for (const slot of ["weapon1", "weapon2"]) {
      const id = eq[slot];
      if (!id || !ITEMS[id]) continue;
      const opt = document.createElement("option");
      opt.value = slot;
      opt.textContent = `${slot}: ${ITEMS[id].name}`;
      weaponSel.appendChild(opt);
    }
    applyArmorBtn.disabled = armorSel.options.length === 0;
    applyWeaponBtn.disabled = weaponSel.options.length === 0;
  };

  openBtn.addEventListener("click", () => {
    open = !open;
    render();
  });

  applyArmorBtn.addEventListener("click", () => {
    const s = normalizeSave(loadSave());
    if (!isTriggerOn("BOSS_UPDATE_TRIGGER")) return;
    const target = armorSel.value;
    if (!target) return setStatus("Equip an armor first.");
    if ((s.inventory?.counts?.armor_speeder || 0) <= 0) return setStatus("No Armor Speeder owned.");
    if (s.crafting?.upgrades?.armorSlot === target) {
      setStatus("That armor already has Armor Speeder.");
      return;
    }
    const ok = window.confirm(
      "This is irreversible. Your Armor Speeder will be consumed and cannot be recovered. Continue?",
    );
    if (!ok) return;
    s.inventory.counts.armor_speeder = Math.max(0, (s.inventory.counts.armor_speeder || 0) - 1);
    s.crafting.upgrades.armorSlot = target;
    saveGame(s);
    updateWeaponsSlots();
    updateShopUi?.();
    render();
    setStatus(`Armor Speeder applied to ${target}.`);
  });

  applyWeaponBtn.addEventListener("click", () => {
    const s = normalizeSave(loadSave());
    if (!isTriggerOn("BOSS_UPDATE_TRIGGER")) return;
    const target = weaponSel.value;
    if (!target) return setStatus("Equip a weapon first.");
    if ((s.inventory?.counts?.weapon_buffer || 0) <= 0) return setStatus("No Weapon Buffer owned.");
    if (s.crafting?.upgrades?.weaponSlot === target) {
      setStatus("That weapon already has Weapon Buffer.");
      return;
    }
    const ok = window.confirm(
      "This is irreversible. Your Weapon Buffer will be consumed and cannot be recovered. Continue?",
    );
    if (!ok) return;
    s.inventory.counts.weapon_buffer = Math.max(0, (s.inventory.counts.weapon_buffer || 0) - 1);
    s.crafting.upgrades.weaponSlot = target;
    saveGame(s);
    updateWeaponsSlots();
    updateShopUi?.();
    render();
    setStatus(`Weapon Buffer applied to ${target}.`);
  });

  window.addEventListener("triggers:changed", render);
  window.addEventListener("weapons:updated", render);
  render();
}

let updateShopUi = null;
let updateForeverUi = null;
let revealBossCrateRewards = null;

// Simple pixel robot renderer (canvas, crisp pixels)
function drawRobot(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);

  // Background grid glow
  ctx.fillStyle = "#070A12";
  ctx.fillRect(0, 0, W, H);

  // Tiny star noise
  for (let i = 0; i < 140; i++) {
    const x = (Math.random() * W) | 0;
    const y = (Math.random() * H) | 0;
    const a = Math.random() * 0.35;
    ctx.fillStyle = `rgba(234,240,255,${a.toFixed(3)})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // Pixel art grid: paint on a small buffer and scale up
  const grid = 28; // 28x28 pixels
  const px = Math.floor(Math.min(W, H) / grid);
  const ox = Math.floor((W - grid * px) / 2);
  const oy = Math.floor((H - grid * px) / 2);

  const put = (x, y, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + x * px, oy + y * px, px, px);
  };

  const rect = (x0, y0, x1, y1, color) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, color);
  };

  const outline = "#101A36";
  const steel = "#9FB3D8";
  const steel2 = "#6C82AF";
  const steel3 = "#D8E4FF";
  const neon = "#25E4FF";
  const neon2 = "#7C5CFF";
  const shadow = "#0B1020";
  const core = "#3DFFB5";

  // Drop shadow silhouette
  rect(9, 4, 18, 24, "rgba(0,0,0,.18)");
  rect(8, 6, 19, 23, "rgba(0,0,0,.10)");

  // Head
  rect(10, 5, 17, 9, steel2);
  rect(10, 5, 17, 5, steel3); // highlight
  rect(10, 9, 17, 9, outline);
  rect(10, 5, 10, 9, outline);
  rect(17, 5, 17, 9, outline);

  // Visor
  rect(11, 7, 16, 8, neon);
  put(12, 7, "#EAF0FF");
  put(15, 8, "#EAF0FF");
  put(11, 7, neon2);
  put(16, 8, neon2);

  // Antenna
  rect(14, 3, 14, 4, steel);
  put(14, 2, neon2);

  // Neck
  rect(12, 10, 15, 10, outline);

  // Torso
  rect(9, 11, 18, 18, steel);
  rect(9, 11, 18, 11, steel3);
  rect(9, 18, 18, 18, outline);
  rect(9, 11, 9, 18, outline);
  rect(18, 11, 18, 18, outline);

  // Chest core
  rect(13, 14, 14, 15, core);
  put(12, 15, "rgba(61,255,181,.55)");
  put(15, 14, "rgba(61,255,181,.55)");

  // Shoulder plates
  rect(6, 12, 8, 14, steel2);
  rect(19, 12, 21, 14, steel2);
  rect(6, 14, 8, 14, outline);
  rect(19, 14, 21, 14, outline);
  rect(6, 12, 6, 14, outline);
  rect(21, 12, 21, 14, outline);

  // Arms
  rect(6, 15, 8, 19, steel);
  rect(19, 15, 21, 19, steel);
  rect(6, 19, 8, 19, outline);
  rect(19, 19, 21, 19, outline);
  rect(6, 15, 6, 19, outline);
  rect(8, 15, 8, 19, outline);
  rect(19, 15, 19, 19, outline);
  rect(21, 15, 21, 19, outline);

  // Hands
  rect(6, 20, 8, 21, steel2);
  rect(19, 20, 21, 21, steel2);
  rect(6, 21, 8, 21, outline);
  rect(19, 21, 21, 21, outline);

  // Belt
  rect(10, 19, 17, 19, outline);
  rect(11, 19, 12, 19, neon2);
  rect(15, 19, 16, 19, neon2);

  // Legs
  rect(11, 20, 13, 24, steel2);
  rect(14, 20, 16, 24, steel2);
  rect(11, 24, 13, 24, outline);
  rect(14, 24, 16, 24, outline);
  rect(11, 20, 11, 24, outline);
  rect(13, 20, 13, 24, outline);
  rect(14, 20, 14, 24, outline);
  rect(16, 20, 16, 24, outline);

  // Boots
  rect(10, 25, 13, 26, shadow);
  rect(14, 25, 17, 26, shadow);
  rect(10, 26, 13, 26, outline);
  rect(14, 26, 17, 26, outline);
  rect(10, 25, 10, 26, outline);
  rect(17, 25, 17, 26, outline);

  // Neon trims
  rect(9, 12, 9, 13, neon2);
  rect(18, 12, 18, 13, neon2);
  put(7, 13, neon);
  put(20, 13, neon);

  // Sparkle corners
  put(5, 6, "rgba(37,228,255,.45)");
  put(22, 9, "rgba(124,92,255,.35)");
  put(6, 23, "rgba(61,255,181,.30)");
}

function initRobot() {
  const c = $("#robotCanvas");
  if (!c) return;

  // Draw once now
  drawRobot(c);

  // Redraw on resize to keep crisp scaling if canvas CSS size changes
  const ro = new ResizeObserver(() => drawRobot(c));
  ro.observe(c);
}

// --------- Fights (Rogue Dog prototype) ----------
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const len = (x, y) => Math.hypot(x, y);

function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function resolveCircleVsAabbCircleLike(pos, r, box) {
  // Push circle out of AABB (simple & stable for axis-aligned obstacle)
  const closestX = clamp(pos.x, box.x, box.x + box.w);
  const closestY = clamp(pos.y, box.y, box.y + box.h);
  const dx = pos.x - closestX;
  const dy = pos.y - closestY;
  const d = Math.hypot(dx, dy);
  if (d === 0 || d >= r) return pos;
  const push = (r - d) + 0.01;
  return { x: pos.x + (dx / d) * push, y: pos.y + (dy / d) * push };
}

function resolveCircleVsObstacles(pos, r, boxes) {
  let p = { x: pos.x, y: pos.y };
  for (const box of boxes) {
    p = resolveCircleVsAabbCircleLike(p, r, box);
  }
  return p;
}

function circleIntersectsAabb(cx, cy, cr, box) {
  const px = clamp(cx, box.x, box.x + box.w);
  const py = clamp(cy, box.y, box.y + box.h);
  return Math.hypot(cx - px, cy - py) < cr;
}

function buildPaintballObstacles(W, H) {
  return [
    { x: 100, y: 70, w: 100, h: 72 },
    { x: W * 0.42, y: 55, w: 120, h: 60 },
    { x: W - 220, y: 85, w: 95, h: 88 },
    { x: 140, y: H * 0.42, w: 88, h: 100 },
    { x: W * 0.48, y: H * 0.38, w: 105, h: 95 },
    { x: W - 200, y: H * 0.4, w: 92, h: 110 },
    { x: W * 0.34, y: H - 160, w: 130, h: 75 },
  ];
}

function buildMilitaryTrainingObstacles(W, H) {
  return [
    { x: W * 0.46 - 90, y: H * 0.5 - 160, w: 180, h: 72 },
    { x: W * 0.46 - 90, y: H * 0.5 + 80, w: 180, h: 72 },
    { x: W * 0.5 - 230, y: H * 0.5 - 40, w: 120, h: 110 },
    { x: W * 0.5 + 110, y: H * 0.5 - 40, w: 120, h: 110 },
  ];
}

function initFights() {
  const canvas = $("#fightCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  const mobBtnDog = $("#mob-rogue-dog");
  const mobBtnHorde = $("#mob-dog-horde");
  const mobBtnTechno = $("#mob-techno-super-dog");
  const mobBtnSkeleton = $("#mob-skeleton");
  const mobBtnZombie = $("#mob-zombie");
  const moneyText = $("#moneyText");
  const arenaTerrainLabel = $("#arenaTerrainLabel");
  const mobileFightUi = $("#mobileFightUi");
  const mobileAttackZone = $("#mobileAttackZone");
  const mobileStick = $("#mobileStick");
  const mobileStickKnob = $("#mobileStickKnob");

  const ui = {
    playerFill: $("#playerHpFill"),
    playerText: $("#playerHpText"),
    dogFill: $("#dogHpFill"),
    dogText: $("#dogHpText"),
    cooldowns: $("#cooldowns"),
  };
  const enemyLabel = $("#enemyLabel");
  const fightHintEl = $("#fightHint");
  const armorUi = {
    helmet: $("#equipHelmet"),
    chest: $("#equipChest"),
    legs: $("#equipLegs"),
    boots: $("#equipBoots"),
  };

  const viewW = canvas.width;
  const viewH = canvas.height;
  const world = {
    w: viewW,
    h: viewH,
    slide: { x: viewW / 2 - 130, y: viewH / 2 - 90, w: 260, h: 180 },
    slides: [],
  };

  const player = {
    x: world.w * 0.25,
    y: world.h * 0.65,
    r: 14,
    hpMax: 100,
    hp: 100,
    speed: 170, // slower than dog
    cdMs: 1000,
    cdLeft: 0,
    dmg: 5, // fists + weapon (melee)
    rangeMult: 1.0,
    dashCdMs: 900,
    dashCdLeft: 0,
    usingBow: false,
    usingPhantomSniper: false,
    usingLaserBlast: false,
    usingLaserBlaster: false,
    usingChainsaw: false,
    usingHealthBattery: false,
    usingGoldenApple: false,
    usingGoldenDrink: false,
    usingTechnoblade: false,
    usingShadowBlade: false,
    shadowBladeTarget: null,
    usingGattling: false,
    usingRpg: false,
    bowDmg: 0,
    phantomCdLeft: 0,
    phantomCdMs: 1100,
    dashMult: 1.0,
    gattlingShotsLeft: 0,
    gattlingShotCdLeft: 0,
    laserFxMs: 0,
    laserFxFrom: null,
    laserFxTo: null,
    powerActiveKind: null, // "laser_blaster" | "chainsaw"
    powerActiveLeftMs: 0,
    powerReloadLeftMs: 0,
    powerLockedTarget: null,
    technoBeamLeftMs: 0,
    technoBeamDir: { x: 1, y: 0 },
    powerBeamLeftMs: 0,
    powerBeamDir: { x: 1, y: 0 },
    goldenAppleUsedMatch: false,
    goldenDrinkUsesLeft: 3,
  };

  const makeDog = (x, y) => ({
    x,
    y,
    r: 13,
    hpMax: 30,
    hp: 30,
    speed: 250, // faster than player
    cdMs: 1000,
    cdLeft: 0,
    dmg: 5,
    mode: "charge", // charge | retreat
    justHitRetreatMs: 550,
    retreatLeft: 0,
    rewarded: false,
  });
  const makeSkeleton = (x, y) => ({
    x,
    y,
    r: 14,
    hpMax: 70,
    hp: 70,
    speed: 175,
    cdMs: 1000,
    cdLeft: 0,
    dmg: 0,
    mode: "charge",
    justHitRetreatMs: 400,
    retreatLeft: 0,
    rewarded: false,
    kind: "skeleton",
    shootCdMs: 1000,
    shootCdLeft: 600,
  });
  const makeTechnoDog = (x, y) => ({
    x,
    y,
    r: 26,
    hpMax: 100,
    hp: 100,
    speed: 205,
    cdMs: 1000,
    cdLeft: 0,
    dmg: 10,
    mode: "charge",
    justHitRetreatMs: 450,
    retreatLeft: 0,
    rewarded: false,
    kind: "techno",
    attackPattern: ["bite", "bite", "laser", "bite", "laser", "laser", "bite", "bite", "laser"],
    attackIndex: 0,
    nextActionInMs: 1000,
    laserActiveMs: 0,
    laserDir: { x: 1, y: 0 },
    laserDps: 3,
    laserLen: 4000,
    laserHalfW: 16,
  });
  const makeArmyTechnoDog = (x, y) => ({
    ...makeTechnoDog(x, y),
    r: 39,
    hpMax: 500,
    hp: 500,
    speed: 190,
    dmg: 10,
    kind: "armyTechno",
    attackPattern: ["bite", "gattling", "laser", "bite", "gattling", "laser", "gattling", "bite"],
    laserDps: 8,
    laserActiveMs: 0,
    laserColor: "purple",
    gattlingShots: 0,
    gattlingIntervalMs: 90,
    gattlingBurstLeftMs: 0,
    gattlingShotCdMs: 0,
  });
  const makeZombie = (x, y) => ({
    x,
    y,
    r: 17,
    hpMax: 140,
    hp: 140,
    speed: 200,
    cdMs: 1000,
    cdLeft: 0,
    dmg: 15,
    mode: "charge",
    justHitRetreatMs: 550,
    retreatLeft: 0,
    rewarded: false,
    kind: "zombie",
    summonCdMs: 10000,
    summonCdLeft: 5000,
  });
  const makeZombieDog = (x, y) => ({
    x,
    y,
    r: 13,
    hpMax: 10,
    hp: 10,
    speed: 250,
    cdMs: 1000,
    cdLeft: 0,
    dmg: 5,
    mode: "charge",
    justHitRetreatMs: 550,
    retreatLeft: 0,
    rewarded: false,
    kind: "zombieDog",
  });
  const makeTitanZombieDog = (x, y) => ({
    ...makeZombieDog(x, y),
    r: 32,
    hpMax: 70,
    hp: 70,
    speed: 210,
    dmg: 30,
    kind: "titanZombieDog",
  });
  const makeTitanZombie = (x, y) => ({
    ...makeZombie(x, y),
    r: 55,
    hpMax: 700,
    hp: 700,
    speed: 140,
    dmg: 0,
    kind: "titanZombie",
    summonCdMs: 10000,
    summonCdLeft: 2500,
    smashCdMs: 7500,
    smashCdLeft: 3500,
    chargeActive: false,
  });
  const makeGalaxyWarrior = (x, y) => ({
    x,
    y,
    r: 26, // same size as normal techno dog
    hpMax: 1500,
    hp: 1500,
    speed: 385, // very fast (buffed)
    cdMs: 1000, // slash cooldown
    cdLeft: 0,
    dmg: 20,
    mode: "charge",
    justHitRetreatMs: 0,
    retreatLeft: 0,
    rewarded: false,
    kind: "galaxyWarrior",
    meteorCdMs: 7000,
    meteorCdLeft: 1800,
    meteorShotsLeft: 0,
    meteorShotCdLeft: 0,
    pathWp: null,
    pathRecalcMs: 0,
    gwIsReal: true,
    gwSplitDone: false,
    gwPhase: "normal", // normal | run | telegraph | laser | fight
    gwPhaseLeftMs: 0,
    gwAim: null,
    gwLaserDir: { x: 1, y: 0 },
    gwSlideHitMs: {},
  });
  let dogs = [makeDog(world.w * 0.75, world.h * 0.45)];

  const keys = new Set();
  let mouseDown = false;
  let gameOver = false;
  let fightStarted = false;
  let lastT = performance.now();
  let lastMove = { x: 1, y: 0 };
  let animT = 0;
  let rewardGranted = false;
  let fightMode = "single"; // single | horde | techno | skeleton | zombie | apocalypse | armytechno | titanzombie | galaxywarrior
  let terrainType = "playground"; // playground | paintball | apocalypse | military
  let apocWave = 1;
  let paintballObstacles = [];
  let militaryObstacles = [];
  let arrows = [];
  let phantomBullets = [];
  let rockets = [];
  let phantomLongPressStart = null;
  let phantomLockedTarget = null;
  let laserLongPressStart = null;
  let laserLockedTarget = null;
  let powerLongPressStart = null;
  let powerLockedTarget = null;
  let phantomUniversalBlastMs = 0;
  let phantomUniversalBlastX = 0;
  let phantomUniversalBlastY = 0;
  let phantomAimX = world.w * 0.5;
  let phantomAimY = world.h * 0.5;
  let lastCamX = 0;
  let lastCamY = 0;
  let playerMoving = false;
  let slideDestroyed = false;
  let slideLaserMs = 0;
  let slideExplosionMs = 0;
  let activeWeaponSlot = "weapon1"; // weapon1 | weapon2
  let titanQuakes = [];
  let meteors = [];
  let mobileStickPointerId = null;
  let mobileAttackPointerId = null;
  const mobileStickState = { x: 0, y: 0 };

  const resetMobileStick = () => {
    mobileStickState.x = 0;
    mobileStickState.y = 0;
    if (mobileStickKnob) mobileStickKnob.style.transform = "translate(0px, 0px)";
  };
  const isMobileModeActive = () => {
    const s = normalizeSave(loadSave());
    return !!s.settings?.mobileMode;
  };
  const updateMobileOverlay = () => {
    const active = isMobileModeActive() && fightStarted && !gameOver;
    if (mobileFightUi) mobileFightUi.classList.toggle("is-active", active);
    if (!active) {
      resetMobileStick();
      mobileStickPointerId = null;
      mobileAttackPointerId = null;
      mouseDown = false;
    }
  };
  subscribeMobileMode(updateMobileOverlay);

  const getSlideBoxes = () => {
    if (terrainType === "paintball") return [];
    if (slideDestroyed) return [];
    if ((terrainType === "apocalypse" || terrainType === "military") && world.slides.length) return world.slides;
    return [world.slide];
  };

  const getSolidObstacles = () => {
    if (terrainType === "paintball") return paintballObstacles;
    if (terrainType === "military") return [...getSlideBoxes(), ...militaryObstacles];
    return getSlideBoxes();
  };

  const getCameraOffset = () => {
    if (!(terrainType === "apocalypse" || terrainType === "military") || !fightStarted) return { x: 0, y: 0 };
    const vw = canvas.width;
    const vh = canvas.height;
    // Keep some on-screen movement instead of hard-centering.
    const tx = player.x - vw * 0.38;
    const ty = player.y - vh * 0.38;
    return {
      x: clamp(tx, 0, Math.max(0, world.w - vw)),
      y: clamp(ty, 0, Math.max(0, world.h - vh)),
    };
  };

  const magicoinHud = $("#magicoinText");
  const updateMoneyUi = () => {
    const s = normalizeSave(loadSave());
    if (moneyText) moneyText.textContent = `$${s.money}`;
    if (magicoinHud) magicoinHud.textContent = `${s.magicoin ?? 0} magicoin`;
  };

  const addMoney = (amount) => {
    const s = normalizeSave(loadSave());
    s.money = (s.money || 0) + amount;
    addLifetimeMoneyEarned(s, amount);
    saveGame(s);
    updateMoneyUi();
    refreshSettingsStats?.();
  };

  const addMagicoin = (amount) => {
    const s = normalizeSave(loadSave());
    s.magicoin = (s.magicoin || 0) + amount;
    saveGame(s);
    updateMoneyUi();
  };

  const loadEquipped = () => {
    const s = normalizeSave(loadSave());
    // Legacy releasite toggles still work (map into item ids on the fly)
    if (!s.equipped) s.equipped = { helmet: null, chest: null, legs: null, boots: null, weapon1: null, weapon2: null };
    const leg = s.armor?.equipped ?? { helmet: false, chest: false, legs: false, boots: false };
    if (leg.helmet) s.equipped.helmet = s.equipped.helmet ?? "releasite_helmet";
    if (leg.chest) s.equipped.chest = s.equipped.chest ?? "releasite_chestplate";
    if (leg.legs) s.equipped.legs = s.equipped.legs ?? "releasite_leggings";
    if (leg.boots) s.equipped.boots = s.equipped.boots ?? "releasite_boots";
    return s.equipped;
  };

  const applyLoadout = () => {
    const eq = loadEquipped();
    const sNow = normalizeSave(loadSave());
    const upgrades = sNow.crafting?.upgrades ?? { armorSlot: null, weaponSlot: null };
    const helmet = eq.helmet ? ITEMS[eq.helmet] : null;
    const chest = eq.chest ? ITEMS[eq.chest] : null;
    const legs = eq.legs ? ITEMS[eq.legs] : null;
    const boots = eq.boots ? ITEMS[eq.boots] : null;
    const weaponId = eq[activeWeaponSlot] ?? null;
    const weapon = weaponId ? ITEMS[weaponId] : null;
    const armorBoostActive = !!upgrades.armorSlot && !!eq[upgrades.armorSlot];
    const weaponBoostActive = upgrades.weaponSlot === activeWeaponSlot && !!weapon;

    const hpBonus = (helmet?.hp ?? 0) + (chest?.hp ?? 0) + (legs?.hp ?? 0) + (boots?.hp ?? 0);
    const moveMultBase = Math.max(1.0, helmet?.moveMult ?? 1.0, chest?.moveMult ?? 1.0, legs?.moveMult ?? 1.0, boots?.moveMult ?? 1.0);
    const moveMult = moveMultBase * (armorBoostActive ? 1.2 : 1.0);
    const dashBase = Math.max(1.0, helmet?.dashMult ?? 1.0, chest?.dashMult ?? 1.0, legs?.dashMult ?? 1.0, boots?.dashMult ?? 1.0);
    const dashMult = dashBase * (armorBoostActive ? 1.2 : 1.0);
    const rangeBoost = weaponBoostActive ? 1.2 : 1.0;
    const baseHp = fightMode === "apocalypse" ? 1000 : 100;
    const armorHpMult = fightMode === "apocalypse" ? 10 : 1;

    // reset weapon-mode flags
    player.usingLaserBlaster = false;
    player.usingChainsaw = false;
    player.usingHealthBattery = false;
    player.usingGoldenApple = false;
    player.usingGoldenDrink = false;
    player.usingTechnoblade = false;
    player.usingShadowBlade = false;

    if (weapon?.healthBattery) {
      player.usingBow = false;
      player.usingPhantomSniper = false;
      player.usingLaserBlast = false;
      player.usingGattling = false;
      player.usingRpg = false;
      player.usingLaserBlaster = false;
      player.usingChainsaw = false;
      player.usingHealthBattery = true;
      player.usingGoldenApple = false;
      player.usingGoldenDrink = false;
      player.usingTechnoblade = false;
      player.bowDmg = 0;
      player.dmg = 0;
      player.rangeMult = 1.0;
    } else if (weapon?.goldenApple) {
      player.usingBow = false;
      player.usingPhantomSniper = false;
      player.usingLaserBlast = false;
      player.usingGattling = false;
      player.usingRpg = false;
      player.usingLaserBlaster = false;
      player.usingChainsaw = false;
      player.usingHealthBattery = false;
      player.usingGoldenApple = true;
      player.usingGoldenDrink = false;
      player.usingTechnoblade = false;
      player.bowDmg = 0;
      player.dmg = 0;
      player.rangeMult = 1.0;
    } else if (weapon?.goldenDrink) {
      player.usingBow = false;
      player.usingPhantomSniper = false;
      player.usingLaserBlast = false;
      player.usingGattling = false;
      player.usingRpg = false;
      player.usingLaserBlaster = false;
      player.usingChainsaw = false;
      player.usingHealthBattery = false;
      player.usingGoldenApple = false;
      player.usingGoldenDrink = true;
      player.usingTechnoblade = false;
      player.bowDmg = 0;
      player.dmg = 0;
      player.rangeMult = 1.0;
    } else if (weapon?.laserBlaster) {
      player.usingBow = false;
      player.usingPhantomSniper = false;
      player.usingLaserBlast = false;
      player.usingGattling = false;
      player.usingRpg = false;
      player.usingLaserBlaster = true;
      player.usingChainsaw = false;
      player.usingHealthBattery = false;
      player.usingGoldenApple = false;
      player.usingGoldenDrink = false;
      player.usingTechnoblade = false;
      player.bowDmg = 0;
      player.dmg = 0;
      player.rangeMult = 1.0;
    } else if (weapon?.chainsaw) {
      player.usingBow = false;
      player.usingPhantomSniper = false;
      player.usingLaserBlast = false;
      player.usingGattling = false;
      player.usingRpg = false;
      player.usingLaserBlaster = false;
      player.usingChainsaw = true;
      player.usingHealthBattery = false;
      player.usingGoldenApple = false;
      player.usingGoldenDrink = false;
      player.usingTechnoblade = false;
      player.bowDmg = 0;
      player.dmg = 0;
      player.rangeMult = 1.0;
    } else if (weapon?.technoBlade) {
      player.usingBow = false;
      player.usingPhantomSniper = false;
      player.usingLaserBlast = false;
      player.usingGattling = false;
      player.usingRpg = false;
      player.usingLaserBlaster = false;
      player.usingChainsaw = false;
      player.usingHealthBattery = false;
      player.usingGoldenApple = false;
      player.usingGoldenDrink = false;
      player.usingTechnoblade = true;
      player.usingShadowBlade = false;
      player.bowDmg = 0;
      player.dmg = weapon?.dmg ?? 20;
      player.rangeMult = 1.0;
    } else if (weapon?.shadowBlade) {
      player.usingBow = false;
      player.usingPhantomSniper = false;
      player.usingLaserBlast = false;
      player.usingGattling = false;
      player.usingRpg = false;
      player.usingLaserBlaster = false;
      player.usingChainsaw = false;
      player.usingHealthBattery = false;
      player.usingGoldenApple = false;
      player.usingGoldenDrink = false;
      player.usingTechnoblade = false;
      player.usingShadowBlade = true;
      player.bowDmg = 0;
      player.dmg = weapon?.dmg ?? 18;
      player.rangeMult = 1.0;
    } else if (weapon?.rpg) {
      player.usingBow = false;
      player.usingPhantomSniper = false;
      player.usingLaserBlast = false;
      player.usingGattling = false;
      player.usingRpg = true;
      player.usingGoldenApple = false;
      player.usingGoldenDrink = false;
      player.usingShadowBlade = false;
      player.bowDmg = 0;
      player.dmg = 5;
      player.rangeMult = weapon?.rangeMult ?? 1.0;
    } else if (weapon?.gattling) {
      player.usingBow = false;
      player.usingPhantomSniper = false;
      player.usingLaserBlast = false;
      player.usingGattling = true;
      player.usingRpg = false;
      player.usingGoldenApple = false;
      player.usingGoldenDrink = false;
      player.usingShadowBlade = false;
      player.bowDmg = 0;
      player.dmg = 5;
      player.rangeMult = weapon?.rangeMult ?? 1.0;
    } else if (weapon?.laserBlast) {
      player.usingBow = false;
      player.usingPhantomSniper = false;
      player.usingLaserBlast = true;
      player.usingGattling = false;
      player.usingRpg = false;
      player.usingGoldenApple = false;
      player.usingGoldenDrink = false;
      player.usingShadowBlade = false;
      player.bowDmg = 0;
      player.dmg = 5;
      player.rangeMult = weapon?.rangeMult ?? 1.0;
    } else if (weapon?.phantomSniper) {
      player.usingBow = false;
      player.usingPhantomSniper = true;
      player.usingLaserBlast = false;
      player.usingGattling = false;
      player.usingRpg = false;
      player.usingGoldenApple = false;
      player.usingGoldenDrink = false;
      player.usingShadowBlade = false;
      player.bowDmg = 0;
      player.dmg = 5;
      player.rangeMult = weapon?.rangeMult ?? 1.0;
    } else if (weapon?.bow) {
      player.usingBow = true;
      player.usingPhantomSniper = false;
      player.usingLaserBlast = false;
      player.usingGattling = false;
      player.usingRpg = false;
      player.usingGoldenApple = false;
      player.usingGoldenDrink = false;
      player.usingShadowBlade = false;
      player.bowDmg = Number(weapon.bowDmg ?? 0);
      player.dmg = 5;
      player.rangeMult = weapon?.rangeMult ?? 1.0;
    } else {
      player.usingBow = false;
      player.usingPhantomSniper = false;
      player.usingLaserBlast = false;
      player.usingGattling = false;
      player.usingRpg = false;
      player.usingGoldenApple = false;
      player.usingGoldenDrink = false;
      player.usingShadowBlade = false;
      player.bowDmg = 0;
      player.dmg = 5 + (weapon?.dmg ?? 0);
      player.rangeMult = weapon?.rangeMult ?? 1.0;
    }
    player.rangeMult *= rangeBoost;
    player.speed = 170 * moveMult;
    player.dashMult = dashMult;

    const newMax = baseHp + hpBonus * armorHpMult;
    const delta = newMax - player.hpMax;
    player.hpMax = newMax;
    player.hp = clamp(player.hp + delta, 0, player.hpMax);

    if (fightHintEl) {
      const w = weapon;
      const slotLabel = activeWeaponSlot === "weapon1" ? "Weapon 1" : "Weapon 2";
      if (w?.phantomSniper) {
        fightHintEl.textContent = `${slotLabel} · ${w.name}: long-press ~0.4s on enemy → 70 dmg. Slide hit = blast (hurts all). CD ${(player.phantomCdMs / 1000).toFixed(1)}s`;
      } else if (w?.rpg) {
        fightHintEl.textContent = `${slotLabel} · ${w.name}: rocket shot (80 direct / 30 blast). Enemies dodge. CD 3.0s`;
      } else if (w?.gattling) {
        fightHintEl.textContent = `${slotLabel} · ${w.name}: 10-shot burst, 7 dmg/shot. CD 3.0s`;
      } else if (w?.laserBlast) {
        fightHintEl.textContent = `${slotLabel} · ${w.name}: red laser shot, 5 dmg. CD 3.0s`;
      } else if (w?.bow) {
        fightHintEl.textContent = `${slotLabel} · ${w.name}: ${player.bowDmg} dmg/arrow (auto-aim). Cooldown: 1.0s`;
      } else if (w?.goldenApple) {
        fightHintEl.textContent = `${slotLabel} · ${w.name}: heal 20 HP, once per match.`;
      } else if (w?.goldenDrink) {
        fightHintEl.textContent = `${slotLabel} · ${w.name}: heal 12 HP, up to 3 uses per match.`;
      } else if (w?.shadowBlade) {
        fightHintEl.textContent = `${slotLabel} · ${w.name}: +18 hit. DOT 1%/2%/3% max HP/s (S3 capped 25/s); sustained S3 heals 10% chip dmg.`;
      } else {
        fightHintEl.textContent = `${slotLabel} · Equipped weapon damage: ${player.dmg}. Cooldown: 1.0s`;
      }
    }
  };

  const rollApocMob = (x, y) => {
    const r = Math.random();
    if (r < 0.28) return makeDog(x, y);
    if (r < 0.5) return makeSkeleton(x, y);
    if (r < 0.72) return makeTechnoDog(x, y);
    return makeZombie(x, y);
  };

  const randomApocSpawnPoint = () => {
    const boxes = getSlideBoxes();
    for (let t = 0; t < 48; t++) {
      const x = 52 + Math.random() * (world.w - 104);
      const y = 52 + Math.random() * (world.h - 104);
      let ok = true;
      for (const box of boxes) {
        if (circleIntersectsAabb(x, y, 24, box)) {
          ok = false;
          break;
        }
      }
      if (ok) return { x, y };
    }
    return { x: world.w * 0.5, y: world.h * 0.5 };
  };

  const spawnApocalypseWave = () => {
    const n = 3 + (apocWave - 1);
    dogs = [];
    for (let i = 0; i < n; i++) {
      const p = randomApocSpawnPoint();
      dogs.push(rollApocMob(p.x, p.y));
    }
  };

  const reset = () => {
    activeWeaponSlot = "weapon1";
    titanQuakes = [];
    meteors = [];
    powerCloneBeams = [];
    showHitboxes = false;
    fightMoneyMult = 1;
    goldenEnemy = false;
    if (fightMode === "zombie" && fightStarted) {
      dogs = [makeZombie(world.w * 0.72, world.h * 0.42)];
    } else if (fightMode === "apocalypse" && fightStarted) {
      apocWave = 1;
      spawnApocalypseWave();
    } else if (fightMode === "armytechno" && fightStarted) {
      dogs = [makeArmyTechnoDog(world.w * 0.76, world.h * 0.45)];
    } else if (fightMode === "titanzombie" && fightStarted) {
      dogs = [makeTitanZombie(world.w * 0.74, world.h * 0.42)];
    } else if (fightMode === "galaxywarrior" && fightStarted) {
      dogs = [makeGalaxyWarrior(world.w * 0.74, world.h * 0.42)];
    }

    // Safety net: never allow a started fight to run with an empty mob list.
    if (fightStarted && dogs.length === 0) {
      if (fightMode === "single") dogs = [makeDog(world.w * 0.75, world.h * 0.45)];
      else if (fightMode === "horde") {
        dogs = [
          makeDog(world.w * 0.72, world.h * 0.4),
          makeDog(world.w * 0.8, world.h * 0.52),
          makeDog(world.w * 0.7, world.h * 0.58),
        ];
      } else if (fightMode === "techno") dogs = [makeTechnoDog(world.w * 0.76, world.h * 0.45)];
      else if (fightMode === "skeleton") dogs = [makeSkeleton(world.w * 0.78, world.h * 0.42)];
      else if (fightMode === "zombie") dogs = [makeZombie(world.w * 0.72, world.h * 0.42)];
      else if (fightMode === "armytechno") dogs = [makeArmyTechnoDog(world.w * 0.76, world.h * 0.45)];
      else if (fightMode === "titanzombie") dogs = [makeTitanZombie(world.w * 0.74, world.h * 0.42)];
      else if (fightMode === "galaxywarrior") dogs = [makeGalaxyWarrior(world.w * 0.74, world.h * 0.42)];
      else if (fightMode === "apocalypse") spawnApocalypseWave();
    }

    player.hp = player.hpMax;
    player.cdLeft = 0;
    player.dashCdLeft = 0;
    player.goldenAppleUsedMatch = false;
    player.goldenDrinkUsesLeft = 3;
    if (fightMode === "apocalypse") {
      player.x = world.w * 0.5;
      player.y = world.h * 0.5;
    } else {
      player.x = world.w * 0.25;
      player.y = world.h * 0.65;
    }

    for (const d of dogs) {
      d.hp = d.hpMax;
      d.cdLeft = 0;
      d.mode = "charge";
      d.retreatLeft = 0;
      d.rewarded = false;
      if (d.kind === "techno") {
        d.attackIndex = 0;
        d.nextActionInMs = 1000;
        d.laserActiveMs = 0;
      }
      if (d.kind === "skeleton") {
        d.shootCdLeft = 600;
      }
      if (d.kind === "zombie") {
        d.summonCdLeft = 5000;
        d._zombiePhase2 = false;
      }
      if (d.kind === "titanZombie") {
        d.summonCdLeft = 2500;
        d.smashCdLeft = 3500;
        d.chargeActive = false;
      }
      if (d.kind === "galaxyWarrior") {
        d.meteorCdLeft = 1800;
        d.meteorShotsLeft = 0;
        d.meteorShotCdLeft = 0;
        d.pathWp = null;
        d.pathRecalcMs = 0;
      }
    }

    gameOver = false;
    rewardGranted = false;
    arrows = [];
    phantomBullets = [];
    rockets = [];
    phantomLongPressStart = null;
    phantomLockedTarget = null;
    phantomUniversalBlastMs = 0;
    player.gattlingShotsLeft = 0;
    player.gattlingShotCdLeft = 0;
    player.laserFxMs = 0;
    player.laserFxFrom = null;
    player.laserFxTo = null;
    if (terrainType === "playground" || terrainType === "apocalypse" || terrainType === "military") {
      slideDestroyed = false;
      slideLaserMs = 0;
      slideExplosionMs = 0;
    }
    applyLoadout();
  };

  const setUi = () => {
    const pPct = clamp(player.hp / player.hpMax, 0, 1) * 100;
    const barDogs =
      fightMode === "zombie"
        ? dogs.filter((d) => d.kind !== "zombieDog")
        : fightMode === "titanzombie"
          ? dogs.filter((d) => d.kind !== "titanZombieDog")
          : fightMode === "galaxywarrior"
            ? dogs.filter((d) => d.kind !== "galaxyWarrior" || d.gwIsReal)
            : dogs;
    const totalMax = barDogs.reduce((a, d) => a + d.hpMax, 0) || 1;
    const totalHp = barDogs.reduce((a, d) => a + Math.max(0, d.hp), 0);
    const dPct = clamp(totalHp / totalMax, 0, 1) * 100;
    if (ui.playerFill) ui.playerFill.style.width = `${pPct}%`;
    if (ui.dogFill) ui.dogFill.style.width = `${dPct}%`;
    if (ui.dogFill) ui.dogFill.style.background = goldenEnemy ? "linear-gradient(90deg,#d9b55a,#f1d07a)" : "";
    if (ui.playerText) ui.playerText.textContent = `${player.hp} / ${player.hpMax}`;
    if (ui.dogText) ui.dogText.textContent = `${totalHp} / ${totalMax}`;

    const pReady = player.cdLeft <= 0 ? "ready" : `${(player.cdLeft / 1000).toFixed(1)}s`;
    const cdPool =
      fightMode === "zombie"
        ? dogs.filter((d) => d.kind !== "zombieDog")
        : fightMode === "titanzombie"
          ? dogs.filter((d) => d.kind !== "titanZombieDog")
          : fightMode === "galaxywarrior"
            ? dogs.filter((d) => d.kind !== "galaxyWarrior" || d.gwIsReal)
            : dogs;
    const dogCdLeft = cdPool.reduce((m, d) => Math.min(m, d.cdLeft ?? 0), Infinity);
    const dReady = dogCdLeft <= 0 ? "ready" : `${(dogCdLeft / 1000).toFixed(1)}s`;
    const dashReady = player.dashCdLeft <= 0 ? "ready" : `${(player.dashCdLeft / 1000).toFixed(1)}s`;
    if (ui.cooldowns) ui.cooldowns.textContent = `CD: you ${pReady} | dash ${dashReady} | dog ${dReady}`;
    updateMoneyUi();

    // armor buttons enabled only if owned
    const s = loadSave();
    const owned = !!s.armor?.ownedSet;
    const eq = s.armor?.equipped ?? { helmet: false, chest: false, legs: false, boots: false };
    for (const [k, btn] of Object.entries(armorUi)) {
      if (!btn) continue;
      btn.disabled = !owned;
      btn.classList.toggle("is-on", !!eq[k]);
    }

    if (arenaTerrainLabel) {
      if (!fightStarted) arenaTerrainLabel.textContent = "Terrain: —";
      else if (terrainType === "apocalypse")
        arenaTerrainLabel.textContent = `Apocalypse · open map ${world.w}×${world.h} · 4 slides`;
      else if (terrainType === "paintball") arenaTerrainLabel.textContent = "Terrain: Paintball Arena (7 bunkers)";
      else if (terrainType === "military") arenaTerrainLabel.textContent = "Terrain: Military Training Base Arena";
      else arenaTerrainLabel.textContent = slideDestroyed ? "Terrain: Playground (slide destroyed)" : "Terrain: Playground (slide is solid)";
    }

    if (fightStarted && player.usingPhantomSniper) {
      canvas.style.cursor = "none";
    } else {
      canvas.style.cursor = "";
    }
    updateMobileOverlay();
  };

  const onKey = (e, down) => {
    const t = e.target;
    const isTypingTarget =
      t &&
      (t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT" ||
        (typeof t.isContentEditable === "boolean" && t.isContentEditable));
    if (isTypingTarget) return;

    const k = e.key.toLowerCase();
    if (down && (k === "scrolllock" || k === "e")) {
      activeWeaponSlot = activeWeaponSlot === "weapon1" ? "weapon2" : "weapon1";
      applyLoadout();
      setUi();
      const eq = loadEquipped();
      const itemId = eq[activeWeaponSlot];
      const itemName = itemId && ITEMS[itemId] ? ITEMS[itemId].name : "Fists";
      const slotName = activeWeaponSlot === "weapon1" ? "Weapon 1" : "Weapon 2";
      setStatus(`Switched to ${slotName}: ${itemName}`);
      e.preventDefault();
      return;
    }

    // Powers hotkeys (triggered by ".js")
    if (down && fightStarted && !gameOver && isTriggerOn(".js")) {
      if (k === "x") {
        showHitboxes = !showHitboxes;
        setStatus(showHitboxes ? "Hitboxes: ON" : "Hitboxes: OFF");
        e.preventDefault();
        return;
      }
      if (k === "v") {
        goldenEnemy = true;
        fightMoneyMult = 2;
        setStatus("Golden enemy: money x2");
        e.preventDefault();
        return;
      }
      if (k === "z") {
        const target = getNearestAliveDog();
        if (!target) return;
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const n = Math.hypot(dx, dy) || 1;
        const ux = dx / n;
        const uy = dy / n;
        for (let i = 0; i < 10; i++) {
          const spread = (Math.random() * 2 - 1) * 0.16;
          const ca = Math.cos(spread);
          const sa = Math.sin(spread);
          const sx = ux * ca - uy * sa;
          const sy = ux * sa + uy * ca;
          meteors.push({
            x: player.x + sx * 26,
            y: player.y + sy * 26,
            vx: sx * GALAXY_METEOR_SPEED,
            vy: sy * GALAXY_METEOR_SPEED,
            dmg: 10,
            r: 7,
            ttlMs: 5200,
            ally: true,
          });
        }
        setStatus("Powers: meteor volley!");
        e.preventDefault();
        return;
      }
      if (k === "c") {
        const target = getNearestAliveDog();
        if (!target) return;
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const n = Math.hypot(dx, dy) || 1;
        const dir = { x: dx / n, y: dy / n };
        if (rightMouseDown) {
          // C + RMB: become clones then shoot 5 lasers
          powerCloneBeams = [];
          const count = 5;
          for (let i = 0; i < count; i++) {
            const ang = (Math.PI * 2 * i) / count;
            const px = clamp(player.x + Math.cos(ang) * 26, 20, world.w - 20);
            const py = clamp(player.y + Math.sin(ang) * 26, 20, world.h - 20);
            powerCloneBeams.push({ x: px, y: py, dir, leftMs: 1800 });
          }
          setStatus("Powers: clone lasers!");
        } else {
          // C: gigantic laser 10s, 20 dmg/s
          player.powerBeamLeftMs = 10000;
          player.powerBeamDir = dir;
          setStatus("Powers: giga laser!");
        }
        e.preventDefault();
        return;
      }
    }

    const map = { arrowup: "w", arrowdown: "s", arrowleft: "a", arrowright: "d" };
    const kk = map[k] ?? k;
    if (["w", "a", "s", "d"].includes(kk)) {
      if (down) keys.add(kk);
      else keys.delete(kk);
      e.preventDefault();
    }
    if (down && kk === "r") {
      reset();
      setStatus("Fight reset");
    }
    if (down && kk === "q") {
      tryDash();
      e.preventDefault();
    }
  };

  window.addEventListener("keydown", (e) => onKey(e, true));
  window.addEventListener("keyup", (e) => onKey(e, false));

  const mobNameFrom = (d) =>
    d.kind === "skeleton"
      ? "Skeleton"
      : d.kind === "techno"
        ? "Techno Super Dog"
        : d.kind === "armyTechno"
          ? "Army Techno Dog"
        : d.kind === "titanZombie"
          ? "Titan Zombie"
        : d.kind === "galaxyWarrior"
          ? "Galaxy Warrior"
        : d.kind === "zombie"
          ? "Zombie"
          : d.kind === "zombieDog"
            ? "Zombie Dog"
            : d.kind === "titanZombieDog"
              ? "Titan Zombie Dog"
            : "Rogue Dog";

  const PHANTOM_LONG_PRESS_MS = 420;
  const LASER_LONG_PRESS_MS = 420;
  const POWER_LONG_PRESS_MS = 420;
  const PHANTOM_BLAST_RADIUS = 170;
  const PHANTOM_BLAST_DMG = 50;
  const TITAN_QUAKE_FOLLOW_MS = 1000;
  const TITAN_QUAKE_BLAST_MS = 500;
  const TITAN_QUAKE_DMG = 3;
  const TITAN_QUAKE_BLAST_RADIUS = Math.round(PHANTOM_BLAST_RADIUS * 0.3);

  const GALAXY_METEOR_DMG = 10;
  const GALAXY_METEOR_SPEED = 230;
  const GALAXY_METEOR_INTERVAL_MS = 120;
  const GALAXY_LASER_DPS = 8;
  const GALAXY_LASER_HALF_W = 16;
  const GALAXY_LASER_LEN = 4000;
  const GALAXY_SLIDE_BOMB_DMG = 30;
  const GALAXY_SLIDE_BOMB_HIT_MS = 500;

  const POWER_TOOL_ACTIVE_MS = 4000;
  const POWER_TOOL_RELOAD_MS = 2000;
  const LASER_BLASTER_DPS = 11;
  const CHAINSAW_DPS = 20;
  const CHAINSAW_RANGE_PAD = 55;
  const TECHNO_BLADE_BEAM_MS = 1000;
  const TECHNO_BLADE_BEAM_DPS = 18;

  const triggerGalaxySplit = (real) => {
    if (!real || real.kind !== "galaxyWarrior") return false;
    if (!real.gwIsReal) return false;
    if (real.gwSplitDone) return false;
    if (!fightStarted || gameOver) return false;
    if (real.hp <= 0) return false;
    if (real.hp > 500) return false;

    real.gwSplitDone = true;
    const clones = [real];
    for (let i = 0; i < 5; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rr = 22 + Math.random() * 18;
      const c = makeGalaxyWarrior(
        clamp(real.x + Math.cos(ang) * rr, 40, world.w - 40),
        clamp(real.y + Math.sin(ang) * rr, 40, world.h - 40),
      );
      c.hp = real.hp;
      c.gwIsReal = false;
      c.gwSplitDone = true;
      c.gwPhase = "run";
      c.gwPhaseLeftMs = 1100 + Math.random() * 400;
      c.gwAim = null;
      c.gwSlideHitMs = {};
      clones.push(c);
      dogs.push(c);
    }
    for (const g of clones) {
      g.gwPhase = "run";
      g.gwPhaseLeftMs = 1100 + Math.random() * 400;
      g.gwAim = null;
      g.gwSlideHitMs = {};
      g.pathWp = { x: 60 + Math.random() * (world.w - 120), y: 60 + Math.random() * (world.h - 120) };
      g.pathRecalcMs = 0;
    }
    setStatus("Galaxy Warrior split into clones!");
    return true;
  };

  const canMobTakeDamage = (d0) => {
    if (!d0) return false;
    if (d0.hp <= 0) return false;
    if (d0.kind !== "galaxyWarrior") return true;
    if (!d0.gwIsReal) return false;
    if (d0.gwPhase === "laser") return false;
    return true;
  };

  const applyMobDamage = (d0, dmg) => {
    if (!canMobTakeDamage(d0)) return false;
    if (dmg <= 0) return false;
    d0.hp = clamp(d0.hp - dmg, 0, d0.hpMax);
    if (d0.kind === "galaxyWarrior" && d0.gwIsReal && !d0.gwSplitDone && d0.hp > 0 && d0.hp <= 500) {
      triggerGalaxySplit(d0);
    }
    return true;
  };
  const clearShadowDot = (d0) => {
    if (!d0) return;
    d0.shadowDotStage = 0;
    d0.shadowDotLeftMs = 0;
    d0.shadowComboWindowMs = 0;
    d0.shadowStage3Sustain = false;
  };
  const isShadowBladeSingleTargetMode = () => fightMode === "apocalypse" || dogs.filter((d0) => d0.hp > 0).length > 1;
  const applyShadowBladeHit = (d0) => {
    if (!d0 || d0.hp <= 0) return;
    const singleTargetMode = isShadowBladeSingleTargetMode();
    const current = player.shadowBladeTarget;
    const currentActive =
      !!current &&
      current.hp > 0 &&
      (current.shadowDotStage ?? 0) > 0 &&
      (current.shadowDotLeftMs ?? 0) > 0;
    if (singleTargetMode && currentActive && current !== d0) {
      clearShadowDot(current);
      clearShadowDot(d0);
      d0.shadowDotStage = 1;
      d0.shadowDotLeftMs = 3000;
      d0.shadowComboWindowMs = 1500;
      d0.shadowStage3Sustain = false;
      player.shadowBladeTarget = d0;
      return;
    }
    if (singleTargetMode && (!currentActive || !current)) {
      clearShadowDot(d0);
      d0.shadowDotStage = 1;
      d0.shadowDotLeftMs = 3000;
      d0.shadowComboWindowMs = 1500;
      d0.shadowStage3Sustain = false;
      player.shadowBladeTarget = d0;
      return;
    }
    const stage = Number(d0.shadowDotStage || 0);
    const stageActive = (d0.shadowDotLeftMs || 0) > 0;
    const comboOpen = (d0.shadowComboWindowMs || 0) > 0;
    let nextStage = 1;
    let nextLeftMs = 3000;
    if (stage === 1 && stageActive) {
      nextStage = 2;
      nextLeftMs = 3000;
      d0.shadowStage3Sustain = false;
    } else if (stage === 2 && stageActive) {
      if (comboOpen) {
        nextStage = 3;
        nextLeftMs = 3000;
        d0.shadowStage3Sustain = false;
      } else {
        nextStage = 2;
        nextLeftMs = 3000;
        d0.shadowStage3Sustain = false;
      }
    } else if (stage >= 3 && stageActive) {
      nextStage = 3;
      nextLeftMs = comboOpen ? 2000 : Math.max(1200, d0.shadowDotLeftMs || 0);
      if (comboOpen) d0.shadowStage3Sustain = true;
    }
    d0.shadowDotStage = nextStage;
    d0.shadowDotLeftMs = nextLeftMs;
    d0.shadowComboWindowMs = 1500;
    if (singleTargetMode) player.shadowBladeTarget = d0;
  };

  const findFirstBlockingObstacle = (x1, y1, x2, y2, obs) => {
    for (const b of obs) {
      if (segmentIntersectsAabb(x1, y1, x2, y2, b)) return b;
    }
    return null;
  };

  const pickWaypointAroundBox = (fromX, fromY, goalX, goalY, box, margin) => {
    const pts = [
      { x: box.x - margin, y: box.y - margin },
      { x: box.x + box.w + margin, y: box.y - margin },
      { x: box.x - margin, y: box.y + box.h + margin },
      { x: box.x + box.w + margin, y: box.y + box.h + margin },
    ];
    let best = null;
    let bestScore = Infinity;
    for (const p of pts) {
      const x = clamp(p.x, margin, world.w - margin);
      const y = clamp(p.y, margin, world.h - margin);
      const score = Math.hypot(goalX - x, goalY - y) + 0.35 * Math.hypot(fromX - x, fromY - y);
      if (score < bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
    return best;
  };

  const spawnTitanQuakes = (boss) => {
    const waves = 8;
    for (let i = 0; i < waves; i++) {
      const ang = (Math.PI * 2 * i) / waves + (Math.random() * 0.26 - 0.13);
      const speed = 165 + Math.random() * 55;
      titanQuakes.push({
        x: boss.x,
        y: boss.y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        ageMs: 0,
        phase: "follow",
      });
    }
    setStatus("Titan Zombie smashed the ground!");
  };

  const screenToWorld = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const lx = (clientX - rect.left) * scaleX;
    const ly = (clientY - rect.top) * scaleY;
    if ((terrainType === "apocalypse" || terrainType === "military") && fightStarted) {
      return { x: lx + lastCamX, y: ly + lastCamY };
    }
    return { x: lx, y: ly };
  };

  const getDogUnderWorldPos = (wx, wy) => {
    for (const d0 of dogs) {
      if (d0.hp <= 0) continue;
      if (d0.kind === "galaxyWarrior" && !d0.gwIsReal) continue;
      if (Math.hypot(wx - d0.x, wy - d0.y) <= d0.r + 10) return d0;
    }
    return null;
  };

  const getNearestAliveDog = () => {
    let best = null;
    let bestD = Infinity;
    for (const d0 of dogs) {
      if (d0.hp <= 0) continue;
      if (d0.kind === "galaxyWarrior" && !d0.gwIsReal) continue;
      const dd = Math.hypot(d0.x - player.x, d0.y - player.y);
      if (dd < bestD) {
        bestD = dd;
        best = d0;
      }
    }
    return best;
  };

  const triggerPhantomUniversalExplosion = (cx, cy, hitSlideBox = null) => {
    phantomUniversalBlastMs = 780;
    phantomUniversalBlastX = cx;
    phantomUniversalBlastY = cy;
    const R = PHANTOM_BLAST_RADIUS;
    const splash = PHANTOM_BLAST_DMG;
    if (hitSlideBox) {
      const ppx = clamp(player.x, hitSlideBox.x, hitSlideBox.x + hitSlideBox.w);
      const ppy = clamp(player.y, hitSlideBox.y, hitSlideBox.y + hitSlideBox.h);
      const pDist = Math.hypot(player.x - ppx, player.y - ppy);
      // "2 player lengths" => 2 * (diameter) => 4 * radius.
      if (pDist <= player.r * 4) {
        player.hp = clamp(player.hp - splash, 0, player.hpMax);
      }
      for (const d0 of dogs) {
        if (d0.hp <= 0) continue;
        const dx = clamp(d0.x, hitSlideBox.x, hitSlideBox.x + hitSlideBox.w);
        const dy = clamp(d0.y, hitSlideBox.y, hitSlideBox.y + hitSlideBox.h);
        const dDist = Math.hypot(d0.x - dx, d0.y - dy);
        // "2 monster lengths" => 2 * (diameter) => 4 * radius.
        if (dDist <= d0.r * 4) {
          applyMobDamage(d0, splash);
        }
      }
    } else {
      // Fallback radial behavior if no slide box was provided.
      player.hp = clamp(player.hp - splash, 0, player.hpMax);
      for (const d0 of dogs) {
        if (d0.hp <= 0) continue;
        if (Math.hypot(d0.x - cx, d0.y - cy) <= R + d0.r) {
          applyMobDamage(d0, splash);
        }
      }
    }
    setStatus("Phantom round: slide detonation — all caught in the blast!");
    if (player.hp <= 0) {
      gameOver = true;
      setStatus("You were defeated");
    }
  };

  const firePhantomShot = (targetDog) => {
    if (!targetDog || targetDog.hp <= 0) return;
    const adx = targetDog.x - player.x;
    const ady = targetDog.y - player.y;
    const an = Math.hypot(adx, ady) || 1;
    const sp = 1250;
    const ux = adx / an;
    const uy = ady / an;
    phantomBullets.push({
      x: player.x + ux * 26,
      y: player.y + uy * 26,
      vx: ux * sp,
      vy: uy * sp,
      r: 4,
      dmg: 70,
    });
    setStatus("Phantom round away!");
  };

  const explodeRpg = (cx, cy, directTarget = null) => {
    for (const d0 of dogs) {
      if (d0.hp <= 0) continue;
      const dist = Math.hypot(d0.x - cx, d0.y - cy);
      let dmg = 0;
      if (directTarget && d0 === directTarget) dmg = 80;
      else if (dist <= 95 + d0.r) dmg = 30;
      if (dmg > 0) applyMobDamage(d0, dmg);
    }
    setStatus("RPG explosion!");
  };

  const fireRpg = (targetDog) => {
    if (!targetDog || targetDog.hp <= 0) return;
    const adx = targetDog.x - player.x;
    const ady = targetDog.y - player.y;
    const an = Math.hypot(adx, ady) || 1;
    const ux = adx / an;
    const uy = ady / an;
    rockets.push({
      x: player.x + ux * 22,
      y: player.y + uy * 22,
      vx: ux * 520,
      vy: uy * 520,
      r: 6,
      ally: true,
    });
    setStatus("RPG launched!");
  };

  const fireLaserBlast = (targetDog) => {
    if (!targetDog || targetDog.hp <= 0) return;
    const adx = targetDog.x - player.x;
    const ady = targetDog.y - player.y;
    const an = Math.hypot(adx, ady) || 1;
    const ux = adx / an;
    const uy = ady / an;
    const x2 = player.x + ux * 4000;
    const y2 = player.y + uy * 4000;
    let bestHit = null;
    let bestDist = Infinity;
    for (const d0 of dogs) {
      if (d0.hp <= 0) continue;
      const dist = distancePointToSegment(d0.x, d0.y, player.x, player.y, x2, y2);
      if (dist <= d0.r + 6) {
        const dAlong = Math.hypot(d0.x - player.x, d0.y - player.y);
        if (dAlong < bestDist) {
          bestDist = dAlong;
          bestHit = d0;
        }
      }
    }
    if (bestHit) {
      const ok = applyMobDamage(bestHit, 5);
      if (ok) setStatus(`Laser Blast hit ${mobNameFrom(bestHit)} for 5`);
    } else {
      setStatus("Laser Blast fired");
    }
    player.laserFxMs = 180;
    player.laserFxFrom = { x: player.x, y: player.y };
    player.laserFxTo = { x: x2, y: y2 };
  };

  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      mouseDown = true;
      if (player.usingPhantomSniper && fightStarted && !gameOver) {
        const { x: wx, y: wy } = screenToWorld(e.clientX, e.clientY);
        phantomAimX = wx;
        phantomAimY = wy;
        phantomLongPressStart = performance.now();
        phantomLockedTarget = getDogUnderWorldPos(wx, wy);
      }
      if (player.usingLaserBlast && fightStarted && !gameOver) {
        const { x: wx, y: wy } = screenToWorld(e.clientX, e.clientY);
        laserLongPressStart = performance.now();
        laserLockedTarget = getDogUnderWorldPos(wx, wy);
      }
      if ((player.usingLaserBlaster || player.usingChainsaw || player.usingTechnoblade) && fightStarted && !gameOver) {
        const { x: wx, y: wy } = screenToWorld(e.clientX, e.clientY);
        powerLongPressStart = performance.now();
        powerLockedTarget = getDogUnderWorldPos(wx, wy);
      }
    }
    if (e.button === 2) {
      e.preventDefault();
      rightMouseDown = true;
      tryDash();
    }
  });
  canvas.addEventListener("mousemove", (e) => {
    const { x: wx, y: wy } = screenToWorld(e.clientX, e.clientY);
    phantomAimX = wx;
    phantomAimY = wy;
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  const updateStickFromTouch = (clientX, clientY) => {
    if (!mobileStick) return;
    const rect = mobileStick.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const maxDist = Math.max(14, rect.width * 0.35);
    const dist = Math.hypot(dx, dy);
    const scale = dist > maxDist ? maxDist / dist : 1;
    const tx = dx * scale;
    const ty = dy * scale;
    mobileStickState.x = maxDist > 0 ? tx / maxDist : 0;
    mobileStickState.y = maxDist > 0 ? ty / maxDist : 0;
    if (mobileStickKnob) mobileStickKnob.style.transform = `translate(${tx}px, ${ty}px)`;
  };
  if (mobileStick) {
    mobileStick.addEventListener(
      "touchstart",
      (e) => {
        if (!isMobileModeActive() || !fightStarted || gameOver) return;
        const t = e.changedTouches[0];
        if (!t) return;
        mobileStickPointerId = t.identifier;
        updateStickFromTouch(t.clientX, t.clientY);
        e.preventDefault();
      },
      { passive: false }
    );
    mobileStick.addEventListener(
      "touchmove",
      (e) => {
        if (mobileStickPointerId == null) return;
        for (const t of e.changedTouches) {
          if (t.identifier !== mobileStickPointerId) continue;
          updateStickFromTouch(t.clientX, t.clientY);
          e.preventDefault();
          break;
        }
      },
      { passive: false }
    );
  }
  if (mobileAttackZone) {
    mobileAttackZone.addEventListener(
      "touchstart",
      (e) => {
        if (!isMobileModeActive() || !fightStarted || gameOver) return;
        const t = e.changedTouches[0];
        if (!t) return;
        mobileAttackPointerId = t.identifier;
        mouseDown = true;
        tryPlayerAttack();
        e.preventDefault();
      },
      { passive: false }
    );
  }
  window.addEventListener(
    "touchmove",
    (e) => {
      if (mobileStickPointerId == null) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== mobileStickPointerId) continue;
        updateStickFromTouch(t.clientX, t.clientY);
        e.preventDefault();
        break;
      }
    },
    { passive: false }
  );
  window.addEventListener("touchend", (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === mobileStickPointerId) {
        mobileStickPointerId = null;
        resetMobileStick();
      }
      if (t.identifier === mobileAttackPointerId) {
        mobileAttackPointerId = null;
        mouseDown = false;
      }
    }
  });
  window.addEventListener("touchcancel", (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === mobileStickPointerId) {
        mobileStickPointerId = null;
        resetMobileStick();
      }
      if (t.identifier === mobileAttackPointerId) {
        mobileAttackPointerId = null;
        mouseDown = false;
      }
    }
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 2) rightMouseDown = false;
    if (e.button !== 0) return;
    if (
      player.usingPhantomSniper &&
      fightStarted &&
      !gameOver &&
      phantomLongPressStart != null &&
      phantomLockedTarget &&
      player.phantomCdLeft <= 0
    ) {
      const dur = performance.now() - phantomLongPressStart;
      if (dur >= PHANTOM_LONG_PRESS_MS && phantomLockedTarget.hp > 0) {
        firePhantomShot(phantomLockedTarget);
        player.phantomCdLeft = player.phantomCdMs;
      }
    }
    if (
      player.usingLaserBlast &&
      fightStarted &&
      !gameOver &&
      laserLongPressStart != null &&
      player.cdLeft <= 0
    ) {
      const dur = performance.now() - laserLongPressStart;
      const target = (laserLockedTarget && laserLockedTarget.hp > 0 ? laserLockedTarget : getNearestAliveDog());
      if (dur >= LASER_LONG_PRESS_MS && target && target.hp > 0) {
        player.cdLeft = 3000;
        fireLaserBlast(target);
      }
    }
    if (
      (player.usingLaserBlaster || player.usingChainsaw || player.usingTechnoblade) &&
      fightStarted &&
      !gameOver &&
      powerLongPressStart != null
    ) {
      const dur = performance.now() - powerLongPressStart;
      const target = (powerLockedTarget && powerLockedTarget.hp > 0 ? powerLockedTarget : getNearestAliveDog());
      if (dur >= POWER_LONG_PRESS_MS && target && target.hp > 0) {
        if (player.usingTechnoblade) {
          player.technoBeamLeftMs = TECHNO_BLADE_BEAM_MS;
          const dx = target.x - player.x;
          const dy = target.y - player.y;
          const n = Math.hypot(dx, dy) || 1;
          player.technoBeamDir = { x: dx / n, y: dy / n };
          setStatus("Technoblade beam!");
        } else if (player.powerReloadLeftMs <= 0 && player.powerActiveLeftMs <= 0) {
          player.powerActiveKind = player.usingLaserBlaster ? "laser_blaster" : "chainsaw";
          player.powerActiveLeftMs = POWER_TOOL_ACTIVE_MS;
          player.powerReloadLeftMs = POWER_TOOL_ACTIVE_MS + POWER_TOOL_RELOAD_MS;
          player.powerLockedTarget = target;
          setStatus(player.powerActiveKind === "laser_blaster" ? "Laser Blaster online!" : "Chainsaw rev!");
        } else {
          setStatus("Reloading...");
        }
      }
    }
    phantomLongPressStart = null;
    phantomLockedTarget = null;
    laserLongPressStart = null;
    laserLockedTarget = null;
    powerLongPressStart = null;
    powerLockedTarget = null;
    mouseDown = false;
  });

  const tryPlayerAttack = () => {
    if (!fightStarted) return;
    if (gameOver) return;
    if (player.usingPhantomSniper) return;
    if (player.usingLaserBlast) return; // Laser Blast is fired via long-press
    if (player.usingLaserBlaster || player.usingChainsaw || player.usingTechnoblade) return; // fired via long-press
    if (player.cdLeft > 0) return;
    if (player.usingHealthBattery) {
      const heal = Math.max(1, Math.ceil(player.hpMax * 0.2));
      player.hp = clamp(player.hp + heal, 0, player.hpMax);
      // consume (one-use): clear equipped slot and/or decrement inventory
      const s = normalizeSave(loadSave());
      const eq = s.equipped ?? { helmet: null, chest: null, legs: null, boots: null, weapon1: null, weapon2: null };
      const slot = activeWeaponSlot;
      if (eq[slot] === "health_battery") eq[slot] = null;
      if (s.inventory?.counts?.health_battery) {
        s.inventory.counts.health_battery = Math.max(0, (s.inventory.counts.health_battery || 0) - 1);
      }
      s.equipped = eq;
      saveGame(s);
      updateWeaponsSlots();
      applyLoadout();
      setUi();
      setStatus(`Health Battery used! +${heal} HP`);
      player.cdLeft = 500;
      return;
    }
    if (player.usingGoldenApple) {
      if (player.goldenAppleUsedMatch) {
        setStatus("Golden Apple already used this match.");
        return;
      }
      player.hp = clamp(player.hp + 20, 0, player.hpMax);
      player.goldenAppleUsedMatch = true;
      setUi();
      setStatus("Golden Apple used! +20 HP");
      player.cdLeft = 500;
      return;
    }
    if (player.usingGoldenDrink) {
      if ((player.goldenDrinkUsesLeft ?? 0) <= 0) {
        setStatus("Golden Drink has no uses left this match.");
        return;
      }
      player.hp = clamp(player.hp + 12, 0, player.hpMax);
      player.goldenDrinkUsesLeft = Math.max(0, (player.goldenDrinkUsesLeft ?? 0) - 1);
      setUi();
      setStatus(`Golden Drink used! +12 HP (${player.goldenDrinkUsesLeft} use left)`);
      player.cdLeft = 500;
      return;
    }
    let best = null;
    let bestD = Infinity;
    for (const d0 of dogs) {
      if (d0.hp <= 0) continue;
      const d = len(d0.x - player.x, d0.y - player.y);
      if (d < bestD) {
        bestD = d;
        best = d0;
      }
    }
    if (!best) return;

    if (player.usingRpg) {
      player.cdLeft = 3000;
      fireRpg(best);
      return;
    }
    if (player.usingGattling) {
      player.cdLeft = 1000;
      player.gattlingShotsLeft = 10;
      player.gattlingShotCdLeft = 0;
      setStatus("Gattling burst!");
      return;
    }

    if (player.usingBow) {
      player.cdLeft = player.cdMs;
      const adx = best.x - player.x;
      const ady = best.y - player.y;
      const an = Math.hypot(adx, ady) || 1;
      const sp = 480;
      const ux = adx / an;
      const uy = ady / an;
      arrows.push({
        x: player.x + ux * 22,
        y: player.y + uy * 22,
        vx: ux * sp,
        vy: uy * sp,
        dmg: player.bowDmg,
        r: 5,
        ally: true,
      });
      setStatus(`Arrow → ${mobNameFrom(best)} (${player.bowDmg} dmg)`);
      return;
    }

    const range = (player.r + best.r + 16) * (player.rangeMult ?? 1.0);
    if (bestD > range) return; // melee range
    player.cdLeft = player.cdMs;
    const ok = applyMobDamage(best, player.dmg);
    if (ok) {
      if (player.usingShadowBlade) applyShadowBladeHit(best);
      setStatus(`Hit ${mobNameFrom(best)} for ${player.dmg}`);
    }
  };

  const tryDash = () => {
    if (!fightStarted) return;
    if (gameOver) return;
    if (player.dashCdLeft > 0) return;

    const dashDist = 88 * (player.dashMult ?? 1.0); // "launch forward a bit"
    const d = Math.hypot(lastMove.x, lastMove.y) || 1;
    const ux = lastMove.x / d;
    const uy = lastMove.y / d;
    let nx = player.x + ux * dashDist;
    let ny = player.y + uy * dashDist;
    nx = clamp(nx, player.r, world.w - player.r);
    ny = clamp(ny, player.r, world.h - player.r);
    const solid = getSolidObstacles();
    const pushed = resolveCircleVsObstacles({ x: nx, y: ny }, player.r, solid);
    player.x = pushed.x;
    player.y = pushed.y;
    player.dashCdLeft = player.dashCdMs;
    setStatus("Dash!");
  };

  const dogHitPlayer = () => {
    if (!fightStarted) return;
    if (gameOver) return;
    for (const d0 of dogs) {
      if (d0.hp <= 0) continue;
      if (d0.kind === "skeleton" || d0.kind === "techno" || d0.kind === "armyTechno" || d0.kind === "titanZombie" || d0.kind === "galaxyWarrior")
        continue;
      if (d0.cdLeft > 0) continue;
      const d = len(d0.x - player.x, d0.y - player.y);
      if (d > player.r + d0.r + 10) continue;
      d0.cdLeft = d0.cdMs;
      player.hp = clamp(player.hp - d0.dmg, 0, player.hpMax);
      d0.mode = "retreat";
      d0.retreatLeft = d0.justHitRetreatMs;
      setStatus(`${mobNameFrom(d0)} hit you for ${d0.dmg}`);
      if (player.hp <= 0) {
        gameOver = true;
        setStatus("You were defeated");
      }
      break;
    }
  };

  const distancePointToSegment = (px, py, x1, y1, x2, y2) => {
    const vx = x2 - x1;
    const vy = y2 - y1;
    const wx = px - x1;
    const wy = py - y1;
    const vv = vx * vx + vy * vy || 1;
    let t = (wx * vx + wy * vy) / vv;
    t = clamp(t, 0, 1);
    const cx = x1 + vx * t;
    const cy = y1 + vy * t;
    return Math.hypot(px - cx, py - cy);
  };

  const segmentIntersectsAabb = (x1, y1, x2, y2, box) => {
    // Liang-Barsky clipping for line segment vs AABB
    const dx = x2 - x1;
    const dy = y2 - y1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - box.x, box.x + box.w - x1, y1 - box.y, box.y + box.h - y1];
    let u1 = 0;
    let u2 = 1;
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return false;
      } else {
        const t = q[i] / p[i];
        if (p[i] < 0) {
          if (t > u2) return false;
          if (t > u1) u1 = t;
        } else {
          if (t < u1) return false;
          if (t < u2) u2 = t;
        }
      }
    }
    return true;
  };

  const segmentClipAabbT = (x1, y1, x2, y2, box) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - box.x, box.x + box.w - x1, y1 - box.y, box.y + box.h - y1];
    let u1 = 0;
    let u2 = 1;
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return null;
      } else {
        const t = q[i] / p[i];
        if (p[i] < 0) {
          if (t > u2) return null;
          if (t > u1) u1 = t;
        } else {
          if (t < u1) return null;
          if (t < u2) u2 = t;
        }
      }
    }
    return { tEnter: u1, tExit: u2 };
  };

  const clipLaserToSlides = (x1, y1, x2, y2) => {
    const boxes = getSlideBoxes();
    if (!boxes.length) return { x: x2, y: y2 };
    let bestT = 1;
    for (const box of boxes) {
      const hit = segmentClipAabbT(x1, y1 - 2, x2, y2, box);
      if (hit && hit.tEnter >= 0 && hit.tEnter < bestT) bestT = hit.tEnter;
    }
    return { x: x1 + (x2 - x1) * bestT, y: y1 + (y2 - y1) * bestT };
  };

  const technoAttackStep = (d0, dtMs) => {
    if (d0.hp <= 0 || gameOver || !fightStarted) return;
    d0.nextActionInMs -= dtMs;

    if (d0.laserActiveMs > 0) {
      d0.laserActiveMs = Math.max(0, d0.laserActiveMs - dtMs);
      // Laser keeps aiming while active.
      const adx = player.x - d0.x;
      const ady = player.y - d0.y;
      const an = Math.hypot(adx, ady) || 1;
      d0.laserDir = { x: adx / an, y: ady / an };
      const ux = d0.laserDir.x;
      const uy = d0.laserDir.y;
      const x1 = d0.x;
      const y1 = d0.y;
      const x2 = d0.x + ux * d0.laserLen;
      const y2 = d0.y + uy * d0.laserLen;
      const dist = distancePointToSegment(player.x, player.y, x1, y1, x2, y2);
      const slideBoxes = getSlideBoxes();
      let blockedBySlide = false;
      for (const box of slideBoxes) {
        if (segmentIntersectsAabb(x1, y1, player.x, player.y, box)) {
          blockedBySlide = true;
          break;
        }
      }
      if (!blockedBySlide && dist <= player.r + d0.laserHalfW) {
        player.hp = clamp(player.hp - d0.laserDps * (dtMs / 1000), 0, player.hpMax);
        if (player.hp <= 0) {
          gameOver = true;
          setStatus("You were defeated");
        }
      }

    if (terrainType === "playground" && !slideDestroyed) {
        const hitsSlide = segmentIntersectsAabb(x1, y1, x2, y2, world.slide);
        if (hitsSlide) {
          slideLaserMs += dtMs;
          if (slideLaserMs >= 3000) {
            slideDestroyed = true;
            slideExplosionMs = 850;
            const cx = world.slide.x + world.slide.w / 2;
            const cy = world.slide.y + world.slide.h / 2;
            const blastR = 160;
            const pd = Math.hypot(player.x - cx, player.y - cy);
            if (pd <= blastR) {
              player.hp = clamp(player.hp - 50, 0, player.hpMax);
              if (player.hp <= 0) {
                gameOver = true;
                setStatus("You were defeated by slide explosion");
                return;
              }
            }
            setStatus("Slide exploded!");
          }
        } else {
          // must be sustained beam time
          slideLaserMs = 0;
        }
      }
    }

    if ((d0.gattlingShots ?? 0) > 0) {
      d0.gattlingShotCdMs = Math.max(0, (d0.gattlingShotCdMs ?? 0) - dtMs);
      while (d0.gattlingShots > 0 && d0.gattlingShotCdMs <= 0) {
        d0.gattlingShotCdMs = d0.gattlingIntervalMs ?? 90;
        d0.gattlingShots -= 1;
        const adx = player.x - d0.x;
        const ady = player.y - d0.y;
        const an = Math.hypot(adx, ady) || 1;
        const ux = adx / an;
        const uy = ady / an;
        const spread = (Math.random() * 2 - 1) * 0.5; // about 50% accurate
        const ca = Math.cos(spread);
        const sa = Math.sin(spread);
        const sx = ux * ca - uy * sa;
        const sy = ux * sa + uy * ca;
        const sp = 520;
        arrows.push({
          x: d0.x + sx * 28,
          y: d0.y + sy * 28,
          vx: sx * sp,
          vy: sy * sp,
          dmg: 5,
          r: 4,
        });
      }
      if (d0.gattlingShots <= 0) d0.gattlingBurstLeftMs = 0;
    }

    if (d0.nextActionInMs > 0 || gameOver) return;
    const action = d0.attackPattern[d0.attackIndex % d0.attackPattern.length];
    d0.attackIndex += 1;
    if (action === "bite") {
      const d = len(d0.x - player.x, d0.y - player.y);
      if (d <= player.r + d0.r + 14) {
        player.hp = clamp(player.hp - d0.dmg, 0, player.hpMax);
        d0.mode = "retreat";
        d0.retreatLeft = 1400; // clear run-away window after biting
        if (player.hp <= 0) {
          gameOver = true;
          setStatus("You were defeated");
          return;
        }
      }
      setStatus(d0.kind === "armyTechno" ? "Army Techno Dog used Bite" : "Techno Super Dog used Bite");
      d0.nextActionInMs = 1000;
      return;
    }
    if (action === "gattling") {
      d0.gattlingShots = 10;
      d0.gattlingShotCdMs = 0;
      d0.gattlingBurstLeftMs = 1300;
      d0.nextActionInMs = 1600;
      setStatus("Army Techno Dog used Rapid Gattling Shot");
      return;
    }
    // laser
    const dx = player.x - d0.x;
    const dy = player.y - d0.y;
    const n = Math.hypot(dx, dy) || 1;
    d0.laserDir = { x: dx / n, y: dy / n };
    const isArmy = d0.kind === "armyTechno";
    d0.laserActiveMs = isArmy ? 3000 : 5000;
    d0.nextActionInMs = isArmy ? 4000 : 6000; // active + 1s interval
    setStatus(isArmy ? "Army Techno Dog fired Super Laser" : "Techno Super Dog fired Laser");
  };

  function step(dt) {
    animT += dt;
    const cam = getCameraOffset();
    lastCamX = cam.x;
    lastCamY = cam.y;
    slideExplosionMs = Math.max(0, slideExplosionMs - dt * 1000);
    phantomUniversalBlastMs = Math.max(0, phantomUniversalBlastMs - dt * 1000);
    // cooldowns
    player.cdLeft = Math.max(0, player.cdLeft - dt * 1000);
    player.phantomCdLeft = Math.max(0, player.phantomCdLeft - dt * 1000);
    player.dashCdLeft = Math.max(0, player.dashCdLeft - dt * 1000);
    player.gattlingShotCdLeft = Math.max(0, player.gattlingShotCdLeft - dt * 1000);
    player.laserFxMs = Math.max(0, player.laserFxMs - dt * 1000);
    player.powerActiveLeftMs = Math.max(0, (player.powerActiveLeftMs ?? 0) - dt * 1000);
    player.powerReloadLeftMs = Math.max(0, (player.powerReloadLeftMs ?? 0) - dt * 1000);
    player.technoBeamLeftMs = Math.max(0, (player.technoBeamLeftMs ?? 0) - dt * 1000);
    player.powerBeamLeftMs = Math.max(0, (player.powerBeamLeftMs ?? 0) - dt * 1000);
    if (player.powerReloadLeftMs <= 0 && player.powerActiveLeftMs <= 0) {
      player.powerActiveKind = null;
      player.powerLockedTarget = null;
    }
    if (powerCloneBeams.length) {
      powerCloneBeams = powerCloneBeams
        .map((b) => ({ ...b, leftMs: Math.max(0, (b.leftMs ?? 0) - dt * 1000) }))
        .filter((b) => b.leftMs > 0);
    }
    for (const d0 of dogs) d0.cdLeft = Math.max(0, d0.cdLeft - dt * 1000);
    for (const d0 of dogs) {
      d0.shadowDotLeftMs = Math.max(0, (d0.shadowDotLeftMs ?? 0) - dt * 1000);
      d0.shadowComboWindowMs = Math.max(0, (d0.shadowComboWindowMs ?? 0) - dt * 1000);
      if ((d0.shadowDotLeftMs ?? 0) > 0 && (d0.shadowDotStage ?? 0) > 0) {
        const stage = clamp((d0.shadowDotStage | 0), 1, 3);
        const pct = stage === 1 ? 0.01 : stage === 2 ? 0.02 : 0.03;
        let dps = (d0.hpMax || 0) * pct;
        if (stage === 3) dps = Math.min(dps, 25);
        const oldHp = d0.hp;
        applyMobDamage(d0, dps * dt);
        const dealt = Math.max(0, oldHp - d0.hp);
        if (stage === 3 && d0.shadowStage3Sustain && dealt > 0) {
          player.hp = clamp(player.hp + dealt * 0.1, 0, player.hpMax);
        }
      } else if ((d0.shadowDotStage ?? 0) > 0) {
        clearShadowDot(d0);
      }
    }
    if (isShadowBladeSingleTargetMode()) {
      const activeTarget =
        player.shadowBladeTarget &&
        player.shadowBladeTarget.hp > 0 &&
        (player.shadowBladeTarget.shadowDotStage ?? 0) > 0 &&
        (player.shadowBladeTarget.shadowDotLeftMs ?? 0) > 0
          ? player.shadowBladeTarget
          : null;
      if (!activeTarget) {
        player.shadowBladeTarget = null;
      } else {
        for (const d0 of dogs) {
          if (d0 === activeTarget) continue;
          if ((d0.shadowDotStage ?? 0) > 0 || (d0.shadowDotLeftMs ?? 0) > 0) clearShadowDot(d0);
        }
      }
    } else if (
      player.shadowBladeTarget &&
      (player.shadowBladeTarget.hp <= 0 ||
        (player.shadowBladeTarget.shadowDotStage ?? 0) <= 0 ||
        (player.shadowBladeTarget.shadowDotLeftMs ?? 0) <= 0)
    ) {
      player.shadowBladeTarget = null;
    }
    // Power tools continuous damage
    if (fightStarted && !gameOver && player.hp > 0) {
      if (player.powerActiveLeftMs > 0 && (player.powerActiveKind === "laser_blaster" || player.powerActiveKind === "chainsaw")) {
        let target = player.powerLockedTarget && player.powerLockedTarget.hp > 0 ? player.powerLockedTarget : null;
        if (!target) {
          let best = null;
          let bestD = Infinity;
          for (const d0 of dogs) {
            if (d0.hp <= 0) continue;
            const dd = Math.hypot(d0.x - player.x, d0.y - player.y);
            if (dd < bestD) {
              bestD = dd;
              best = d0;
            }
          }
          target = best;
        }
        if (target && target.hp > 0) {
          const d = Math.hypot(target.x - player.x, target.y - player.y);
          const inRange =
            player.powerActiveKind === "chainsaw" ? d <= player.r + target.r + CHAINSAW_RANGE_PAD : true;
          if (inRange) {
            const dps = player.powerActiveKind === "chainsaw" ? CHAINSAW_DPS : LASER_BLASTER_DPS;
            if (player.powerActiveKind === "laser_blaster") {
              // Techno-dog style beam: hit first mob along beam (blocked by slides).
              const dx = target.x - player.x;
              const dy = target.y - player.y;
              const n = Math.hypot(dx, dy) || 1;
              const ux = dx / n;
              const uy = dy / n;
              let x2 = player.x + ux * 4000;
              let y2 = player.y + uy * 4000;
              if ((terrainType === "playground" || terrainType === "apocalypse" || terrainType === "military") && !slideDestroyed) {
                const end = clipLaserToSlides(player.x, player.y - 2, x2, y2);
                x2 = end.x;
                y2 = end.y;
              }
              let bestHit = null;
              let bestDist = Infinity;
              for (const d0 of dogs) {
                if (d0.hp <= 0) continue;
                const dist = distancePointToSegment(d0.x, d0.y, player.x, player.y, x2, y2);
                if (dist <= d0.r + 6) {
                  const dAlong = Math.hypot(d0.x - player.x, d0.y - player.y);
                  if (dAlong < bestDist) {
                    bestDist = dAlong;
                    bestHit = d0;
                  }
                }
              }
              if (bestHit) applyMobDamage(bestHit, dps * dt);
              player.laserFxMs = Math.max(player.laserFxMs, 60);
              player.laserFxFrom = { x: player.x, y: player.y };
              player.laserFxTo = { x: x2, y: y2 };
            } else {
              applyMobDamage(target, dps * dt);
            }
          }
        }
      }
      if (player.technoBeamLeftMs > 0) {
        const ux = player.technoBeamDir?.x ?? 1;
        const uy = player.technoBeamDir?.y ?? 0;
        let x2 = player.x + ux * 4000;
        let y2 = player.y + uy * 4000;
        if ((terrainType === "playground" || terrainType === "apocalypse" || terrainType === "military") && !slideDestroyed) {
          const end = clipLaserToSlides(player.x, player.y - 2, x2, y2);
          x2 = end.x;
          y2 = end.y;
        }
        let bestHit = null;
        let bestDist = Infinity;
        for (const d0 of dogs) {
          if (d0.hp <= 0) continue;
          const dist = distancePointToSegment(d0.x, d0.y, player.x, player.y, x2, y2);
          if (dist <= d0.r + 6) {
            const dAlong = Math.hypot(d0.x - player.x, d0.y - player.y);
            if (dAlong < bestDist) {
              bestDist = dAlong;
              bestHit = d0;
            }
          }
        }
        if (bestHit) applyMobDamage(bestHit, TECHNO_BLADE_BEAM_DPS * dt);
        player.laserFxMs = Math.max(player.laserFxMs, 60);
        player.laserFxFrom = { x: player.x, y: player.y };
        player.laserFxTo = { x: x2, y: y2 };
      }

      if (player.powerBeamLeftMs > 0) {
        const ux = player.powerBeamDir?.x ?? 1;
        const uy = player.powerBeamDir?.y ?? 0;
        let x2 = player.x + ux * 4000;
        let y2 = player.y + uy * 4000;
        if ((terrainType === "playground" || terrainType === "apocalypse" || terrainType === "military") && !slideDestroyed) {
          const end = clipLaserToSlides(player.x, player.y - 2, x2, y2);
          x2 = end.x;
          y2 = end.y;
        }
        for (const d0 of dogs) {
          if (d0.hp <= 0) continue;
          const dist = distancePointToSegment(d0.x, d0.y, player.x, player.y, x2, y2);
          if (dist <= d0.r + 10) applyMobDamage(d0, 20 * dt);
        }
        player.laserFxMs = Math.max(player.laserFxMs, 60);
        player.laserFxFrom = { x: player.x, y: player.y };
        player.laserFxTo = { x: x2, y: y2 };
      }
    }
    for (const d0 of dogs) {
      if (d0.kind === "galaxyWarrior") {
        d0.meteorCdLeft = Math.max(0, (d0.meteorCdLeft ?? 0) - dt * 1000);
        d0.meteorShotCdLeft = Math.max(0, (d0.meteorShotCdLeft ?? 0) - dt * 1000);
        d0.pathRecalcMs = Math.max(0, (d0.pathRecalcMs ?? 0) - dt * 1000);
      }
    }

    if (player.gattlingShotsLeft > 0) {
      while (player.gattlingShotsLeft > 0 && player.gattlingShotCdLeft <= 0) {
        player.gattlingShotCdLeft = 90;
        player.gattlingShotsLeft -= 1;
        let best = null;
        let bestD = Infinity;
        for (const d0 of dogs) {
          if (d0.hp <= 0) continue;
          const dd = Math.hypot(d0.x - player.x, d0.y - player.y);
          if (dd < bestD) {
            bestD = dd;
            best = d0;
          }
        }
        if (!best) break;
        const adx = best.x - player.x;
        const ady = best.y - player.y;
        const an = Math.hypot(adx, ady) || 1;
        const ux = adx / an;
        const uy = ady / an;
        const spread = (Math.random() * 2 - 1) * 0.5;
        const ca = Math.cos(spread);
        const sa = Math.sin(spread);
        const sx = ux * ca - uy * sa;
        const sy = ux * sa + uy * ca;
        arrows.push({
          x: player.x + sx * 20,
          y: player.y + sy * 20,
          vx: sx * 520,
          vy: sy * 520,
          dmg: 7,
          r: 4,
          ally: true,
        });
      }
    }

    // player movement
    let vx = 0;
    let vy = 0;
    if (keys.has("w")) vy -= 1;
    if (keys.has("s")) vy += 1;
    if (keys.has("a")) vx -= 1;
    if (keys.has("d")) vx += 1;
    if (isMobileModeActive() && fightStarted && !gameOver) {
      vx += mobileStickState.x;
      vy += mobileStickState.y;
    }
    playerMoving = Math.hypot(vx, vy) > 0.05;
    const vlen = Math.hypot(vx, vy) || 1;
    vx /= vlen;
    vy /= vlen;
    if (playerMoving) {
      lastMove = { x: vx, y: vy };
    }
    let nx = player.x + vx * player.speed * dt;
    let ny = player.y + vy * player.speed * dt;
    nx = clamp(nx, player.r, world.w - player.r);
    ny = clamp(ny, player.r, world.h - player.r);
    const solidObs = getSolidObstacles();
    const pushedPlayer = resolveCircleVsObstacles({ x: nx, y: ny }, player.r, solidObs);
    player.x = pushedPlayer.x;
    player.y = pushedPlayer.y;

    // player attack (LMB)
    if (mouseDown) tryPlayerAttack();

    // dog AI
    if (fightStarted && !gameOver && player.hp > 0) {
      for (const d0 of dogs) {
        if (d0.hp <= 0) continue;
        if (d0.kind === "skeleton") {
          d0.speed = player.speed * 0.7;
          d0.shootCdLeft = Math.max(0, d0.shootCdLeft - dt * 1000);
          if (d0.shootCdLeft <= 0) {
            d0.shootCdLeft = d0.shootCdMs;
            const adx = player.x - d0.x;
            const ady = player.y - d0.y;
            const an = Math.hypot(adx, ady) || 1;
            const sp = 440;
            const ux = adx / an;
            const uy = ady / an;
            arrows.push({
              x: d0.x + ux * 26,
              y: d0.y + uy * 26,
              vx: ux * sp,
              vy: uy * sp,
              dmg: 20,
              r: 5,
            });
          }
        }
        if (d0.kind === "zombie" && fightMode === "zombie") {
          const phase2 = d0.hp < 60;
          d0.summonCdMs = phase2 ? 5000 : 10000;
          if (phase2 && !d0._zombiePhase2) {
            d0._zombiePhase2 = true;
            d0.summonCdLeft = Math.min(d0.summonCdLeft ?? 0, 5000);
          }
          if (!phase2) d0._zombiePhase2 = false;
          d0.summonCdLeft = Math.max(0, (d0.summonCdLeft ?? 0) - dt * 1000);
          if (d0.summonCdLeft <= 0 && d0.hp > 0) {
            d0.summonCdLeft = d0.summonCdMs;
            const zx = clamp(d0.x + (Math.random() * 120 - 60), 36, world.w - 36);
            const zy = clamp(d0.y + (Math.random() * 100 - 50), 36, world.h - 36);
            dogs.push(makeZombieDog(zx, zy));
            setStatus("Zombie summoned a zombie dog!");
          }
        }
        if (d0.kind === "titanZombie" && fightMode === "titanzombie") {
          d0.summonCdLeft = Math.max(0, (d0.summonCdLeft ?? d0.summonCdMs) - dt * 1000);
          if (d0.summonCdLeft <= 0 && d0.hp > 0) {
            d0.summonCdLeft = d0.summonCdMs;
            const sAng = Math.random() * Math.PI * 2;
            const sDist = 120 + Math.random() * 90;
            const zx = clamp(player.x + Math.cos(sAng) * sDist, 44, world.w - 44);
            const zy = clamp(player.y + Math.sin(sAng) * sDist, 44, world.h - 44);
            dogs.push(makeTitanZombieDog(zx, zy));
            setStatus("Titan Zombie summoned a Titan Zombie Dog!");
          }

          d0.smashCdLeft = Math.max(0, (d0.smashCdLeft ?? d0.smashCdMs) - dt * 1000);
          if (!d0.chargeActive && d0.smashCdLeft <= 0) {
            d0.chargeActive = true;
            d0.smashCdLeft = d0.smashCdMs;
          }
        }
        if (d0.kind === "galaxyWarrior" && fightMode === "galaxywarrior") {
          // Split once when real form drops below 500 HP.
          if (d0.gwIsReal && !d0.gwSplitDone && d0.hp > 0 && d0.hp <= 500) {
            triggerGalaxySplit(d0);
          }

          // Phase countdown (shared behavior)
          if (d0.gwPhase && d0.gwPhase !== "normal") {
            d0.gwPhaseLeftMs = Math.max(0, (d0.gwPhaseLeftMs ?? 0) - dt * 1000);
            if (d0.gwPhaseLeftMs <= 0) {
              if (d0.gwPhase === "run") {
                d0.gwPhase = "telegraph";
                d0.gwPhaseLeftMs = 1000;
                d0.gwAim = { x: player.x, y: player.y };
              } else if (d0.gwPhase === "telegraph") {
                d0.gwPhase = "laser";
                d0.gwPhaseLeftMs = 5000;
                d0.gwAim = { x: player.x, y: player.y };
                const dx = d0.gwAim.x - d0.x;
                const dy = d0.gwAim.y - d0.y;
                const n = Math.hypot(dx, dy) || 1;
                d0.gwLaserDir = { x: dx / n, y: dy / n };
              } else if (d0.gwPhase === "laser") {
                // After firing, come back and fight for a bit, then leave again.
                d0.gwPhase = "fight";
                d0.gwPhaseLeftMs = 1400 + Math.random() * 900;
                d0.gwAim = null;
                d0.gwSlideHitMs = {};
              } else if (d0.gwPhase === "fight") {
                d0.gwPhase = "run";
                d0.gwPhaseLeftMs = 950 + Math.random() * 650;
                d0.gwAim = null;
                d0.gwSlideHitMs = {};
                // New run target each cycle (each clone picks a different path).
                d0.pathWp = { x: 60 + Math.random() * (world.w - 120), y: 60 + Math.random() * (world.h - 120) };
                d0.pathRecalcMs = 0;
              }
            }
          }

          // Meteor volley: 10 consecutive slow meteors.
          if (d0.gwIsReal && (d0.gwPhase === "normal" || d0.gwPhase === "fight") && (d0.meteorShotsLeft ?? 0) > 0) {
            while (d0.meteorShotsLeft > 0 && (d0.meteorShotCdLeft ?? 0) <= 0) {
              d0.meteorShotCdLeft = GALAXY_METEOR_INTERVAL_MS;
              d0.meteorShotsLeft -= 1;
              const dx = player.x - d0.x;
              const dy = player.y - d0.y;
              const n = Math.hypot(dx, dy) || 1;
              const ux = dx / n;
              const uy = dy / n;
              const spread = (Math.random() * 2 - 1) * 0.16;
              const ca = Math.cos(spread);
              const sa = Math.sin(spread);
              const sx = ux * ca - uy * sa;
              const sy = ux * sa + uy * ca;
              meteors.push({
                x: d0.x + sx * 22,
                y: d0.y + sy * 22,
                vx: sx * GALAXY_METEOR_SPEED,
                vy: sy * GALAXY_METEOR_SPEED,
                dmg: GALAXY_METEOR_DMG,
                r: 7,
                ttlMs: 5200,
              });
            }
          } else if (d0.gwIsReal && (d0.gwPhase === "normal" || d0.gwPhase === "fight") && (d0.meteorCdLeft ?? 0) <= 0 && Math.random() < 0.03) {
            d0.meteorCdLeft = d0.meteorCdMs ?? 7000;
            d0.meteorShotsLeft = 10;
            d0.meteorShotCdLeft = 0;
            setStatus("Galaxy Warrior launched a meteor volley!");
          }
        }
        if (d0.kind === "techno" || d0.kind === "armyTechno") technoAttackStep(d0, dt * 1000);
        if (gameOver) break;
        let dx = player.x - d0.x;
        let dy = player.y - d0.y;
        let d = Math.hypot(dx, dy) || 1;

        if (rockets.some((r0) => Math.hypot(d0.x - r0.x, d0.y - r0.y) < 200)) {
          dx = d0.x - player.x;
          dy = d0.y - player.y;
          d = Math.hypot(dx, dy) || 1;
        }

        if ((d0.kind === "techno" || d0.kind === "armyTechno") && d0.laserActiveMs > 0) {
          // While beaming, keep a safe distance but continue aiming.
          const safeDist = 280;
          if (d < safeDist) {
            dx = -dx;
            dy = -dy;
          } else if (d > safeDist + 70) {
            // gently drift back in so it does not run to map edge forever
            dx = dx * 0.35;
            dy = dy * 0.35;
          } else {
            dx = 0;
            dy = 0;
          }
          d = Math.hypot(dx, dy) || 1;
        }
        if (d0.kind === "titanZombie") {
          const pref = player.r * 10;
          const close = pref - player.r * 2.5;
          const far = pref + player.r * 2.5;
          if (d0.chargeActive) {
            // Charge at 2x player speed, then smash when near ~3 player lengths.
            if (d <= player.r * 6) {
              d0.chargeActive = false;
              spawnTitanQuakes(d0);
              dx = 0;
              dy = 0;
              d = 1;
            } else {
              dx = player.x - d0.x;
              dy = player.y - d0.y;
              d = Math.hypot(dx, dy) || 1;
            }
          } else if (d < close) {
            // Keep distance from player by moving away.
            dx = d0.x - player.x;
            dy = d0.y - player.y;
            d = Math.hypot(dx, dy) || 1;
          } else if (d > far) {
            // Reposition back into summoning range.
            dx = player.x - d0.x;
            dy = player.y - d0.y;
            d = Math.hypot(dx, dy) || 1;
          } else {
            dx = 0;
            dy = 0;
            d = 1;
          }
        }

        if (d0.kind === "galaxyWarrior") {
          const desired = player.r * 10; // 5 player lengths (~10 radii)
          const near = desired * 0.55;
          const far = desired * 1.05;
          // Pathfinding-lite: if blocked, go around the first blocking obstacle corner.
          const obs = getSolidObstacles();
          const block = findFirstBlockingObstacle(d0.x, d0.y, player.x, player.y, obs);
          let tx = player.x;
          let ty = player.y;
          const isLocked = d0.gwPhase === "telegraph" || d0.gwPhase === "laser";
          const isRun = d0.gwPhase === "run";
          const isFight = d0.gwPhase === "fight" || d0.gwPhase === "normal";

          if (isLocked) {
            dx = 0;
            dy = 0;
            d = 1;
          } else {
            // Decide primary target.
            if (isRun && d0.pathWp) {
              tx = d0.pathWp.x;
              ty = d0.pathWp.y;
            }

            // If blocked, pick a corner waypoint around the blocker toward the current target.
            const block2 = findFirstBlockingObstacle(d0.x, d0.y, tx, ty, obs);
            if (block2) {
              if (!d0.pathWp || (d0.pathRecalcMs ?? 0) <= 0 || Math.hypot(d0.pathWp.x - d0.x, d0.pathWp.y - d0.y) < 28) {
                d0.pathWp = pickWaypointAroundBox(d0.x, d0.y, tx, ty, block2, Math.max(26, d0.r + 18));
                d0.pathRecalcMs = 240;
              }
              if (d0.pathWp) {
                tx = d0.pathWp.x;
                ty = d0.pathWp.y;
              }
            } else if (!isRun) {
              // In fight/normal, clear obstacle waypoint when unblocked.
              d0.pathWp = null;
            }

            const distToTx = Math.hypot(tx - d0.x, ty - d0.y);
            if (isRun && distToTx < 40) {
              // reached run target, pick a new one so each clone keeps taking unique routes
              d0.pathWp = { x: 60 + Math.random() * (world.w - 120), y: 60 + Math.random() * (world.h - 120) };
              tx = d0.pathWp.x;
              ty = d0.pathWp.y;
            }

            if (isFight) {
              if (d > far) {
                dx = tx - d0.x;
                dy = ty - d0.y;
                d = Math.hypot(dx, dy) || 1;
              } else if (d < near) {
                // stay aggressive but don't overlap: small strafe when too close
                const sgn = ((animT * 3) | 0) % 2 === 0 ? 1 : -1;
                const px = -(player.y - d0.y);
                const py = player.x - d0.x;
                const pn = Math.hypot(px, py) || 1;
                dx = (px / pn) * sgn;
                dy = (py / pn) * sgn;
                d = 1;
              } else {
                dx = tx - d0.x;
                dy = ty - d0.y;
                d = Math.hypot(dx, dy) || 1;
              }
            } else {
              // run: always move toward target
              dx = tx - d0.x;
              dy = ty - d0.y;
              d = Math.hypot(dx, dy) || 1;
            }
          }

          // Slash attack (very frequent)
          if (
            d0.gwIsReal &&
            (d0.gwPhase === "normal" || d0.gwPhase === "fight") &&
            d0.cdLeft <= 0 &&
            Math.hypot(player.x - d0.x, player.y - d0.y) <= player.r + d0.r + 18
          ) {
            const dmg = d0.dmg ?? 20;
            // Slash every 1s; if it connects, instantly slash again once.
            player.hp = clamp(player.hp - dmg, 0, player.hpMax);
            if (player.hp > 0 && Math.hypot(player.x - d0.x, player.y - d0.y) <= player.r + d0.r + 18) {
              player.hp = clamp(player.hp - dmg, 0, player.hpMax);
              setStatus(`Galaxy Warrior combo slashed you for ${dmg}×2`);
            } else {
              setStatus(`Galaxy Warrior slashed you for ${dmg}`);
            }
            d0.cdLeft = d0.cdMs ?? 1000;
            if (player.hp <= 0) {
              gameOver = true;
              setStatus("You were defeated");
              break;
            }
          }
        }

        if (d0.kind === "skeleton") {
          // Kite: move away from the player (arrows still aim at player separately).
          dx = d0.x - player.x;
          dy = d0.y - player.y;
          d = Math.hypot(dx, dy) || 1;
        } else if (d0.mode === "retreat") {
          d0.retreatLeft = Math.max(0, d0.retreatLeft - dt * 1000);
          dx = -dx;
          dy = -dy;
          d = Math.hypot(dx, dy) || 1;
          if (d0.retreatLeft <= 0 && d0.cdLeft <= 0) d0.mode = "charge";
        } else {
          if (d0.cdLeft > 0 && d < 170) {
            dx = -dx;
            dy = -dy;
            d = Math.hypot(dx, dy) || 1;
          }
          if (d0.cdLeft <= 0) d0.mode = "charge";
        }

        const ux = dx / d;
        const uy = dy / d;
        let moveSpd = d0.speed;
        if (d0.kind === "zombie") {
          moveSpd = player.speed * 1.08;
          if (d0.hp < 60) moveSpd *= 1.3;
          if (dogs.some((z) => z.kind === "zombieDog" && z.hp > 0)) moveSpd *= 0.48;
        } else if (d0.kind === "titanZombie") {
          moveSpd = d0.chargeActive ? player.speed * 2 : d0.speed;
        } else if (d0.kind === "galaxyWarrior") {
          moveSpd = (d0.gwPhase === "telegraph" || d0.gwPhase === "laser") ? 0 : d0.speed;
        }
        let ddx = ux * moveSpd * dt;
        let ddy = uy * moveSpd * dt;

        let dax = clamp(d0.x + ddx, d0.r, world.w - d0.r);
        let day = clamp(d0.y + ddy, d0.r, world.h - d0.r);
        const dogSolid = getSolidObstacles();
        const pushedDog = resolveCircleVsObstacles({ x: dax, y: day }, d0.r, dogSolid);
        d0.x = pushedDog.x;
        d0.y = pushedDog.y;
      }

      // Galaxy Warrior laser damage + slide bombs + merge cleanup (per-frame, after movement)
      if (fightMode === "galaxywarrior") {
        const slideBoxes = getSlideBoxes();
        for (const g0 of dogs) {
          if (g0.kind !== "galaxyWarrior" || g0.hp <= 0) continue;
          if (g0.gwPhase !== "laser") continue;

          const ux = g0.gwLaserDir?.x ?? 1;
          const uy = g0.gwLaserDir?.y ?? 0;
          const x1 = g0.x;
          const y1 = g0.y;
          const x2 = g0.x + ux * GALAXY_LASER_LEN;
          const y2 = g0.y + uy * GALAXY_LASER_LEN;

          const dist = distancePointToSegment(player.x, player.y, x1, y1, x2, y2);
          let blocked = false;
          for (const box of slideBoxes) {
            if (segmentIntersectsAabb(x1, y1, player.x, player.y, box)) {
              blocked = true;
              break;
            }
          }
          if (!blocked && dist <= player.r + GALAXY_LASER_HALF_W) {
            player.hp = clamp(player.hp - GALAXY_LASER_DPS * dt, 0, player.hpMax);
            if (player.hp <= 0) {
              gameOver = true;
              setStatus("You were defeated");
              break;
            }
          }

          // Slide bombs: if beam hits a slide for 0.5s, explode (30 dmg)
          for (let i = 0; i < slideBoxes.length; i++) {
            const box = slideBoxes[i];
            const hitsSlide = segmentIntersectsAabb(x1, y1, x2, y2, box);
            const key = String(i);
            const cur = g0.gwSlideHitMs?.[key] ?? 0;
            const next = hitsSlide ? cur + dt * 1000 : 0;
            g0.gwSlideHitMs[key] = next;
            if (hitsSlide && next >= GALAXY_SLIDE_BOMB_HIT_MS) {
              g0.gwSlideHitMs[key] = 0;
              const cx = box.x + box.w / 2;
              const cy = box.y + box.h / 2;
              slideExplosionMs = 450;
              const blastR = 140;
              const pd = Math.hypot(player.x - cx, player.y - cy);
              if (pd <= blastR) {
                player.hp = clamp(player.hp - GALAXY_SLIDE_BOMB_DMG, 0, player.hpMax);
                setStatus(`Slide bomb hit you for ${GALAXY_SLIDE_BOMB_DMG}`);
                if (player.hp <= 0) {
                  gameOver = true;
                  setStatus("You were defeated");
                  break;
                }
              }
            }
          }
          if (gameOver) break;
        }

        // Unclone only when the real one is under 10 HP.
        const real = dogs.find((d0) => d0.kind === "galaxyWarrior" && d0.gwIsReal);
        if (real && real.hp > 0 && real.hp < 10 && dogs.some((d0) => d0.kind === "galaxyWarrior" && !d0.gwIsReal)) {
          dogs = dogs.filter((d0) => d0.kind !== "galaxyWarrior" || d0.gwIsReal);
          real.gwPhase = "normal";
          real.gwAim = null;
          real.gwSlideHitMs = {};
          setStatus("Galaxy Warrior reformed!");
        }
      }

      if (arrows.length && !gameOver) {
        const nextArrows = [];
        const obs = getSolidObstacles();
        for (const a of arrows) {
          let x = a.x + a.vx * dt;
          let y = a.y + a.vy * dt;
          let dead = false;
          for (const box of obs) {
            if (circleIntersectsAabb(x, y, a.r, box)) {
              dead = true;
              break;
            }
          }
          if (dead) continue;
          if (x < -40 || x > world.w + 40 || y < -40 || y > world.h + 40) continue;

          if (a.ally) {
            let hitDog = false;
            for (const d0 of dogs) {
              if (d0.hp <= 0) continue;
              if (Math.hypot(x - d0.x, y - d0.y) <= d0.r + a.r) {
                const ok = applyMobDamage(d0, a.dmg);
                if (ok) setStatus(`Arrow hit ${mobNameFrom(d0)} for ${a.dmg}`);
                hitDog = true;
                break;
              }
            }
            if (hitDog) continue;
            nextArrows.push({ ...a, x, y });
            continue;
          }

          if (Math.hypot(x - player.x, y - player.y) <= player.r + a.r) {
            player.hp = clamp(player.hp - a.dmg, 0, player.hpMax);
            setStatus(`Skeleton arrow hit you for ${a.dmg}`);
            if (player.hp <= 0) {
              gameOver = true;
              setStatus("You were defeated");
            }
            continue;
          }
          nextArrows.push({ ...a, x, y });
        }
        arrows = nextArrows;
      }

      if (phantomBullets.length && !gameOver) {
        const nextPb = [];
        const slideBoxes = getSlideBoxes();
        for (const b of phantomBullets) {
          const ox = b.x;
          const oy = b.y;
          let x = ox + b.vx * dt;
          let y = oy + b.vy * dt;
          let consumed = false;
          for (const box of slideBoxes) {
            if (
              circleIntersectsAabb(x, y, b.r, box) ||
              segmentIntersectsAabb(ox, oy, x, y, box)
            ) {
              const hx = clamp(x, box.x, box.x + box.w);
              const hy = clamp(y, box.y, box.y + box.h);
              triggerPhantomUniversalExplosion(hx, hy, box);
              consumed = true;
              break;
            }
          }
          if (consumed) continue;
          for (const d0 of dogs) {
            if (d0.hp <= 0) continue;
            if (Math.hypot(x - d0.x, y - d0.y) <= d0.r + b.r) {
              const ok = applyMobDamage(d0, b.dmg);
              if (ok) setStatus(`Phantom round hit ${mobNameFrom(d0)} for ${b.dmg}`);
              consumed = true;
              break;
            }
          }
          if (consumed) continue;
          if (x < -80 || x > world.w + 80 || y < -80 || y > world.h + 80) continue;
          nextPb.push({ ...b, x, y });
        }
        phantomBullets = nextPb;
      }

      if (rockets.length && !gameOver) {
        const nextRockets = [];
        const obs = getSolidObstacles();
        for (const r0 of rockets) {
          let x = r0.x + r0.vx * dt;
          let y = r0.y + r0.vy * dt;
          let exploded = false;
          for (const box of obs) {
            if (circleIntersectsAabb(x, y, r0.r, box)) {
              explodeRpg(x, y, null);
              exploded = true;
              break;
            }
          }
          if (exploded) continue;
          for (const d0 of dogs) {
            if (d0.hp <= 0) continue;
            if (Math.hypot(x - d0.x, y - d0.y) <= d0.r + r0.r) {
              explodeRpg(x, y, d0);
              exploded = true;
              break;
            }
          }
          if (exploded) continue;
          if (x < -80 || x > world.w + 80 || y < -80 || y > world.h + 80) continue;
          nextRockets.push({ ...r0, x, y });
        }
        rockets = nextRockets;
      }

      if (meteors.length && !gameOver) {
        const nextM = [];
        const obs = getSolidObstacles();
        for (const m of meteors) {
          const ox = m.x;
          const oy = m.y;
          const x = ox + m.vx * dt;
          const y = oy + m.vy * dt;
          let dead = false;
          for (const box of obs) {
            if (circleIntersectsAabb(x, y, m.r, box) || segmentIntersectsAabb(ox, oy, x, y, box)) {
              dead = true;
              break;
            }
          }
          if (dead) continue;
          if (m.ally) {
            let hit = false;
            for (const d0 of dogs) {
              if (d0.hp <= 0) continue;
              if (Math.hypot(x - d0.x, y - d0.y) <= d0.r + m.r) {
                applyMobDamage(d0, m.dmg);
                hit = true;
                break;
              }
            }
            if (hit) continue;
          } else {
            if (Math.hypot(x - player.x, y - player.y) <= player.r + m.r) {
              player.hp = clamp(player.hp - m.dmg, 0, player.hpMax);
              setStatus(`Meteor hit you for ${m.dmg}`);
              if (player.hp <= 0) {
                gameOver = true;
                setStatus("You were defeated");
              }
              continue;
            }
          }
          const ttl = (m.ttlMs ?? 4500) - dt * 1000;
          if (ttl <= 0) continue;
          if (x < -120 || x > world.w + 120 || y < -120 || y > world.h + 120) continue;
          nextM.push({ ...m, x, y, ttlMs: ttl });
        }
        meteors = nextM;
      }

      if (titanQuakes.length && !gameOver) {
        const nextQuakes = [];
        for (const q of titanQuakes) {
          if (q.phase === "follow") {
            const tx = player.x;
            const ty = player.y;
            const qdx = tx - q.x;
            const qdy = ty - q.y;
            const qd = Math.hypot(qdx, qdy) || 1;
            const chase = 250;
            q.vx = (q.vx * 0.7) + (qdx / qd) * chase * 0.3;
            q.vy = (q.vy * 0.7) + (qdy / qd) * chase * 0.3;
            q.x = clamp(q.x + q.vx * dt, 8, world.w - 8);
            q.y = clamp(q.y + q.vy * dt, 8, world.h - 8);
            q.ageMs += dt * 1000;
            if (q.ageMs >= TITAN_QUAKE_FOLLOW_MS) {
              q.phase = "blast";
              q.ageMs = 0;
            }
            nextQuakes.push(q);
            continue;
          }
          q.ageMs += dt * 1000;
          const blastPct = clamp(1 - q.ageMs / TITAN_QUAKE_BLAST_MS, 0, 1);
          const distToPlayer = Math.hypot(player.x - q.x, player.y - q.y);
          const blastR = TITAN_QUAKE_BLAST_RADIUS * Math.max(0.45, blastPct);
          if (!q.didDamage && distToPlayer <= blastR + player.r) {
            q.didDamage = true;
            player.hp = clamp(player.hp - TITAN_QUAKE_DMG, 0, player.hpMax);
            setStatus(`Titan quake hit you for ${TITAN_QUAKE_DMG}`);
            if (player.hp <= 0) {
              gameOver = true;
              setStatus("You were defeated");
            }
          }
          if (q.ageMs < TITAN_QUAKE_BLAST_MS) nextQuakes.push(q);
        }
        titanQuakes = nextQuakes;
      }

      const hasTechno = dogs.some((d0) => (d0.kind === "techno" || d0.kind === "armyTechno") && d0.hp > 0);
      if (!hasTechno) dogHitPlayer();
    }

    // rewards + win condition
    if (fightStarted && !gameOver) {
      for (const d0 of dogs) {
        if (d0.hp <= 0 && !d0.rewarded) {
          d0.rewarded = true;
          const s = normalizeSave(loadSave());
          s.stats.totalEnemiesKilled = Number(s.stats.totalEnemiesKilled || 0) + 1;
          if (d0.kind === "zombieDog") s.stats.zombieDogKills = (s.stats.zombieDogKills || 0) + 1;
          else if (d0.kind === "titanZombieDog") s.stats.zombieDogKills = (s.stats.zombieDogKills || 0) + 1;
          else if (d0.kind !== "techno" && d0.kind !== "armyTechno" && d0.kind !== "skeleton" && d0.kind !== "zombie")
            s.stats.rogueKills += 1;
          saveGame(s);
          refreshSettingsStats?.();
        }
      }
      if (fightMode === "galaxywarrior") {
        const realGw = dogs.find((d0) => d0.kind === "galaxyWarrior" && d0.gwIsReal);
        if (realGw && realGw.hp <= 0) {
          dogs = dogs.filter((d0) => !(d0.kind === "galaxyWarrior" && !d0.gwIsReal));
        }
      }
      const alive =
        fightMode === "galaxywarrior"
          ? dogs.some((d0) => d0.kind === "galaxyWarrior" && d0.gwIsReal && d0.hp > 0)
          : dogs.some((d0) => d0.hp > 0);
      if (!alive) {
        if (fightMode === "apocalypse") {
          const cash = 300 + (apocWave - 1) * 200;
          const mc = apocWave >= 5 ? apocWave - 4 : 0;
          addMoney(cash);
          if (mc > 0) addMagicoin(mc);
          apocWave += 1;
          spawnApocalypseWave();
          player.hp = player.hpMax;
          arrows = [];
          phantomBullets = [];
          gameOver = false;
          rewardGranted = false;
          if (enemyLabel) enemyLabel.textContent = `Apocalypse · Wave ${apocWave}`;
          setStatus(`Wave ${apocWave - 1} cleared! +$${cash}${mc > 0 ? ` +${mc} magicoin` : ""}`);
          runForeverTaskEngine();
        } else {
          gameOver = true;
          const s = normalizeSave(loadSave());
          s.stats.totalWins += 1;
          if (fightMode === "horde") s.stats.hordeWins += 1;
          else if (fightMode === "techno") s.stats.technoWins += 1;
          else if (fightMode === "skeleton") s.stats.skeletonWins += 1;
          else if (fightMode === "zombie") s.stats.zombieWins += 1;
          else if (fightMode === "armytechno") s.stats.technoWins += 1;
          else if (fightMode === "titanzombie") s.stats.zombieWins += 1;
          else if (fightMode === "galaxywarrior") s.stats.technoWins += 1;
          else s.stats.singleWins += 1;
          saveGame(s);
          if (!rewardGranted) {
            rewardGranted = true;
            if (fightMode === "horde") addMoney(50);
            else if (fightMode === "skeleton") addMoney(70);
            else if (fightMode === "zombie") addMoney(100);
            else if (fightMode === "armytechno") {
              addMoney(300 * fightMoneyMult);
              const r = Math.random();
              const crates = r < 0.7 ? 1 : r < 0.95 ? 2 : 3;
              const s2 = normalizeSave(loadSave());
              const got = [];
              const gotIds = [];
              for (let i = 0; i < crates; i++) {
                const itemId = rollBossCrateLoot();
                ensureItemInInventory(s2, itemId);
                gotIds.push(itemId);
                got.push(ITEMS[itemId]?.name || itemId);
              }
              s2.stats.bossCrates = (s2.stats.bossCrates || 0) + crates;
              saveGame(s2);
              updateWeaponsSlots();
              revealBossCrateRewards?.(gotIds);
              setStatus(`Victory! +$300 | Boss Crates opened: ${crates} → ${got.join(", ")}`);
            }
            else if (fightMode === "titanzombie") {
              const r = Math.random();
              const crates = r < 0.7 ? 2 : r < 0.95 ? 3 : 4;
              const s2 = normalizeSave(loadSave());
              const got = [];
              const gotIds = [];
              for (let i = 0; i < crates; i++) {
                const itemId = rollBossCrateLoot();
                ensureItemInInventory(s2, itemId);
                gotIds.push(itemId);
                got.push(ITEMS[itemId]?.name || itemId);
              }
              s2.stats.bossCrates = (s2.stats.bossCrates || 0) + crates;
              saveGame(s2);
              updateWeaponsSlots();
              revealBossCrateRewards?.(gotIds);
              setStatus(`Titan Zombie defeated! Boss Crates opened: ${crates} → ${got.join(", ")}`);
            }
            else if (fightMode === "galaxywarrior") {
              addMoney(400 * fightMoneyMult);
              addMagicoin(5);
              const r = Math.random();
              const crates = r < 0.7 ? 3 : r < 0.95 ? 4 : 5;
              const s2 = normalizeSave(loadSave());
              const got = [];
              const gotIds = [];
              for (let i = 0; i < crates; i++) {
                const itemId = rollBossCrateLoot();
                ensureItemInInventory(s2, itemId);
                gotIds.push(itemId);
                got.push(ITEMS[itemId]?.name || itemId);
              }
              s2.stats.bossCrates = (s2.stats.bossCrates || 0) + crates;
              saveGame(s2);
              updateWeaponsSlots();
              revealBossCrateRewards?.(gotIds);
              setStatus(`Galaxy Warrior defeated! +$400 +5 magicoin | Boss Crates opened: ${crates} → ${got.join(", ")}`);
            }
            else addMoney(10 * fightMoneyMult);
          }
          runForeverTaskEngine();
          if (fightMode !== "armytechno" && fightMode !== "titanzombie" && fightMode !== "galaxywarrior") setStatus("Victory");
        }
      }
    }

    setUi();
  }

  function draw() {
    const vw = canvas.width;
    const vh = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, vw, vh);

    if (!fightStarted) {
      // Before selection: pure black + prompt
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, vw, vh);
      ctx.fillStyle = "rgba(234,240,255,.92)";
      ctx.font = "26px ui-sans-serif, system-ui, Segoe UI";
      ctx.fillText("choose a enemy!", vw / 2 - 108, vh / 2 - 6);
      ctx.fillStyle = "rgba(234,240,255,.70)";
      ctx.font = "13px ui-monospace, Menlo, Consolas, monospace";
      ctx.fillText("Click a mob in list or use Gamemodes tab", vw / 2 - 182, vh / 2 + 18);
      // show player preview only
      drawPlayer(ctx, player, animT, lastMove);
      return;
    }

    const cam = getCameraOffset();
    const camX = cam.x;
    const camY = cam.y;

    ctx.save();
    ctx.translate(-camX, -camY);

    const W = world.w;
    const H = world.h;

    if (terrainType === "paintball") {
      ctx.fillStyle = "#14091c";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,255,255,.12)";
      ctx.lineWidth = 1;
      const grid = 36;
      for (let x = 0; x <= W; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y <= H; y += grid) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      for (const b of paintballObstacles) {
        ctx.fillStyle = "#1b4332";
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = "rgba(255,255,255,.4)";
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
        ctx.fillStyle = "rgba(255,64,160,.28)";
        ctx.beginPath();
        ctx.arc(b.x + b.w * 0.33, b.y + b.h * 0.38, Math.min(b.w, b.h) * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(64,200,255,.22)";
        ctx.beginPath();
        ctx.arc(b.x + b.w * 0.67, b.y + b.h * 0.58, Math.min(b.w, b.h) * 0.11, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (terrainType === "apocalypse" || terrainType === "military") {
      ctx.fillStyle = "#0a0608";
      ctx.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += 14) {
        for (let x = 0; x < W; x += 14) {
          const n = ((x * 73856093) ^ (y * 19349663)) >>> 0;
          const t = (n % 100) / 100;
          const g = 12 + Math.floor(t * 14);
          ctx.fillStyle = `rgb(${g + 8},${g + 4},${g + 6})`;
          ctx.fillRect(x, y, 14, 14);
        }
      }
      const drawSlideBox = (s) => {
        ctx.fillStyle = "rgba(124,92,255,.18)";
        ctx.fillRect(s.x - 8, s.y - 8, s.w + 16, s.h + 16);
        ctx.fillStyle = "#1A2350";
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.strokeStyle = "rgba(37,228,255,.45)";
        ctx.lineWidth = 3;
        ctx.strokeRect(s.x + 1.5, s.y + 1.5, s.w - 3, s.h - 3);
        ctx.fillStyle = "rgba(37,228,255,.15)";
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(s.x + 18 + i * 38, s.y + 16, 10, s.h - 32);
        }
        ctx.fillStyle = "rgba(234,240,255,.55)";
        ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
        ctx.fillText("SLIDE", s.x + 12, s.y + 18);
      };
      for (const s of world.slides) drawSlideBox(s);
      if (terrainType === "military") {
        for (const b of militaryObstacles) {
          ctx.fillStyle = "#324433";
          ctx.fillRect(b.x, b.y, b.w, b.h);
          ctx.strokeStyle = "rgba(190,230,170,.35)";
          ctx.lineWidth = 2;
          ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
        }
      }
    } else {
      // playground ground
      ctx.fillStyle = "#07141C";
      ctx.fillRect(0, 0, W, H);

      // grass tiles (pixel-ish)
      for (let y = 0; y < H; y += 12) {
        for (let x = 0; x < W; x += 12) {
          const n = ((x * 73856093) ^ (y * 19349663)) >>> 0;
          const t = (n % 100) / 100;
          const g = 18 + Math.floor(t * 18);
          ctx.fillStyle = `rgb(7,${g + 30},${g + 18})`;
          ctx.fillRect(x, y, 12, 12);
        }
      }

      // slide (solid until destroyed)
      const s = world.slide;
      if (!slideDestroyed) {
        ctx.fillStyle = "rgba(124,92,255,.18)";
        ctx.fillRect(s.x - 8, s.y - 8, s.w + 16, s.h + 16);
        ctx.fillStyle = "#1A2350";
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.strokeStyle = "rgba(37,228,255,.45)";
        ctx.lineWidth = 3;
        ctx.strokeRect(s.x + 1.5, s.y + 1.5, s.w - 3, s.h - 3);

        ctx.fillStyle = "rgba(37,228,255,.15)";
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(s.x + 18 + i * 38, s.y + 16, 10, s.h - 32);
        }
        ctx.fillStyle = "rgba(234,240,255,.55)";
        ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
        ctx.fillText("SLIDE (solid)", s.x + 12, s.y + 18);
      } else {
        // rubble marker
        ctx.fillStyle = "rgba(80,80,90,.35)";
        ctx.fillRect(s.x + 24, s.y + s.h / 2 + 22, s.w - 48, 18);
      }

      if (slideExplosionMs > 0) {
        const cx = s.x + s.w / 2;
        const cy = s.y + s.h / 2;
        const t = slideExplosionMs / 850;
        const r = (1 - t) * 170;
        ctx.fillStyle = `rgba(255,120,70,${(0.28 * t).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,230,150,${(0.9 * t).toFixed(3)})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(24, r - 8), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (titanQuakes.length) {
      for (const q of titanQuakes) {
        if (q.phase === "follow") {
          ctx.strokeStyle = "rgba(120,70,45,.7)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(q.x - 8, q.y - 6);
          ctx.lineTo(q.x + 6, q.y + 5);
          ctx.lineTo(q.x - 4, q.y + 10);
          ctx.stroke();
        } else {
          const t = q.ageMs / TITAN_QUAKE_BLAST_MS;
          const r = (1 - t) * TITAN_QUAKE_BLAST_RADIUS;
          ctx.fillStyle = `rgba(255,120,90,${(0.3 * (1 - t)).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(q.x, q.y, Math.max(10, r), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(255,230,170,${(0.9 * (1 - t)).toFixed(3)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(q.x, q.y, Math.max(8, r - 5), 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    if (meteors.length) {
      for (const m of meteors) {
        const ang = Math.atan2(m.vy, m.vx);
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(ang);
        ctx.fillStyle = "rgba(255,160,80,.9)";
        ctx.beginPath();
        ctx.ellipse(0, 0, m.r + 6, m.r + 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(190,120,255,.95)";
        ctx.beginPath();
        ctx.arc(0, 0, m.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(120,220,255,.7)";
        ctx.fillRect(-m.r - 10, -2, 10, 4);
        ctx.restore();
      }
    }

    // Galaxy telegraph + lasers (drawn before entities for clarity)
    if (dogs.some((d0) => d0.kind === "galaxyWarrior" && d0.hp > 0)) {
      for (const g0 of dogs) {
        if (g0.kind !== "galaxyWarrior" || g0.hp <= 0) continue;
        if (g0.gwPhase === "telegraph") {
          ctx.strokeStyle = "rgba(255,60,60,.85)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(g0.x, g0.y);
          ctx.lineTo(player.x, player.y);
          ctx.stroke();
        }
        if (g0.gwPhase === "laser") {
          const ux = g0.gwLaserDir?.x ?? 1;
          const uy = g0.gwLaserDir?.y ?? 0;
          let x2 = g0.x + ux * GALAXY_LASER_LEN;
          let y2 = g0.y + uy * GALAXY_LASER_LEN;
          const end = clipLaserToSlides(g0.x, g0.y - 2, x2, y2);
          x2 = end.x;
          y2 = end.y;
          ctx.strokeStyle = "rgba(170,90,255,.9)";
          ctx.lineWidth = 14;
          ctx.beginPath();
          ctx.moveTo(g0.x, g0.y - 2);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.strokeStyle = "rgba(218,170,255,.95)";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(g0.x, g0.y - 2);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    }

    // entities
    drawPlayer(ctx, player, animT, lastMove);
    for (const d0 of dogs) {
      if (d0.hp <= 0) continue;
      if (d0.kind === "techno" || d0.kind === "armyTechno") drawTechnoDog(ctx, d0, animT);
      else if (d0.kind === "skeleton") drawSkeleton(ctx, d0, animT);
      else if (d0.kind === "zombie" || d0.kind === "titanZombie") drawZombie(ctx, d0, animT);
      else if (d0.kind === "zombieDog" || d0.kind === "titanZombieDog") drawZombieDog(ctx, d0, animT);
      else if (d0.kind === "galaxyWarrior") drawGalaxyWarrior(ctx, d0, animT);
      else drawRogueDog(ctx, d0, animT);
      drawShadowBladeMark(ctx, d0);

      if (showHitboxes) {
        ctx.strokeStyle = "rgba(255,230,120,.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(d0.x, d0.y, d0.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (showHitboxes) {
      ctx.strokeStyle = "rgba(120,240,255,.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const a of arrows) {
      const ang = Math.atan2(a.vy, a.vx);
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(ang);
      if (a.ally) {
        ctx.fillStyle = "#1a4d3a";
        ctx.fillRect(-10, -2, 14, 4);
        ctx.fillStyle = "#7dffb8";
        ctx.fillRect(4, -1.5, 7, 3);
      } else {
        ctx.fillStyle = "#5c3d1e";
        ctx.fillRect(-10, -2, 14, 4);
        ctx.fillStyle = "#c0c8d4";
        ctx.fillRect(4, -1.5, 7, 3);
      }
      ctx.restore();
    }

    for (const r0 of rockets) {
      ctx.fillStyle = "rgba(255,120,80,.95)";
      ctx.beginPath();
      ctx.arc(r0.x, r0.y, r0.r + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,220,180,.95)";
      ctx.beginPath();
      ctx.arc(r0.x, r0.y, r0.r - 1, 0, Math.PI * 2);
      ctx.fill();
    }

    if (player.laserFxMs > 0 && player.laserFxFrom && player.laserFxTo) {
      // Draw beam exactly like Techno Dog laser (non-army color).
      const t = clamp(player.laserFxMs / 180, 0, 1);
      ctx.strokeStyle = `rgba(255,70,70,${(0.85 * t).toFixed(3)})`;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(player.laserFxFrom.x, player.laserFxFrom.y - 2);
      ctx.lineTo(player.laserFxTo.x, player.laserFxTo.y);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,180,180,${(0.95 * t).toFixed(3)})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(player.laserFxFrom.x, player.laserFxFrom.y - 2);
      ctx.lineTo(player.laserFxTo.x, player.laserFxTo.y);
      ctx.stroke();
    }

    if (powerCloneBeams.length) {
      for (const b of powerCloneBeams) {
        const ux = b.dir?.x ?? 1;
        const uy = b.dir?.y ?? 0;
        let x2 = b.x + ux * 4000;
        let y2 = b.y + uy * 4000;
        if ((terrainType === "playground" || terrainType === "apocalypse" || terrainType === "military") && !slideDestroyed) {
          const end = clipLaserToSlides(b.x, b.y - 2, x2, y2);
          x2 = end.x;
          y2 = end.y;
        }
        // damage mobs
        for (const d0 of dogs) {
          if (d0.hp <= 0) continue;
          const dist = distancePointToSegment(d0.x, d0.y, b.x, b.y, x2, y2);
          if (dist <= d0.r + 8) applyMobDamage(d0, 20 * (1 / 60));
        }
        ctx.strokeStyle = "rgba(170,90,255,.9)";
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y - 2);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(218,170,255,.95)";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y - 2);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // Chainsaw visual effect (visible while active)
    if (fightStarted && player.powerActiveKind === "chainsaw" && player.powerActiveLeftMs > 0) {
      const tt = 1 - clamp(player.powerActiveLeftMs / POWER_TOOL_ACTIVE_MS, 0, 1);
      const spin = animT * 14;
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(spin);
      ctx.strokeStyle = `rgba(255,160,90,${(0.75 + 0.2 * tt).toFixed(3)})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, player.r + 20, 0, Math.PI * 1.6);
      ctx.stroke();
      ctx.strokeStyle = "rgba(234,240,255,.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, player.r + 20, 0, Math.PI * 1.6);
      ctx.stroke();
      // little sparks
      ctx.fillStyle = "rgba(255,210,120,.75)";
      for (let i = 0; i < 8; i++) {
        const a = spin + i * 0.8;
        const r = player.r + 24 + (i % 3) * 4;
        ctx.fillRect(Math.cos(a) * r, Math.sin(a) * r, 3, 3);
      }
      ctx.restore();
    }

    if (phantomUniversalBlastMs > 0) {
      const cx = phantomUniversalBlastX;
      const cy = phantomUniversalBlastY;
      const t = phantomUniversalBlastMs / 780;
      const r = (1 - t) * PHANTOM_BLAST_RADIUS * 1.15;
      ctx.fillStyle = `rgba(255,80,255,${(0.24 * t).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(220,140,255,${(0.6 * t).toFixed(3)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(18, r - 14), 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const b of phantomBullets) {
      ctx.fillStyle = "rgba(255,100,220,.9)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (fightStarted && player.usingPhantomSniper) {
      const aimOn = !!getDogUnderWorldPos(phantomAimX, phantomAimY);
      ctx.strokeStyle = aimOn ? "rgba(255,120,220,.95)" : "rgba(210,210,230,.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(phantomAimX, phantomAimY, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(phantomAimX - 18, phantomAimY);
      ctx.lineTo(phantomAimX - 6, phantomAimY);
      ctx.moveTo(phantomAimX + 6, phantomAimY);
      ctx.lineTo(phantomAimX + 18, phantomAimY);
      ctx.moveTo(phantomAimX, phantomAimY - 18);
      ctx.lineTo(phantomAimX, phantomAimY - 6);
      ctx.moveTo(phantomAimX, phantomAimY + 6);
      ctx.lineTo(phantomAimX, phantomAimY + 18);
      ctx.stroke();
      ctx.fillStyle = aimOn ? "rgba(255,130,240,.95)" : "rgba(240,240,255,.9)";
      ctx.beginPath();
      ctx.arc(phantomAimX, phantomAimY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    if (gameOver) {
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(0, 0, vw, vh);
      ctx.fillStyle = "rgba(234,240,255,.95)";
      ctx.font = "24px ui-sans-serif, system-ui, Segoe UI";
      const text = player.hp <= 0 ? "DEFEATED" : "VICTORY";
      ctx.fillText(text, vw / 2 - 62, vh / 2 - 10);
      ctx.fillStyle = "rgba(234,240,255,.75)";
      ctx.font = "14px ui-monospace, Menlo, Consolas, monospace";
      ctx.fillText("Press R to reset", vw / 2 - 72, vh / 2 + 18);
    }
  }

  function loop(t) {
    const dt = Math.min(0.033, (t - lastT) / 1000);
    lastT = t;
    step(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // textures (pixel sprites)
  function drawShadowBladeMark(g, d0) {
    const stage = d0?.shadowDotStage | 0;
    if (!d0 || d0.hp <= 0 || stage <= 0 || (d0.shadowDotLeftMs ?? 0) <= 0) return;
    const x = d0.x;
    const y = d0.y - d0.r - 16;
    g.save();
    g.strokeStyle = "rgba(188,120,255,.95)";
    g.fillStyle = "rgba(188,120,255,.28)";
    g.lineWidth = 2;
    if (stage === 1) {
      g.beginPath();
      g.moveTo(x, y - 7);
      g.lineTo(x - 7, y + 6);
      g.lineTo(x + 7, y + 6);
      g.closePath();
      g.fill();
      g.stroke();
    } else if (stage === 2) {
      g.beginPath();
      g.arc(x, y, 7, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    } else {
      const pts = 5;
      const outR = 8;
      const inR = 3.4;
      g.beginPath();
      for (let i = 0; i < pts * 2; i++) {
        const ang = -Math.PI / 2 + (Math.PI * i) / pts;
        const r = i % 2 === 0 ? outR : inR;
        const px = x + Math.cos(ang) * r;
        const py = y + Math.sin(ang) * r;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.restore();
  }

  function drawPlayer(g, p, t, moveDir) {
    const frame = playerMoving ? ((t * 12) | 0) % 4 : 0;
    const sp = getRobotSprite(frame);
    const scale = 4;
    const dx = Math.round(p.x - (sp.w * scale) / 2);
    const dy = Math.round(p.y - (sp.h * scale) / 2);

    // glow ring
    g.strokeStyle = "rgba(37,228,255,.35)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(p.x, p.y, p.r + 10, 0, Math.PI * 2);
    g.stroke();

    // shadow
    g.fillStyle = "rgba(0,0,0,.28)";
    g.beginPath();
    g.ellipse(p.x, p.y + 18, 18, 7, 0, 0, Math.PI * 2);
    g.fill();

    for (let y = 0; y < sp.h; y++) {
      for (let x = 0; x < sp.w; x++) {
        const c = sp.p[y * sp.w + x];
        if (!c) continue;
        g.fillStyle = c;
        g.fillRect(dx + x * scale, dy + y * scale, scale, scale);
      }
    }
  }

  function drawRogueDog(g, d0, t) {
    const scale = 4;
    const moving = fightStarted && !gameOver && (Math.hypot(player.x - d0.x, player.y - d0.y) > 2);
    const frame = moving ? (((t * 12) | 0) % 2) : 0;
    const sprite = getDogSprite(frame);
    const sw = sprite.w;
    const sh = sprite.h;
    const dx = Math.round(d0.x - (sw * scale) / 2);
    const dy = Math.round(d0.y - (sh * scale) / 2);

    // shadow
    g.fillStyle = "rgba(0,0,0,.25)";
    g.beginPath();
    g.ellipse(d0.x, d0.y + 14, 20, 8, 0, 0, Math.PI * 2);
    g.fill();

    // draw pixels
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        let c = sprite.p[y * sw + x];
        if (!c) continue;
        g.fillStyle = c;
        g.fillRect(dx + x * scale, dy + y * scale, scale, scale);
      }
    }

    // subtle outline ring (helps readability)
    g.strokeStyle = "rgba(255,96,96,.35)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(d0.x, d0.y, d0.r + 8, 0, Math.PI * 2);
    g.stroke();
  }

  function drawGalaxyWarrior(g, d0, t) {
    // Hand-drawn "galaxy knight" theme (no external image).
    // Base body aura
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
    g.save();
    g.translate(d0.x, d0.y);
    const isPurplePhase = d0.gwPhase === "run" || d0.gwPhase === "telegraph" || d0.gwPhase === "laser" || d0.gwPhase === "fight";
    const redT = isPurplePhase ? 0 : clamp((500 - (d0.hp ?? 0)) / 500, 0, 1);
    const auraR = 140 + Math.round(115 * redT);
    const auraG = 80 - Math.round(40 * redT);
    const auraB = 255 - Math.round(210 * redT);
    g.fillStyle = `rgba(${auraR},${auraG},${auraB},${(0.14 + pulse * 0.08).toFixed(3)})`;
    g.beginPath();
    g.arc(0, 0, d0.r + 18, 0, Math.PI * 2);
    g.fill();

    // Shadow
    g.fillStyle = "rgba(0,0,0,.28)";
    g.beginPath();
    g.ellipse(0, d0.r * 0.7, d0.r * 1.05, d0.r * 0.38, 0, 0, Math.PI * 2);
    g.fill();

    // Armor core (tints toward red under 500 HP)
    const coreR = 11 + Math.round(120 * redT);
    const coreG = 13;
    const coreB = 34;
    g.fillStyle = `rgb(${coreR},${coreG},${coreB})`;
    g.beginPath();
    g.arc(0, 0, d0.r * 0.95, 0, Math.PI * 2);
    g.fill();

    // Galaxy swirl highlight
    g.strokeStyle = "rgba(180,120,255,.85)";
    g.lineWidth = 5;
    g.beginPath();
    g.arc(-4, -2, d0.r * 0.55, 0.4, 2.8);
    g.stroke();
    g.strokeStyle = "rgba(120,220,255,.75)";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(3, -5, d0.r * 0.38, 0.9, 3.7);
    g.stroke();

    // Stars
    for (let i = 0; i < 10; i++) {
      const a = (i * 999 + ((t * 60) | 0) * 13) % 360;
      const ang = (a * Math.PI) / 180;
      const rr = d0.r * (0.12 + ((i * 37) % 10) / 40);
      const x = Math.cos(ang) * rr;
      const y = Math.sin(ang) * rr - 6;
      g.fillStyle = i % 3 === 0 ? "rgba(255,255,255,.85)" : "rgba(180,240,255,.75)";
      g.fillRect(x, y, 2, 2);
    }

    // Helmet + eyes
    g.fillStyle = "#11163B";
    g.fillRect(-d0.r * 0.6, -d0.r * 0.85, d0.r * 1.2, d0.r * 0.65);
    g.fillStyle = "rgba(255,120,255,.95)";
    g.fillRect(-10, -18, 6, 4);
    g.fillRect(4, -18, 6, 4);

    // Crown gem
    g.fillStyle = "rgba(200,140,255,.95)";
    g.beginPath();
    g.arc(0, -d0.r * 0.95, 6, 0, Math.PI * 2);
    g.fill();

    // Shield (left)
    g.fillStyle = "rgba(55,40,90,.95)";
    g.beginPath();
    g.arc(-d0.r * 0.95, 10, d0.r * 0.55, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(180,120,255,.55)";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(-d0.r * 0.95, 10, d0.r * 0.55, 0, Math.PI * 2);
    g.stroke();

    // Sword (right)
    g.save();
    g.translate(d0.r * 1.05, 2);
    g.rotate(0.32);
    g.fillStyle = "rgba(120,220,255,.85)";
    g.fillRect(0, -6, 44, 12);
    g.fillStyle = "rgba(180,120,255,.9)";
    g.fillRect(8, -3, 36, 6);
    g.fillStyle = "#2B214D";
    g.fillRect(-10, -9, 12, 18);
    g.restore();

    // Outline ring for readability
    g.strokeStyle = "rgba(220,170,255,.35)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, d0.r + 8, 0, Math.PI * 2);
    g.stroke();

    g.restore();
  }

  function drawTechnoDog(g, d0, t) {
    const isArmy = d0.kind === "armyTechno";
    const scale = isArmy ? 12 : 8;
    const moving = fightStarted && !gameOver && Math.hypot(player.x - d0.x, player.y - d0.y) > 2;
    const frame = moving ? (((t * 10) | 0) % 2) : 0;
    const sprite = getTechnoDogSprite(frame);
    const sw = sprite.w;
    const sh = sprite.h;
    const dx = Math.round(d0.x - (sw * scale) / 2);
    const dy = Math.round(d0.y - (sh * scale) / 2);

    g.fillStyle = "rgba(0,0,0,.28)";
    g.beginPath();
    g.ellipse(d0.x, d0.y + 18, 24, 8, 0, 0, Math.PI * 2);
    g.fill();

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const c = sprite.p[y * sw + x];
        if (!c) continue;
        g.fillStyle = c;
        g.fillRect(dx + x * scale, dy + y * scale, scale, scale);
      }
    }

    if (d0.laserActiveMs > 0) {
      const ux = d0.laserDir.x;
      const uy = d0.laserDir.y;
      let x2 = d0.x + ux * d0.laserLen;
      let y2 = d0.y + uy * d0.laserLen;
      if ((terrainType === "playground" || terrainType === "apocalypse" || terrainType === "military") && !slideDestroyed) {
        const end = clipLaserToSlides(d0.x, d0.y - 2, x2, y2);
        x2 = end.x;
        y2 = end.y;
      }
      g.strokeStyle = d0.laserColor === "purple" ? "rgba(170,90,255,.9)" : "rgba(255,70,70,.85)";
      g.lineWidth = 14;
      g.beginPath();
      g.moveTo(d0.x, d0.y - 2);
      g.lineTo(x2, y2);
      g.stroke();
      g.strokeStyle = d0.laserColor === "purple" ? "rgba(218,170,255,.95)" : "rgba(255,180,180,.95)";
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(d0.x, d0.y - 2);
      g.lineTo(x2, y2);
      g.stroke();
    }

    g.strokeStyle = isArmy ? "rgba(130,210,120,.4)" : "rgba(37,228,255,.38)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(d0.x, d0.y, d0.r + 9, 0, Math.PI * 2);
    g.stroke();
  }

  function drawSkeleton(g, d0, t) {
    const scale = 4;
    const moving = fightStarted && !gameOver && Math.hypot(player.x - d0.x, player.y - d0.y) > 2;
    const frame = moving ? (((t * 10) | 0) % 2) : 0;
    const sprite = getSkeletonSprite(frame);
    const sw = sprite.w;
    const sh = sprite.h;
    const dx = Math.round(d0.x - (sw * scale) / 2);
    const dy = Math.round(d0.y - (sh * scale) / 2);

    g.fillStyle = "rgba(0,0,0,.22)";
    g.beginPath();
    g.ellipse(d0.x, d0.y + 16, 16, 7, 0, 0, Math.PI * 2);
    g.fill();

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const c = sprite.p[y * sw + x];
        if (!c) continue;
        g.fillStyle = c;
        g.fillRect(dx + x * scale, dy + y * scale, scale, scale);
      }
    }

    g.strokeStyle = "rgba(180,200,255,.4)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(d0.x, d0.y, d0.r + 8, 0, Math.PI * 2);
    g.stroke();
  }

  function drawZombieDog(g, d0, t) {
    const scale = d0.kind === "titanZombieDog" ? 10 : 4;
    const moving = fightStarted && !gameOver && Math.hypot(player.x - d0.x, player.y - d0.y) > 2;
    const frame = moving ? (((t * 12) | 0) % 2) : 0;
    const sprite = getZombieDogSprite(frame);
    const sw = sprite.w;
    const sh = sprite.h;
    const dx = Math.round(d0.x - (sw * scale) / 2);
    const dy = Math.round(d0.y - (sh * scale) / 2);
    g.fillStyle = "rgba(0,0,0,.25)";
    g.beginPath();
    g.ellipse(d0.x, d0.y + d0.r * 0.9, d0.r * 1.5, d0.r * 0.55, 0, 0, Math.PI * 2);
    g.fill();
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const c = sprite.p[y * sw + x];
        if (!c) continue;
        g.fillStyle = c;
        g.fillRect(dx + x * scale, dy + y * scale, scale, scale);
      }
    }
    g.strokeStyle = "rgba(80,220,120,.4)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(d0.x, d0.y, d0.r + 8, 0, Math.PI * 2);
    g.stroke();
  }

  function drawZombie(g, d0, t) {
    const scale = d0.kind === "titanZombie" ? 13 : 4;
    const moving = fightStarted && !gameOver && Math.hypot(player.x - d0.x, player.y - d0.y) > 2;
    const frame = moving ? (((t * 8) | 0) % 2) : 0;
    const sprite = getZombieSprite(frame);
    const sw = sprite.w;
    const sh = sprite.h;
    const dx = Math.round(d0.x - (sw * scale) / 2);
    const dy = Math.round(d0.y - (sh * scale) / 2);
    g.fillStyle = "rgba(0,0,0,.24)";
    g.beginPath();
    g.ellipse(d0.x, d0.y + d0.r * 0.95, d0.r * 1.15, d0.r * 0.46, 0, 0, Math.PI * 2);
    g.fill();
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const c = sprite.p[y * sw + x];
        if (!c) continue;
        g.fillStyle = c;
        g.fillRect(dx + x * scale, dy + y * scale, scale, scale);
      }
    }
    g.strokeStyle = "rgba(100,255,140,.38)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(d0.x, d0.y, d0.r + 8, 0, Math.PI * 2);
    g.stroke();
  }

  function getDogSprite(frame) {
    // 20x18 pixel art, closer to reference (gray body, red eyes, open mouth, bold outline)
    // null = transparent
    const T = null;
    const outline = "#0B1230";
    const g0 = "#C9D2DE";
    const g1 = "#AEB8C7";
    const g2 = "#8D98A9";
    const g3 = "#6F7A8D";
    const red = "#FF6060";
    const red2 = "#F04E6B";
    const mouth = "#0B0B10";
    const tooth = "#EAF0FF";
    const nose = "#2A2A36";

    const w = 20;
    const h = 18;
    const p = new Array(w * h).fill(T);
    const set = (x, y, c) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      p[y * w + x] = c;
    };
    const fill = (x0, y0, x1, y1, c) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c);
    };

    // silhouette / outline (side view)
    // head + snout
    fill(2, 4, 9, 10, outline);
    fill(1, 6, 2, 9, outline); // snout front
    fill(9, 3, 11, 6, outline); // ear base
    set(10, 2, outline); // ear tip
    set(11, 3, outline);

    // body
    fill(8, 7, 18, 14, outline);
    // legs
    fill(10, 14, 12, 17, outline);
    fill(15, 14, 17, 17, outline);
    // tail (curved)
    set(6, 12, outline);
    set(5, 11, outline);
    set(4, 10, outline);
    set(3, 9, outline);
    set(3, 8, outline);
    set(4, 7, outline);

    // inner fur (gray)
    fill(3, 5, 8, 9, g1);
    fill(9, 7, 17, 13, g1);
    fill(10, 8, 16, 12, g0); // highlight band
    fill(9, 11, 13, 13, g2); // belly shadow
    fill(14, 12, 17, 13, g2);

    // snout + face
    fill(2, 7, 4, 8, g2);
    set(1, 7, g3); // nose pad
    set(1, 8, g3);
    set(2, 6, g2);
    set(3, 6, g1);
    set(4, 6, g1);
    set(5, 6, g1);
    set(6, 6, g1);
    set(7, 6, g1);
    set(8, 6, g2);

    // red eye + brow
    set(6, 7, red);
    set(7, 7, red2);
    set(6, 6, g3);

    // ear inner red accent
    set(10, 3, red2);
    set(10, 4, red);

    // mouth (open)
    fill(4, 9, 7, 10, mouth);
    set(4, 9, outline);
    set(7, 9, outline);
    set(4, 10, outline);
    set(7, 10, outline);
    // teeth
    set(5, 9, tooth);
    set(6, 10, tooth);

    // chest/neck
    fill(8, 10, 10, 12, g2);
    set(9, 10, g0);

    // paws inner
    fill(11, 15, 12, 16, g2);
    fill(16, 15, 17, 16, g2);

    // walk animation: swap a couple paw pixels + tail wiggle
    if (frame === 1) {
      // front paw lift
      set(12, 17, outline);
      set(12, 16, g2);
      set(11, 16, outline);
      // back paw step
      set(16, 17, outline);
      set(16, 16, g2);
      // tail wiggle
      set(3, 8, T);
      set(2, 8, outline);
      set(2, 9, outline);
    } else {
      // default paws grounded
      set(12, 17, outline);
      set(11, 17, outline);
      set(16, 17, outline);
      set(17, 17, outline);
    }

    // extra texture speckles
    set(12, 9, g2);
    set(14, 10, g2);
    set(16, 9, g2);
    set(15, 8, g2);

    // nose highlight
    set(2, 7, nose);
    set(2, 8, nose);

    return { w, h, p };
  }

  function getZombieDogSprite(frame) {
    const base = getDogSprite(frame);
    const tint = (c) => {
      if (!c) return c;
      const m = {
        "#0B1230": "#0d2818",
        "#C9D2DE": "#8ecf9a",
        "#AEB8C7": "#6ab87c",
        "#8D98A9": "#4a9660",
        "#6F7A8D": "#3d7a50",
        // keep #FF6060 / #F04E6B red eyes like rogue dog
        "#0B0B10": "#1a3020",
        "#EAF0FF": "#c8ffd4",
        "#2A2A36": "#1a4028",
      };
      return m[c] || c;
    };
    return { w: base.w, h: base.h, p: base.p.map(tint) };
  }

  function getZombieSprite(frame) {
    const T = null;
    const o = "#0a1810";
    const skin = "#6cb87a";
    const skin2 = "#4a9660";
    const skinHi = "#8ed9a0";
    const shirt = "#2d4a38";
    const eye = "#c8ff70";
    const w = 18;
    const h = 24;
    const p = new Array(w * h).fill(T);
    const set = (x, y, c) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      p[y * w + x] = c;
    };
    const fill = (x0, y0, x1, y1, c) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c);
    };
    fill(6, 2, 13, 9, o);
    fill(7, 3, 12, 8, skin);
    set(8, 5, eye);
    set(11, 5, eye);
    fill(8, 7, 11, 7, o);
    fill(7, 10, 12, 18, o);
    fill(8, 11, 11, 17, shirt);
    set(9, 13, skinHi);
    fill(6, 19, 8, 23, o);
    fill(10, 19, 12, 23, o);
    fill(7, 20, 7, 22, skin2);
    fill(11, 20, 11, 22, skin2);
    if (frame === 1) {
      set(7, 23, skin);
      set(11, 23, o);
    }
    return { w, h, p };
  }

  function getSkeletonSprite(frame) {
    const T = null;
    const outline = "#0a0a0c";
    const bone = "#eef1f6";
    const boneHi = "#ffffff";
    const boneLo = "#b8c0ce";
    const rib = "#7a8494";
    const bow = "#7a4a28";
    const bowHi = "#a06a3a";
    const bowLo = "#4a2c14";

    const w = 16;
    const h = 22;
    const p = new Array(w * h).fill(T);
    const set = (x, y, c) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      p[y * w + x] = c;
    };
    const fill = (x0, y0, x1, y1, c) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c);
    };

    // bow (left side)
    fill(1, 5, 3, 16, outline);
    fill(2, 6, 2, 15, bowLo);
    fill(3, 7, 3, 14, bow);
    set(2, 5, bowHi);
    set(2, 16, bowHi);
    set(4, 10, bowHi);
    set(4, 11, bowLo);

    // head (block)
    fill(6, 1, 11, 6, outline);
    fill(7, 2, 10, 5, bone);
    set(8, 3, boneHi);
    set(9, 3, boneHi);
    set(7, 4, outline);
    set(8, 4, outline);
    set(9, 4, outline);
    set(10, 4, outline);
    fill(8, 5, 9, 5, outline);

    // neck + torso
    fill(8, 7, 9, 8, outline);
    fill(8, 8, 9, 8, boneLo);
    fill(7, 9, 10, 15, outline);
    fill(8, 10, 9, 14, boneLo);
    set(8, 11, rib);
    set(9, 11, rib);
    set(8, 13, rib);
    set(9, 13, rib);

    // left arm to bow
    fill(5, 8, 7, 9, outline);
    fill(6, 8, 6, 8, bone);
    // right arm
    fill(11, 8, 13, 9, outline);
    fill(12, 8, 12, 8, bone);

    // pelvis
    fill(7, 16, 10, 17, outline);
    fill(8, 16, 9, 16, bone);

    // legs
    fill(7, 18, 8, 21, outline);
    fill(9, 18, 10, 21, outline);
    fill(8, 18, 8, 20, bone);
    fill(9, 18, 9, 20, bone);

    if (frame === 1) {
      set(7, 21, bone);
      set(10, 21, outline);
      set(9, 21, boneLo);
    } else {
      set(8, 21, bone);
      set(9, 21, bone);
    }

    return { w, h, p };
  }

  function getTechnoDogSprite(frame) {
    const T = null;
    const outline = "#0D3C49";
    const c0 = "#23B8C2";
    const c1 = "#4CE0E7";
    const c2 = "#168E9E";
    const steel = "#6C7788";
    const steel2 = "#9AA4B7";
    const red = "#FF2E2E";
    const dark = "#1D2230";

    const w = 22;
    const h = 19;
    const p = new Array(w * h).fill(T);
    const set = (x, y, c) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      p[y * w + x] = c;
    };
    const fill = (x0, y0, x1, y1, c) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c);
    };

    // head + neck
    fill(1, 4, 7, 9, outline);
    fill(2, 5, 6, 8, c0);
    fill(1, 7, 3, 9, c2);
    fill(7, 7, 8, 11, outline);
    fill(8, 8, 9, 11, steel2);
    // ears
    fill(2, 2, 3, 4, outline);
    fill(3, 3, 3, 4, c0);
    fill(6, 2, 7, 4, outline);
    fill(6, 3, 6, 4, c0);
    // eye visor
    fill(2, 6, 5, 7, red);
    set(2, 6, "#EAF0FF");
    set(5, 7, "#EAF0FF");
    // mouth
    fill(3, 9, 6, 10, dark);
    fill(4, 10, 5, 10, steel2);

    // body
    fill(9, 8, 18, 13, outline);
    fill(10, 9, 17, 12, steel);
    fill(10, 9, 17, 9, steel2);
    set(12, 10, "#F0B236");
    set(14, 10, "#F0B236");
    set(16, 10, "#F0B236");
    // top cyan plate
    fill(11, 7, 16, 8, c1);
    fill(11, 8, 16, 8, c0);

    // tail
    fill(18, 9, 20, 10, outline);
    fill(19, 6, 20, 9, c0);
    fill(19, 7, 20, 7, dark);
    fill(19, 9, 20, 9, dark);

    // legs
    const step = frame === 1 ? 1 : 0;
    fill(4, 13, 6, 17, outline);
    fill(5, 14, 6, 16, c0);
    fill(11, 13, 13, 17, outline);
    fill(11, 14, 12, 16, c0);
    fill(4 + step, 18, 7 + step, 18, c2);
    fill(10 - step, 18, 13 - step, 18, c2);
    fill(4 + step, 18, 7 + step, 18, outline);
    fill(10 - step, 18, 13 - step, 18, outline);

    return { w, h, p };
  }

  function getRobotSprite(frame) {
    // 16x18 pixel robot with neon visor, similar vibe to the model canvas
    const T = null;
    const outline = "#101A36";
    const steel = "#9FB3D8";
    const steel2 = "#6C82AF";
    const steel3 = "#D8E4FF";
    const neon = "#25E4FF";
    const neon2 = "#7C5CFF";
    const core = "#3DFFB5";
    const dark = "#0B1020";

    const w = 16;
    const h = 18;
    const p = new Array(w * h).fill(T);
    const set = (x, y, c) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      p[y * w + x] = c;
    };
    const fill = (x0, y0, x1, y1, c) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c);
    };

    const gold = "#D9B55A";
    const gold2 = "#F1D07A";
    const gold3 = "#B48B3E";
    const s = loadSave();
    const eq = s.armor?.equipped ?? { helmet: false, chest: false, legs: false, boots: false };

    // Head
    fill(4, 1, 11, 5, steel2);
    fill(4, 1, 11, 1, steel3);
    fill(4, 1, 4, 5, outline);
    fill(11, 1, 11, 5, outline);
    fill(4, 5, 11, 5, outline);
    // visor
    fill(5, 3, 10, 4, neon);
    set(5, 3, neon2);
    set(10, 4, neon2);
    set(6, 3, steel3);
    // antenna
    set(8, 0, neon2);
    set(8, 1, steel);

    // Torso
    fill(3, 6, 12, 12, steel);
    fill(3, 6, 12, 6, steel3);
    fill(3, 6, 3, 12, outline);
    fill(12, 6, 12, 12, outline);
    fill(3, 12, 12, 12, outline);
    // chest core
    fill(7, 9, 8, 10, core);
    set(6, 10, "rgba(61,255,181,.55)");
    set(9, 9, "rgba(61,255,181,.55)");

    // Arms (swing a bit while walking)
    const f = ((frame % 4) + 4) % 4;
    const step = f === 1 ? 1 : f === 3 ? -1 : 0;
    const armStep = f === 1 ? -1 : f === 3 ? 1 : 0;

    const lArmX0 = 1 + armStep;
    const rArmX0 = 13 - armStep;
    fill(lArmX0, 7, lArmX0 + 1, 10, steel);
    fill(rArmX0, 7, rArmX0 + 1, 10, steel);
    fill(lArmX0, 7, lArmX0, 10, outline);
    fill(lArmX0 + 1, 7, lArmX0 + 1, 10, outline);
    fill(rArmX0, 7, rArmX0, 10, outline);
    fill(rArmX0 + 1, 7, rArmX0 + 1, 10, outline);
    // hands
    fill(lArmX0, 11, lArmX0 + 1, 12, steel2);
    fill(rArmX0, 11, rArmX0 + 1, 12, steel2);
    fill(lArmX0, 12, lArmX0 + 1, 12, outline);
    fill(rArmX0, 12, rArmX0 + 1, 12, outline);

    // Legs (four-frame walk)
    // left leg
    fill(5, 13, 7, 16, steel2);
    fill(5, 16, 7, 16, outline);
    fill(5, 13, 5, 16, outline);
    fill(7, 13, 7, 16, outline);
    // right leg (shift foot)
    fill(8, 13, 10, 16, steel2);
    fill(8, 16, 10, 16, outline);
    fill(8, 13, 8, 16, outline);
    fill(10, 13, 10, 16, outline);
    // boots
    fill(4 + step, 17, 7 + step, 17, dark);
    fill(8 - step, 17, 11 - step, 17, dark);
    fill(4 + step, 17, 7 + step, 17, outline);
    fill(8 - step, 17, 11 - step, 17, outline);

    // belt accents
    set(5, 12, neon2);
    set(10, 12, neon2);

    // --- Releasite armor overlay (yellowish gold) ---
    if (eq.helmet) {
      fill(4, 1, 11, 2, gold2);
      fill(4, 3, 11, 3, gold);
      set(4, 2, gold3);
      set(11, 2, gold3);
    }
    if (eq.chest) {
      fill(3, 7, 12, 11, gold);
      fill(4, 7, 11, 7, gold2);
      set(3, 11, gold3);
      set(12, 11, gold3);
      // keep core visible
      fill(7, 9, 8, 10, core);
    }
    if (eq.legs) {
      fill(5, 13, 7, 16, gold);
      fill(8, 13, 10, 16, gold);
      fill(5, 13, 7, 13, gold2);
      fill(8, 13, 10, 13, gold2);
    }
    if (eq.boots) {
      fill(4 + step, 17, 7 + step, 17, gold3);
      fill(8 - step, 17, 11 - step, 17, gold3);
    }

    return { w, h, p };
  }

  // Keep canvas internal resolution, but track CSS size to match pointer feel (optional later)
  // Start in menu state; clicking the mob starts the fight.
  const startFight = (mode) => {
    fightStarted = true;
    arrows = [];
    phantomBullets = [];
    const vw = canvas.width;
    const vh = canvas.height;

    if (mode === "apocalypse") {
      fightMode = "apocalypse";
      terrainType = "apocalypse";
      world.w = vw * 2;
      world.h = vh * 2;
      const sw = 260;
      const sh = 180;
      world.slides = [
        { x: 90, y: 80, w: sw, h: sh },
        { x: world.w - 100 - sw, y: 90, w: sw, h: sh },
        { x: 110, y: world.h - 100 - sh, w: sw, h: sh },
        { x: world.w - 90 - sw, y: world.h - 95 - sh, w: sw, h: sh },
      ];
      world.slide = world.slides[0];
      paintballObstacles = [];
      militaryObstacles = [];
      slideDestroyed = false;
      apocWave = 1;
      spawnApocalypseWave();
      if (enemyLabel) enemyLabel.textContent = `Apocalypse · Wave ${apocWave}`;
    } else if (mode === "armytechno") {
      if (!isTriggerOn("BOSS_UPDATE_TRIGGER")) {
        setStatus("Boss Update is temporarily unavailable.");
        fightStarted = false;
        return;
      }
      fightMode = "armytechno";
      terrainType = "military";
      world.w = vw * 2;
      world.h = vh * 2;
      const sw = 260;
      const sh = 180;
      world.slides = [
        { x: 90, y: 80, w: sw, h: sh },
        { x: world.w - 100 - sw, y: 90, w: sw, h: sh },
        { x: 110, y: world.h - 100 - sh, w: sw, h: sh },
        { x: world.w - 90 - sw, y: world.h - 95 - sh, w: sw, h: sh },
      ];
      world.slide = world.slides[0];
      paintballObstacles = [];
      militaryObstacles = buildMilitaryTrainingObstacles(world.w, world.h);
      slideDestroyed = false;
      dogs = [makeArmyTechnoDog(world.w * 0.76, world.h * 0.45)];
      if (enemyLabel) enemyLabel.textContent = "Army Techno Dog";
    } else if (mode === "titanzombie") {
      if (!isTriggerOn("BOSS_UPDATE_TRIGGER")) {
        setStatus("Boss Update is temporarily unavailable.");
        fightStarted = false;
        return;
      }
      fightMode = "titanzombie";
      terrainType = "military";
      world.w = vw * 2;
      world.h = vh * 2;
      const sw = 260;
      const sh = 180;
      world.slides = [
        { x: 90, y: 80, w: sw, h: sh },
        { x: world.w - 100 - sw, y: 90, w: sw, h: sh },
        { x: 110, y: world.h - 100 - sh, w: sw, h: sh },
        { x: world.w - 90 - sw, y: world.h - 95 - sh, w: sw, h: sh },
      ];
      world.slide = world.slides[0];
      paintballObstacles = [];
      militaryObstacles = buildMilitaryTrainingObstacles(world.w, world.h);
      slideDestroyed = false;
      dogs = [makeTitanZombie(world.w * 0.74, world.h * 0.42)];
      if (enemyLabel) enemyLabel.textContent = "Titan Zombie";
    } else if (mode === "galaxywarrior") {
      if (!isTriggerOn("BOSS_UPDATE_TRIGGER")) {
        setStatus("Boss Update is temporarily unavailable.");
        fightStarted = false;
        return;
      }
      fightMode = "galaxywarrior";
      terrainType = "military";
      world.w = vw * 2;
      world.h = vh * 2;
      const sw = 260;
      const sh = 180;
      world.slides = [
        { x: 90, y: 80, w: sw, h: sh },
        { x: world.w - 100 - sw, y: 90, w: sw, h: sh },
        { x: 110, y: world.h - 100 - sh, w: sw, h: sh },
        { x: world.w - 90 - sw, y: world.h - 95 - sh, w: sw, h: sh },
      ];
      world.slide = world.slides[0];
      paintballObstacles = [];
      militaryObstacles = buildMilitaryTrainingObstacles(world.w, world.h);
      slideDestroyed = false;
      dogs = [makeGalaxyWarrior(world.w * 0.76, world.h * 0.45)];
      if (enemyLabel) enemyLabel.textContent = "Galaxy Warrior";
    } else if (mode === "skeleton") {
      fightMode = "skeleton";
      terrainType = "paintball";
      world.w = vw;
      world.h = vh;
      world.slides = [];
      world.slide = { x: world.w / 2 - 130, y: world.h / 2 - 90, w: 260, h: 180 };
      paintballObstacles = buildPaintballObstacles(world.w, world.h);
      militaryObstacles = [];
      slideDestroyed = true;
      dogs = [makeSkeleton(world.w * 0.78, world.h * 0.42)];
      if (enemyLabel) enemyLabel.textContent = "Skeleton";
    } else if (mode === "zombie") {
      fightMode = "zombie";
      terrainType = "playground";
      world.w = vw;
      world.h = vh;
      world.slides = [];
      world.slide = { x: world.w / 2 - 130, y: world.h / 2 - 90, w: 260, h: 180 };
      paintballObstacles = [];
      militaryObstacles = [];
      slideDestroyed = false;
      dogs = [makeZombie(world.w * 0.72, world.h * 0.42)];
      if (enemyLabel) enemyLabel.textContent = "Zombie";
    } else {
      terrainType = "playground";
      world.w = vw;
      world.h = vh;
      world.slides = [];
      world.slide = { x: world.w / 2 - 130, y: world.h / 2 - 90, w: 260, h: 180 };
      paintballObstacles = [];
      militaryObstacles = [];
      fightMode = mode === "horde" ? "horde" : mode === "techno" ? "techno" : "single";
      slideDestroyed = false;
      if (mode === "horde") {
        dogs = [
          makeDog(world.w * 0.72, world.h * 0.4),
          makeDog(world.w * 0.8, world.h * 0.52),
          makeDog(world.w * 0.7, world.h * 0.58),
        ];
        if (enemyLabel) enemyLabel.textContent = "Dog Horde!!!";
      } else if (mode === "techno") {
        dogs = [makeTechnoDog(world.w * 0.76, world.h * 0.45)];
        if (enemyLabel) enemyLabel.textContent = "Techno Super Dog";
      } else {
        dogs = [makeDog(world.w * 0.75, world.h * 0.45)];
        if (enemyLabel) enemyLabel.textContent = "Rogue Dog";
      }
    }
    reset();
    setUi();
    setStatus(
      mode === "apocalypse"
        ? `Apocalypse · Wave ${apocWave} · clear waves for $ + magicoin`
        : mode === "armytechno"
          ? "Boss fight started: Army Techno Dog (Military Training Base)"
        : mode === "titanzombie"
          ? "Boss fight started: Titan Zombie (Military Training Base)"
        : mode === "galaxywarrior"
          ? "Boss fight started: Galaxy Warrior (Military Training Base)"
        : mode === "skeleton"
          ? "Fight started: Skeleton (Paintball Arena)"
          : mode === "zombie"
            ? "Fight started: Zombie"
            : mode === "horde"
              ? "Fight started: Dog Horde!!!"
              : mode === "techno"
                ? "Fight started: Techno Super Dog"
                : "Fight started: Rogue Dog",
    );
  };

  window.gameStartFight = startFight;

  if (mobBtnDog) {
    mobBtnDog.addEventListener("click", () => startFight("single"));
  }
  if (mobBtnHorde) {
    mobBtnHorde.addEventListener("click", () => startFight("horde"));
  }
  if (mobBtnTechno) {
    mobBtnTechno.addEventListener("click", () => startFight("techno"));
  }
  if (mobBtnSkeleton) {
    mobBtnSkeleton.addEventListener("click", () => startFight("skeleton"));
  }
  if (mobBtnZombie) {
    mobBtnZombie.addEventListener("click", () => startFight("zombie"));
  }

  fightStarted = false;
  reset();
  setUi();
  requestAnimationFrame(loop);

  // Armor equip toggles (only if owned)
  const toggle = (k, bonus) => {
    const s0 = loadSave();
    if (!s0.armor) s0.armor = { ownedSet: false, equipped: { helmet: false, chest: false, legs: false, boots: false } };
    if (!s0.armor.ownedSet) return;
    const cur = !!s0.armor.equipped[k];
    s0.armor.equipped[k] = !cur;
    saveGame(s0);
    const oldMax = player.hpMax;
    // map into equipped ids too
    const s = loadSave();
    if (!s.equipped) s.equipped = { helmet: null, chest: null, legs: null, boots: null, weapon1: null, weapon2: null };
    const map = { helmet: "releasite_helmet", chest: "releasite_chestplate", legs: "releasite_leggings", boots: "releasite_boots" };
    s.equipped[k] = s0.armor.equipped[k] ? map[k] : null;
    saveGame(s);
    applyLoadout();
    // Keep percent-ish consistent
    if (player.hp > player.hpMax) player.hp = player.hpMax;
    if (oldMax !== player.hpMax) setStatus(`HP Max: ${player.hpMax}`);
    setUi();
    updateWeaponsSlots();
  };
  if (armorUi.helmet) armorUi.helmet.addEventListener("click", () => toggle("helmet"));
  if (armorUi.chest) armorUi.chest.addEventListener("click", () => toggle("chest"));
  if (armorUi.legs) armorUi.legs.addEventListener("click", () => toggle("legs"));
  if (armorUi.boots) armorUi.boots.addEventListener("click", () => toggle("boots"));
}

function initShop() {
  const moneyText = $("#moneyText");
  const openLootCrate = $("#openLootCrate");
  const limitedSection = $("#limitedLootSection");
  const openLimitedCrate = $("#openLimitedReleaseCrate");
  const limitedCrateResult = $("#limitedCrateResult");
  const redeemModal = $("#redeemModal");
  const redeemInput = $("#redeemCodeInput");
  const redeemSubmit = $("#redeemSubmitBtn");
  const redeemCancel = $("#redeemCancelBtn");
  const redeemHelp = $("#redeemHelp");
  const resetSaveBtn = $("#resetSaveBtn");
  const resetCurrencyBtn = $("#resetCurrencyBtn");
  const lootCrateResult = $("#lootCrateResult");
  const openUndeadCrate = $("#openUndeadCrate");
  const undeadCrateResult = $("#undeadCrateResult");
  const openPowerToolCrate = $("#openPowerToolCrate");
  const powerToolCrateResult = $("#powerToolCrateResult");
  const accessoryBundleItem = $("#accessoryBundleItem");
  const openAccessoryBundle = $("#openAccessoryBundle");
  const accessoryBundleResult = $("#accessoryBundleResult");
  const buyBowSpecial = $("#buyBowSpecial");
  const bowSpecialNote = $("#bowSpecialNote");
  const buyPhantomSniper = $("#buyPhantomSniper");
  const phantomSniperNote = $("#phantomSniperNote");
  const shadowBladeItem = $("#shadowBladeItem");
  const buyShadowBlade = $("#buyShadowBlade");
  const shadowBladeNote = $("#shadowBladeNote");
  const lootModal = $("#lootModal");
  const lootCanvas = $("#lootCanvas");
  const lootText = $("#lootText");
  const closeLootModal = $("#closeLootModal");

  if (!moneyText) return;

  let game = normalizeSave(loadSave());

  const magicoinShop = $("#magicoinText");

  const refresh = () => {
    game = normalizeSave(loadSave());
    moneyText.textContent = `$${game.money}`;
    if (magicoinShop) magicoinShop.textContent = `${game.magicoin ?? 0} magicoin`;
    if (openLootCrate) openLootCrate.disabled = game.money < 30;
    if (openUndeadCrate) openUndeadCrate.disabled = game.money < 500;
    if (openPowerToolCrate) openPowerToolCrate.disabled = game.money < 700 || !isTriggerOn("MOD_TRIGGER");
    if (accessoryBundleItem) accessoryBundleItem.style.display = isTriggerOn("BOSS_UPDATE_TRIGGER") ? "" : "none";
    if (openAccessoryBundle) openAccessoryBundle.disabled = game.money < 700 || !isTriggerOn("BOSS_UPDATE_TRIGGER");
    if (buyBowSpecial) buyBowSpecial.disabled = game.money < 4000;
    if (buyPhantomSniper) buyPhantomSniper.disabled = game.money < 10000 || (game.magicoin ?? 0) < 10;
    if (shadowBladeItem) shadowBladeItem.style.display = isTriggerOn("SHADOW_BLADE_EVENT_TRIGGER") ? "" : "none";
    if (buyShadowBlade) buyShadowBlade.disabled = game.money < 10000 || !isTriggerOn("SHADOW_BLADE_EVENT_TRIGGER");
    if (bowSpecialNote) {
      const n = Number(game.inventory?.counts?.bone_bow ?? 0);
      bowSpecialNote.textContent = n > 0 ? `You own: ${n}× Bow (equip in Weapons)` : "";
    }
    if (phantomSniperNote) {
      const n = Number(game.inventory?.counts?.phantom_sniper ?? 0);
      phantomSniperNote.textContent = n > 0 ? `You own: ${n}× (equip in Weapons)` : "";
    }
    if (shadowBladeNote) {
      const n = Number(game.inventory?.counts?.shadow_blade ?? 0);
      shadowBladeNote.textContent = n > 0 ? `You own: ${n}× Shadow Blade (equip in Weapons)` : "";
    }
    if (limitedSection) limitedSection.style.display = isLimitedReleaseCrateEnabled() ? "" : "none";

    const powerToolRowOn = isTriggerOn("MOD_TRIGGER") && !!loadMods().powerToolMod;
    const shadowRowOn = isTriggerOn("SHADOW_BLADE_EVENT_TRIGGER");
    const accessoryRowOn = isTriggerOn("BOSS_UPDATE_TRIGGER");
    const limitedOn = isLimitedReleaseCrateEnabled();

    const mainGrid = document.querySelector("#panel-shop .shopLayout > .shopGrid");
    if (mainGrid) {
      const offers = [];
      offers.push({ can: game.money >= 4000 });
      offers.push({ can: game.money >= 10000 && (game.magicoin ?? 0) >= 10 });
      if (shadowRowOn) offers.push({ can: game.money >= 10000 });
      offers.push({ can: game.money >= 30 });
      offers.push({ can: game.money >= 500 });
      if (powerToolRowOn) offers.push({ can: game.money >= 700 && isTriggerOn("MOD_TRIGGER") });
      if (accessoryRowOn) offers.push({ can: game.money >= 700 });
      const anyAfford = offers.some((o) => o.can);
      mainGrid.classList.remove("shopGrid--afford-yes", "shopGrid--afford-no");
      if (offers.length) mainGrid.classList.add(anyAfford ? "shopGrid--afford-yes" : "shopGrid--afford-no");
    }

    const limitedGrid = document.querySelector("#limitedLootSection .shopGrid");
    if (limitedGrid) {
      limitedGrid.classList.remove("shopGrid--afford-yes", "shopGrid--afford-no");
      if (limitedOn) limitedGrid.classList.add("shopGrid--afford-yes");
    }
  };

  const runVerificationResetFlow = (doReset, successMsg) => {
    const warned = window.confirm("Warning: this action resets progress data. Continue?");
    if (!warned) return;
    const confirmed = window.confirm("Confirm reset?");
    if (!confirmed) return;
    const code = generateResetVerification();
    const typed = window.prompt(`Type this verification to continue: ${code}`);
    if (typed !== code) {
      setStatus("Verification failed. Reset cancelled.");
      return;
    }
    doReset?.();
    refresh();
    runForeverTaskEngine();
    updateWeaponsSlots();
    setStatus(successMsg);
  };

  if (buyBowSpecial) {
    buyBowSpecial.addEventListener("click", () => {
      game = normalizeSave(loadSave());
      if (game.money < 4000) {
        setStatus("Not enough money for Bow (4000$)");
        return refresh();
      }
      game.money -= 4000;
      ensureItemInInventory(game, "bone_bow");
      saveGame(game);
      refresh();
      updateWeaponsSlots();
      setStatus("Bought: Bow — 4000$");
      runForeverTaskEngine();
    });
  }

  if (buyPhantomSniper) {
    buyPhantomSniper.addEventListener("click", () => {
      game = normalizeSave(loadSave());
      if (game.money < 10000) {
        setStatus("Not enough money for Phantom Sniper (10,000$)");
        return refresh();
      }
      if ((game.magicoin ?? 0) < 10) {
        setStatus("Not enough magicoin (need 10)");
        return refresh();
      }
      game.money -= 10000;
      game.magicoin -= 10;
      ensureItemInInventory(game, "phantom_sniper");
      saveGame(game);
      refresh();
      updateWeaponsSlots();
      setStatus("Bought: Phantom Sniper");
      runForeverTaskEngine();
    });
  }

  if (buyShadowBlade) {
    buyShadowBlade.addEventListener("click", () => {
      game = normalizeSave(loadSave());
      if (!isTriggerOn("SHADOW_BLADE_EVENT_TRIGGER")) {
        setStatus("Shadow Blade event is disabled.");
        return refresh();
      }
      if (game.money < 10000) {
        setStatus("Not enough money for Shadow Blade (10,000$)");
        return refresh();
      }
      game.money -= 10000;
      ensureItemInInventory(game, "shadow_blade");
      saveGame(game);
      refresh();
      updateWeaponsSlots();
      setStatus("Bought: Shadow Blade");
      runForeverTaskEngine();
    });
  }

  const showLootModal = (title, drawFn, variant = "basic") => {
    if (!lootModal || !lootCanvas || !lootText) return;
    lootModal.classList.remove("is-hidden");
    lootModal.setAttribute("aria-hidden", "false");
    const ctx = lootCanvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const W = lootCanvas.width;
    const H = lootCanvas.height;

    let t = 0;
    const anim = () => {
      t += 1;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = variant === "limited" ? "#070A12" : variant === "undead" ? "#0a120e" : "#000000";
      ctx.fillRect(0, 0, W, H);
      // flicker bars
      const barN = variant === "limited" ? 14 : variant === "undead" ? 12 : 10;
      for (let i = 0; i < barN; i++) {
        const y = (Math.random() * H) | 0;
        const a = variant === "limited" ? (Math.random() * 0.22).toFixed(3) : (Math.random() * 0.18).toFixed(3);
        const c =
          variant === "limited"
            ? `rgba(37,228,255,${a})`
            : variant === "undead"
              ? `rgba(61,255,181,${a})`
              : `rgba(124,92,255,${a})`;
        ctx.fillStyle = c;
        ctx.fillRect(0, y, W, 2);
      }
      // crate
      const cx = (W / 2) | 0;
      const cy = (H / 2 + 8) | 0;
      if (variant === "limited") {
        // slightly different crate look
        ctx.fillStyle = "rgba(37,228,255,.10)";
        ctx.fillRect(cx - 46, cy - 34, 92, 58);
        ctx.fillStyle = "rgba(255,210,96,.14)";
        ctx.fillRect(cx - 40, cy - 28, 80, 46);
        ctx.fillStyle = "rgba(124,92,255,.10)";
        ctx.fillRect(cx - 34, cy - 22, 68, 34);
        ctx.strokeStyle = "rgba(241,208,122,.55)";
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 46 + 1, cy - 34 + 1, 92 - 2, 58 - 2);
        // latch
        ctx.fillStyle = "rgba(241,208,122,.70)";
        ctx.fillRect(cx - 6, cy - 10, 12, 18);
      } else if (variant === "undead") {
        ctx.fillStyle = "rgba(61,255,181,.12)";
        ctx.fillRect(cx - 44, cy - 32, 88, 56);
        ctx.fillStyle = "rgba(22,38,32,.95)";
        ctx.fillRect(cx - 38, cy - 26, 76, 44);
        ctx.strokeStyle = "rgba(61,255,181,.42)";
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 44 + 1, cy - 32 + 1, 88 - 2, 56 - 2);
        ctx.fillStyle = "rgba(200,70,90,.45)";
        ctx.fillRect(cx - 5, cy - 9, 10, 16);
      } else {
        ctx.fillStyle = "rgba(255,210,96,.20)";
        ctx.fillRect(cx - 42, cy - 30, 84, 52);
        ctx.fillStyle = "rgba(234,240,255,.10)";
        ctx.fillRect(cx - 36, cy - 24, 72, 40);
        ctx.strokeStyle = "rgba(37,228,255,.35)";
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 42 + 1, cy - 30 + 1, 84 - 2, 52 - 2);
      }

      if (t > 22) drawFn?.(ctx, W, H);
      if (t < 36) requestAnimationFrame(anim);
    };
    lootText.textContent = title;
    requestAnimationFrame(anim);
  };

  revealBossCrateRewards = (itemIds) => {
    if (!Array.isArray(itemIds) || !itemIds.length) return;
    const names = itemIds.map((id) => ITEMS[id]?.name || id);
    if (lootCrateResult) lootCrateResult.textContent = `Boss crate rewards: ${names.join(", ")}`;
    let i = 0;
    const playOne = () => {
      const itemId = itemIds[i];
      const it = itemId ? ITEMS[itemId] : null;
      const detail = it ? getItemDetailText(it) : "";
      showLootModal(
        `Boss crate ${i + 1}/${itemIds.length}: ${it?.name || itemId}`,
        (ctx, W, H) => {
          ctx.fillStyle = "rgba(255,190,80,.10)";
          ctx.fillRect(0, 0, W, H);
          if (itemId && ITEMS[itemId]) drawItemTexture(itemId, ctx, W, H);
          ctx.fillStyle = "rgba(234,240,255,.90)";
          ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
          ctx.fillText(detail || "Boss crate reward", 12, H - 14);
        },
        "basic",
      );
      i += 1;
      if (i < itemIds.length) {
        setTimeout(playOne, 750);
      }
    };
    playOne();
  };

  const hideLootModal = () => {
    if (!lootModal) return;
    lootModal.classList.add("is-hidden");
    lootModal.setAttribute("aria-hidden", "true");
  };

  if (closeLootModal) closeLootModal.addEventListener("click", hideLootModal);
  if (lootModal) lootModal.addEventListener("click", (e) => {
    if (e.target?.classList?.contains("modal__backdrop")) hideLootModal();
  });

  const showRedeemModal = () => {
    if (!redeemModal) return;
    redeemModal.classList.remove("is-hidden");
    redeemModal.setAttribute("aria-hidden", "false");
    if (redeemHelp) redeemHelp.textContent = "Type a correct redeem code. (Case sensitive)";
    if (redeemInput) {
      redeemInput.value = "";
      redeemInput.focus();
    }
  };

  const hideRedeemModal = () => {
    if (!redeemModal) return;
    redeemModal.classList.add("is-hidden");
    redeemModal.setAttribute("aria-hidden", "true");
  };

  if (redeemCancel) redeemCancel.addEventListener("click", hideRedeemModal);
  if (redeemModal)
    redeemModal.addEventListener("click", (e) => {
      if (e.target?.classList?.contains("modal__backdrop")) hideRedeemModal();
    });

  const doRedeem = () => {
    const code = redeemInput ? redeemInput.value : "";
    const res = redeemLimitedReleaseCrate(code);
    if (!res.ok) {
      if (redeemHelp)
        redeemHelp.textContent =
          res.reason === "disabled"
            ? "Limited Release crate is currently disabled."
            : res.reason === "used"
              ? "That code was already used."
              : "Incorrect code.";
      setStatus("Redeem failed");
      return;
    }
    const itemId = res.itemId;
    const it = itemId ? ITEMS[itemId] : null;
    if (it) {
      game = normalizeSave(loadSave());
      game.stats.releaseCratesOpened += 1;
      saveGame(game);
      const detail = getItemDetailText(it);
      if (limitedCrateResult) limitedCrateResult.textContent = `Got: ${it.name} (${detail})`;
      showLootModal(`Limited Release: ${it.name}`, (ctx, W, H) => {
        // limited glow + sparkles
        ctx.fillStyle = "rgba(241,208,122,.10)";
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 10; i++) {
          const x = (Math.random() * W) | 0;
          const y = (Math.random() * H) | 0;
          ctx.fillStyle = "rgba(241,208,122,.55)";
          ctx.fillRect(x, y, 1, 1);
        }
        drawItemTexture(itemId, ctx, W, H);
        ctx.fillStyle = "rgba(234,240,255,.90)";
        ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
        ctx.fillText(detail, 12, H - 14);
      }, "limited");
      setStatus(res.infinite ? `Crate opened (tester code): ${it.name}` : `Crate opened: ${it.name}`);
      updateWeaponsSlots();
      runForeverTaskEngine();
    } else {
      if (limitedCrateResult) limitedCrateResult.textContent = "Opened.";
      setStatus(res.infinite ? "Crate opened (tester code)" : "Crate opened");
    }
    hideRedeemModal();
  };

  if (redeemSubmit) redeemSubmit.addEventListener("click", doRedeem);
  if (redeemInput)
    redeemInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doRedeem();
      if (e.key === "Escape") hideRedeemModal();
    });

  const rollLoot = () => {
    // Priority roll (rare -> common). If none hits, give Wooden Sword.
    const r = () => Math.random();
    if (r() < 1 / 100) return "forgotten_wood_sword";
    if (r() < 1 / 10) return "leather_wraith_armor";
    if (r() < 1 / 5) return "wooden_longsword";
    if (r() < 1 / 4) return "leather_chestplate";
    if (r() < 1 / 3) return "leather_leggings";
    if (r() < 1 / 2) return "leather_helmet";
    if (r() < 1 / 2) return "leather_boots";
    return "wooden_sword";
  };

  const drawItemTexture = (itemId, ctx, W, H) => {
    const it = ITEMS[itemId];
    const scale = 6;
    const x0 = (W / 2 - 10 * scale) | 0;
    const y0 = (H / 2 - 8 * scale - 10) | 0;
    const px = (x, y, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(x0 + x * scale, y0 + y * scale, scale, scale);
    };

    const o = "#0B1230";
    if (itemId === "armor_speeder") {
      for (let y = 4; y <= 12; y++) for (let x = 7; x <= 12; x++) px(x, y, o);
      for (let y = 5; y <= 11; y++) for (let x = 8; x <= 11; x++) px(x, y, "#8ad3ff");
      px(9, 7, "#25E4FF");
      px(10, 7, "#25E4FF");
      px(9, 9, "#d9f2ff");
      px(10, 9, "#d9f2ff");
      return;
    }
    if (itemId === "weapon_buffer") {
      for (let y = 2; y <= 13; y++) px(10, y, o);
      for (let y = 3; y <= 12; y++) px(10, y, "#f2c46e");
      for (let x = 7; x <= 13; x++) px(x, 7, o);
      for (let x = 8; x <= 12; x++) px(x, 7, "#ffd98f");
      return;
    }
    if (it.type === "weapon") {
      if (itemId === "golden_apple") {
        for (let y = 3; y <= 12; y++) for (let x = 6; x <= 13; x++) px(x, y, o);
        for (let y = 4; y <= 11; y++) for (let x = 7; x <= 12; x++) px(x, y, "#f1d07a");
        px(9, 2, "#7e5b2d");
        px(10, 2, "#7e5b2d");
        px(11, 3, "#46d48a");
        return;
      }
      if (itemId === "golden_drink") {
        for (let y = 3; y <= 13; y++) for (let x = 8; x <= 11; x++) px(x, y, o);
        for (let y = 4; y <= 12; y++) for (let x = 9; x <= 10; x++) px(x, y, "#f1d07a");
        for (let x = 8; x <= 11; x++) px(x, 3, "#ffd98f");
        px(11, 2, "#b5f1ff");
        return;
      }
      if (it.bow) {
        const demonic = itemId === "demonic_bow";
        const st = demonic ? "#3a1520" : "#3d3a33";
        const acc = demonic ? "#ff3355" : "#6b5a2a";
        for (let y = 1; y <= 14; y++) px(2, y, o), px(3, y, o);
        for (let y = 2; y <= 13; y++) px(3, y, st);
        for (let y = 4; y <= 11; y++) px(8, y, o), px(9, y, o);
        for (let y = 5; y <= 10; y++) px(8, y, acc), px(9, y, acc);
        px(7, 7, acc);
        px(10, 8, acc);
        return;
      }
      if (itemId === "phantom_sniper") {
        const c = "#2a2038";
        const a = "#c8a0ff";
        for (let i = 0; i < 24; i++) {
          const t = (i / 24) * Math.PI * 2;
          const x = 10 + Math.cos(t) * 6.5;
          const y = 8 + Math.sin(t) * 6.5;
          px(x | 0, y | 0, i % 3 === 0 ? a : c);
        }
        px(10, 1, c);
        px(10, 2, c);
        px(10, 14, c);
        px(10, 15, c);
        px(4, 8, c);
        px(5, 8, c);
        px(15, 8, c);
        px(16, 8, c);
        px(10, 8, "#ff9cf0");
        return;
      }
      const isReleasite = itemId.startsWith("releasite_");
      const isBoneWeapon = itemId === "bone_sword" || itemId === "undead_blade";
      const blade = isReleasite ? "#F1D07A" : isBoneWeapon ? "#E8ECF0" : itemId === "forgotten_wood_sword" ? "#A77CFF" : "#D8E4FF";
      const wood = isReleasite ? "#1A2350" : isBoneWeapon ? "#2a3038" : itemId === "wooden_sword" ? "#8B623A" : "#6A4A2B";
      const wood2 = isReleasite ? "#D9B55A" : isBoneWeapon ? "#9aa8b8" : itemId === "forgotten_wood_sword" ? "#6A3FA8" : "#B07D4B";
      const gem = isReleasite ? "#25E4FF" : isBoneWeapon ? "#b8c4d4" : itemId === "forgotten_wood_sword" ? "#7C5CFF" : "#25E4FF";
      // outline
      for (let y = 0; y < 16; y++) for (let x = 0; x < 20; x++) {}
      // blade
      for (let y = 1; y <= 10; y++) px(9, y, o), px(10, y, o);
      for (let y = 2; y <= 9; y++) px(9, y, blade), px(10, y, blade);
      // tip
      px(9, 1, blade);
      px(10, 1, blade);
      px(9, 0, o);
      px(10, 0, o);
      // guard
      for (let x = 6; x <= 13; x++) px(x, 11, o);
      for (let x = 7; x <= 12; x++) px(x, 11, wood2);
      // handle
      for (let y = 12; y <= 14; y++) px(9, y, o), px(10, y, o);
      for (let y = 12; y <= 14; y++) px(9, y, wood), px(10, y, wood);
      // pommel
      px(9, 15, o);
      px(10, 15, o);
      px(9, 15, gem);
      px(10, 15, gem);
      if (itemId === "wooden_longsword" || itemId === "forgotten_wood_sword" || itemId === "releasite_longsword") {
        // longer blade accent
        px(8, 4, "rgba(37,228,255,.35)");
        px(11, 6, "rgba(37,228,255,.25)");
      }
      if (isReleasite) {
        // extra gold shimmer
        px(8, 3, "rgba(241,208,122,.35)");
        px(11, 5, "rgba(241,208,122,.25)");
      }
      return;
    }

    // armor pieces
    const leather = "#8B623A";
    const leather2 = "#B07D4B";
    const gold = "#D9B55A";
    const gold2 = "#F1D07A";
    const gray = "#AEB8C7";
    const red = "#FF6060";
    const boneFill = "#c8ccd6";
    const boneFill2 = "#a8b4c4";
    const boneAcc = "#7a8698";

    if (itemId === "undead_wraith_chestplate") {
      for (let y = 4; y <= 11; y++) for (let x = 7; x <= 12; x++) px(x, y, o);
      for (let y = 5; y <= 10; y++) for (let x = 8; x <= 11; x++) px(x, y, "#1e2a24");
      px(8, 6, "#3dff9a");
      px(11, 6, "#3dff9a");
      px(9, 8, "#ff4460");
      px(10, 8, "#ff4460");
      px(9, 9, "rgba(61,255,181,.55)");
      return;
    }

    if (itemId === "leather_wraith_armor" || itemId === "releasite_wraith_armor") {
      // chest with gold shoulder pad
      const isRel = itemId === "releasite_wraith_armor";
      const base = isRel ? "#D9B55A" : gray;
      const base2 = isRel ? "#F1D07A" : gray;
      const mark = isRel ? "rgba(37,228,255,.55)" : "rgba(124,92,255,.55)";
      for (let y = 4; y <= 12; y++) for (let x = 6; x <= 13; x++) px(x, y, o);
      for (let y = 5; y <= 11; y++) for (let x = 7; x <= 12; x++) px(x, y, base);
      // shoulder
      for (let y = 4; y <= 6; y++) for (let x = 12; x <= 15; x++) px(x, y, o);
      for (let y = 5; y <= 6; y++) for (let x = 13; x <= 14; x++) px(x, y, isRel ? base2 : gold2);
      px(14, 4, gold);
      // wraith mark
      px(9, 8, red);
      px(10, 8, red);
      px(9, 9, mark);
      return;
    }

    if (it.type === "helmet") {
      const bone = itemId.startsWith("bone_");
      for (let y = 2; y <= 6; y++) for (let x = 7; x <= 12; x++) px(x, y, o);
      for (let y = 3; y <= 5; y++) for (let x = 8; x <= 11; x++) px(x, y, bone ? boneFill2 : itemId.startsWith("releasite") ? gold2 : leather2);
      px(9, 5, bone ? boneAcc : itemId.startsWith("releasite") ? gold : leather);
      return;
    }
    if (it.type === "boots") {
      const bone = itemId.startsWith("bone_");
      for (let y = 10; y <= 12; y++) for (let x = 8; x <= 11; x++) px(x, y, o);
      for (let y = 11; y <= 12; y++) for (let x = 8; x <= 11; x++) px(x, y, bone ? boneFill : itemId.startsWith("releasite") ? gold : leather);
      return;
    }
    if (it.type === "legs") {
      const bone = itemId.startsWith("bone_");
      for (let y = 7; y <= 12; y++) for (let x = 8; x <= 9; x++) px(x, y, o), px(x + 2, y, o);
      for (let y = 8; y <= 11; y++) {
        px(8, y, bone ? boneFill2 : itemId.startsWith("releasite") ? gold2 : leather2);
        px(10, y, bone ? boneFill2 : itemId.startsWith("releasite") ? gold2 : leather2);
      }
      return;
    }
    if (it.type === "chest") {
      const bone = itemId.startsWith("bone_");
      for (let y = 4; y <= 11; y++) for (let x = 7; x <= 12; x++) px(x, y, o);
      for (let y = 5; y <= 10; y++) for (let x = 8; x <= 11; x++) px(x, y, bone ? boneFill2 : itemId.startsWith("releasite") ? gold2 : leather2);
      px(9, 7, bone ? boneAcc : itemId.startsWith("releasite") ? gold : leather);
      px(10, 7, bone ? boneAcc : itemId.startsWith("releasite") ? gold : leather);
      return;
    }
  };

  if (openLootCrate) {
    openLootCrate.addEventListener("click", async () => {
      game = normalizeSave(loadSave());
      if (game.money < 30) {
        setStatus("Not enough money for loot crate");
        return refresh();
      }
      game.money -= 30;
      const itemId = rollLoot();
      ensureItemInInventory(game, itemId);
      game.stats.basicCratesOpened += 1;
      saveGame(game);
      refresh();
      updateWeaponsSlots();

      const it = ITEMS[itemId];
      const detail = getItemDetailText(it);
      if (lootCrateResult) lootCrateResult.textContent = `Got: ${it.name} (${detail})`;

      showLootModal(`You got: ${it.name}`, (ctx, W, H) => {
        // glow
        ctx.fillStyle = "rgba(37,228,255,.10)";
        ctx.fillRect(0, 0, W, H);
        // item texture
        drawItemTexture(itemId, ctx, W, H);
        // caption
        ctx.fillStyle = "rgba(234,240,255,.90)";
        ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
        ctx.fillText(detail, 12, H - 14);
      });
      setStatus(`Loot crate: ${it.name}`);
      runForeverTaskEngine();
    });
  }

  if (openUndeadCrate) {
    openUndeadCrate.addEventListener("click", () => {
      game = normalizeSave(loadSave());
      if (game.money < 500) {
        setStatus("Not enough money for Undead crate");
        return refresh();
      }
      game.money -= 500;
      const itemId = rollUndeadLoot();
      ensureItemInInventory(game, itemId);
      saveGame(game);
      refresh();
      updateWeaponsSlots();

      const it = ITEMS[itemId];
      const detail = getItemDetailText(it);
      if (undeadCrateResult) undeadCrateResult.textContent = `Got: ${it.name} (${detail})`;

      showLootModal(
        `Undead crate: ${it.name}`,
        (ctx, W, H) => {
          ctx.fillStyle = "rgba(61,255,181,.08)";
          ctx.fillRect(0, 0, W, H);
          drawItemTexture(itemId, ctx, W, H);
          ctx.fillStyle = "rgba(234,240,255,.90)";
          ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
          ctx.fillText(detail, 12, H - 14);
        },
        "undead",
      );
      setStatus(`Undead crate: ${it.name}`);
      runForeverTaskEngine();
    });
  }

  if (openPowerToolCrate) {
    openPowerToolCrate.addEventListener("click", async () => {
      game = normalizeSave(loadSave());
      if (!isTriggerOn("MOD_TRIGGER")) {
        setStatus("Power Tool mod is disabled.");
        return refresh();
      }
      if (game.money < 700) {
        setStatus("Not enough money for Power Tool Crate");
        return refresh();
      }
      game.money -= 700;
      const itemId = rollPowerToolLoot();
      ensureItemInInventory(game, itemId);
      saveGame(game);
      refresh();
      updateWeaponsSlots();
      const it = ITEMS[itemId];
      const detail = getItemDetailText(it);
      if (powerToolCrateResult) powerToolCrateResult.textContent = `Got: ${it.name} (${detail})`;
      showLootModal(`You got: ${it.name}`, (ctx, W, H) => {
        ctx.fillStyle = "rgba(170,90,255,.10)";
        ctx.fillRect(0, 0, W, H);
        drawItemTexture(itemId, ctx, W, H);
        ctx.fillStyle = "rgba(234,240,255,.90)";
        ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
        ctx.fillText(detail, 12, H - 14);
      });
      setStatus(`Power Tool crate: ${it.name}`);
      runForeverTaskEngine();
    });
  }

  if (openAccessoryBundle) {
    openAccessoryBundle.addEventListener("click", () => {
      game = normalizeSave(loadSave());
      if (!isTriggerOn("BOSS_UPDATE_TRIGGER")) {
        setStatus("Boss Update is OFF.");
        return refresh();
      }
      if (game.money < 700) {
        setStatus("Not enough money for Accessory Bundle");
        return refresh();
      }
      game.money -= 700;
      const itemId = rollAccessoryBundleLoot();
      ensureItemInInventory(game, itemId);
      saveGame(game);
      refresh();
      updateWeaponsSlots();
      const it = ITEMS[itemId];
      const detail = getItemDetailText(it);
      if (accessoryBundleResult) accessoryBundleResult.textContent = `Got: ${it.name} (${detail})`;
      showLootModal(`Accessory Bundle: ${it.name}`, (ctx, W, H) => {
        ctx.fillStyle = "rgba(255,205,82,.12)";
        ctx.fillRect(0, 0, W, H);
        drawItemTexture(itemId, ctx, W, H);
        ctx.fillStyle = "rgba(234,240,255,.90)";
        ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
        ctx.fillText(detail, 12, H - 14);
      });
      setStatus(`Accessory Bundle: ${it.name}`);
      runForeverTaskEngine();
    });
  }

  if (openLimitedCrate) {
    openLimitedCrate.addEventListener("click", () => {
      if (!isLimitedReleaseCrateEnabled()) return;
      showRedeemModal();
    });
  }
  if (resetSaveBtn) {
    resetSaveBtn.addEventListener("click", () => {
      runVerificationResetFlow(
        () => {
          backupCurrentSaveForRecovery("full-save-reset");
          localStorage.removeItem(SAVE_KEY);
          game = loadSave();
        },
        "Save reset (backup stored for recovery)",
      );
    });
  }

  if (resetCurrencyBtn) {
    resetCurrencyBtn.addEventListener("click", () => {
      runVerificationResetFlow(
        () => {
          backupCurrentSaveForRecovery("currency-reset");
          const s = normalizeSave(loadSave());
          s.money = 0;
          s.magicoin = 0;
          saveGame(s);
          game = loadSave();
        },
        "Money + magicoin reset (backup stored for recovery)",
      );
    });
  }

  updateShopUi = () => {
    game = loadSave();
    refresh();
  };
  refresh();
}

function initForeverTasks() {
  const titleEl = $("#foreverTaskTitle");
  const descEl = $("#foreverTaskDesc");
  const progEl = $("#foreverTaskProgress");
  const rewardEl = $("#foreverTaskReward");
  const stageEl = $("#foreverTaskStage");
  const claimBtn = $("#foreverClaimBtn");
  if (!titleEl || !descEl || !progEl || !rewardEl || !stageEl) return;

  updateForeverUi = () => {
    const s = ensureForeverTaskState(normalizeSave(loadSave()));
    saveGame(s);
    const task = s.forever.currentTask;
    if (!task) {
      titleEl.textContent = "No task";
      descEl.textContent = "";
      progEl.textContent = "";
      rewardEl.textContent = "$0";
      stageEl.textContent = "Stage: -";
      if (claimBtn) claimBtn.disabled = true;
      return;
    }
    const p = getTaskProgress(task, s.stats);
    titleEl.textContent = task.title;
    descEl.textContent =
      task.type === "abs"
        ? "Main progression task — Claim when the bar is full."
        : "Random forever task — Claim when complete.";
    progEl.textContent = p.done ? `${p.text} (Complete!)` : p.text;
    rewardEl.textContent = `$${task.reward}`;
    stageEl.textContent = s.forever.stage < FIRST_TASKS.length ? `Stage: ${s.forever.stage + 1} / ${FIRST_TASKS.length}` : "Stage: Forever Random";
    if (claimBtn) claimBtn.disabled = !s.forever.readyToClaim;
  };

  if (claimBtn) claimBtn.addEventListener("click", () => claimForeverTask());

  runForeverTaskEngine();
  updateForeverUi();
}

function initProgressBugCompensation() {
  const modal = $("#progressBugModal");
  const claimBtn = $("#progressBugClaimBtn");
  if (!modal || !claimBtn) return;

  const hide = () => {
    modal.classList.add("is-hidden");
    modal.setAttribute("aria-hidden", "true");
  };
  const show = () => {
    modal.classList.remove("is-hidden");
    modal.setAttribute("aria-hidden", "false");
  };

  const s = normalizeSave(loadSave());
  if (s.compensation?.progressBugClaimed) {
    hide();
    return;
  }
  show();

  claimBtn.addEventListener("click", () => {
    const cur = normalizeSave(loadSave());
    if (cur.compensation?.progressBugClaimed) {
      hide();
      return;
    }
    cur.money = (cur.money || 0) + 6000;
    addLifetimeMoneyEarned(cur, 6000);
    cur.magicoin = (cur.magicoin || 0) + 7;
    ensureItemInInventory(cur, "bone_bow");
    cur.armor = cur.armor ?? { ownedSet: false, equipped: { helmet: false, chest: false, legs: false, boots: false } };
    cur.armor.ownedSet = true;
    cur.compensation.progressBugClaimed = true;
    saveGame(cur);
    updateShopUi?.();
    updateWeaponsSlots();
    runForeverTaskEngine();
    refreshSettingsStats?.();
    setStatus("Compensation claimed");
    hide();
  });
}

window.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initSettingsPanel();
  initRobot();
  initFights();
  const apocalypseBtn = $("#startApocalypseBtn");
  const armyTechnoBtn = $("#startArmyTechnoBtn");
  const titanZombieBtn = $("#startTitanZombieBtn");
  const galaxyWarriorBtn = $("#startGalaxyWarriorBtn");
  const powerToolItem = $("#powerToolItem");
  const openPowerToolCrate = $("#openPowerToolCrate");
  const powerToolCrateResult = $("#powerToolCrateResult");
  const togglePowerToolMod = $("#togglePowerToolMod");
  const openTriggersBtn = $("#openTriggersBtn");
  const lockTriggersBtn = $("#lockTriggersBtn");
  const triggersWrap = $("#triggersWrap");
  const triggersList = $("#triggersList");
  const triggersLockedNote = $("#triggersLockedNote");
  const recoverLastProgressBtn = $("#recoverLastProgressBtn");
  const recoverLastProgressNote = $("#recoverLastProgressNote");
  const modsStatusNote = $("#modsStatusNote");
  if (apocalypseBtn && window.gameStartFight) {
    apocalypseBtn.addEventListener("click", () => {
      const fightTab = document.querySelector('.tab[data-panel="fights"]');
      if (fightTab) fightTab.click();
      window.gameStartFight("apocalypse");
    });
  }
  if (armyTechnoBtn && window.gameStartFight) {
    const bossCard = armyTechnoBtn.closest(".shopCard");
    if (!isTriggerOn("BOSS_UPDATE_TRIGGER") && bossCard) bossCard.style.display = "none";
    armyTechnoBtn.addEventListener("click", () => {
      if (!isTriggerOn("BOSS_UPDATE_TRIGGER")) {
        setStatus("Boss Update is temporarily unavailable.");
        return;
      }
      const fightTab = document.querySelector('.tab[data-panel="fights"]');
      if (fightTab) fightTab.click();
      window.gameStartFight("armytechno");
    });
  }
  if (titanZombieBtn && window.gameStartFight) {
    titanZombieBtn.addEventListener("click", () => {
      if (!isTriggerOn("BOSS_UPDATE_TRIGGER")) {
        setStatus("Boss Update is temporarily unavailable.");
        return;
      }
      const fightTab = document.querySelector('.tab[data-panel="fights"]');
      if (fightTab) fightTab.click();
      window.gameStartFight("titanzombie");
    });
  }
  if (galaxyWarriorBtn && window.gameStartFight) {
    galaxyWarriorBtn.addEventListener("click", () => {
      if (!isTriggerOn("BOSS_UPDATE_TRIGGER")) {
        setStatus("Boss Update is temporarily unavailable.");
        return;
      }
      const fightTab = document.querySelector('.tab[data-panel="fights"]');
      if (fightTab) fightTab.click();
      window.gameStartFight("galaxywarrior");
    });
  }
  initShop();
  initForeverTasks();
  updateWeaponsSlots();
  initCraftingUi();
  initProgressBugCompensation();

  // Mods + Triggers UI
  let triggersUnlocked = false;
  let mods = loadMods();

  const renderTriggersUi = () => {
    if (!triggersUnlocked) return;
    if (!triggersList || typeof window.allTriggers !== "function" || typeof window.setTrigger !== "function") return;
    const rows = [
      ...window.allTriggers().map((row) => ({ ...row, local: false })),
      ...allLocalEventTriggers().map((row) => ({ ...row, local: true })),
    ];
    triggersList.innerHTML = "";
    for (const row of rows) {
      const wrap = document.createElement("label");
      wrap.style.display = "flex";
      wrap.style.gap = "10px";
      wrap.style.alignItems = "center";
      wrap.style.margin = "6px 0";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!row.enabled;
      cb.addEventListener("change", () => {
        if (row.local) setLocalEventTrigger(row.id, cb.checked);
        else window.setTrigger(row.id, cb.checked);
      });
      const txt = document.createElement("span");
      txt.textContent = row.id;
      wrap.appendChild(cb);
      wrap.appendChild(txt);
      triggersList.appendChild(wrap);
    }
  };

  const applyModsVisibility = () => {
    const modsOn = isTriggerOn("MOD_TRIGGER");
    const powerToolOn = modsOn && !!mods.powerToolMod;
    if (togglePowerToolMod) {
      togglePowerToolMod.checked = !!mods.powerToolMod;
      togglePowerToolMod.disabled = !modsOn;
    }
    if (powerToolItem) powerToolItem.style.display = powerToolOn ? "" : "none";
    if (triggersWrap) triggersWrap.style.display = triggersUnlocked ? "" : "none";
    if (lockTriggersBtn) lockTriggersBtn.style.display = triggersUnlocked ? "" : "none";
    if (triggersLockedNote) {
      triggersLockedNote.textContent = triggersUnlocked ? "Unlocked." : "Enter password to unlock triggers.";
    }
    if (recoverLastProgressNote) {
      const hasBackup = !!localStorage.getItem(LAST_DELETED_PROGRESS_KEY);
      recoverLastProgressNote.textContent = hasBackup ? "Backup found. You can recover latest deleted progress." : "No deleted-progress backup found yet.";
    }
    if (modsStatusNote) {
      modsStatusNote.textContent = modsOn
        ? `MOD_TRIGGER is ON. Power Tool Mod is ${powerToolOn ? "ON" : "OFF"}.`
        : "MOD_TRIGGER is OFF. Mods are disabled.";
    }
    updateShopUi?.();
  };

  applyModsVisibility();
  window.addEventListener("triggers:changed", () => {
    renderTriggersUi();
    applyModsVisibility();
  });

  if (openTriggersBtn) {
    openTriggersBtn.addEventListener("click", () => {
      const pwd = window.prompt("Password?");
      if (pwd !== "VavaSteve") {
        setStatus("Wrong password");
        return;
      }
      triggersUnlocked = true;
      renderTriggersUi();
      applyModsVisibility();
      setStatus("Triggers unlocked");
    });
  }

  if (lockTriggersBtn) {
    lockTriggersBtn.addEventListener("click", () => {
      triggersUnlocked = false;
      applyModsVisibility();
      setStatus("Triggers locked");
    });
  }

  if (recoverLastProgressBtn) {
    recoverLastProgressBtn.addEventListener("click", () => {
      if (!triggersUnlocked) {
        setStatus("Unlock triggers first.");
        return;
      }
      const ok = window.confirm("Recover the latest deleted progress backup?");
      if (!ok) return;
      const res = restoreLastDeletedProgress();
      if (!res.ok) {
        setStatus("No recoverable backup found.");
        applyModsVisibility();
        return;
      }
      updateShopUi?.();
      updateWeaponsSlots();
      runForeverTaskEngine?.();
      applyModsVisibility();
      setStatus("Recovered last deleted progress.");
    });
  }

  if (openPowerToolCrate) {
    // handled in initShop()
  }

  if (togglePowerToolMod) {
    togglePowerToolMod.addEventListener("change", () => {
      mods.powerToolMod = !!togglePowerToolMod.checked;
      saveMods(mods);
      applyModsVisibility();
      setStatus(`Power Tool Mod: ${mods.powerToolMod ? "ON" : "OFF"}`);
    });
  }

  setStatus("Ready");
});

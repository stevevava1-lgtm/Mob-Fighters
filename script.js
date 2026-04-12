const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// --------- Save / Economy ----------
const SAVE_KEY = "bossFightingSave_v1";

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw)
      return {
        money: 0,
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
          totalWins: 0,
          basicCratesOpened: 0,
          releaseCratesOpened: 0,
        },
        forever: { stage: 0, lastRandomId: null, currentTask: null, readyToClaim: false },
      };
    const parsed = JSON.parse(raw);
    return {
      money: typeof parsed.money === "number" ? parsed.money : 0,
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
        totalWins: Number(parsed?.stats?.totalWins || 0),
        basicCratesOpened: Number(parsed?.stats?.basicCratesOpened || 0),
        releaseCratesOpened: Number(parsed?.stats?.releaseCratesOpened || 0),
      },
      forever: {
        stage: Number(parsed?.forever?.stage || 0),
        lastRandomId: parsed?.forever?.lastRandomId ?? null,
        currentTask: parsed?.forever?.currentTask ?? null,
        readyToClaim: !!parsed?.forever?.readyToClaim,
      },
    };
  } catch {
    return {
      money: 0,
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
        totalWins: 0,
        basicCratesOpened: 0,
        releaseCratesOpened: 0,
      },
      forever: { stage: 0, lastRandomId: null, currentTask: null, readyToClaim: false },
    };
  }
}

function saveGame(state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
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
  if (it.bow) return `Bow: ${it.bowDmg} dmg/arrow (auto-aim)`;
  if (it.type === "weapon") return `+${it.dmg} DMG` + (it.rangeMult > 1 ? `, ${it.rangeMult}x range` : "");
  return `+${it.hp} HP` + (it.moveMult > 1 ? `, ${it.moveMult}x movement speed` : "");
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
  if (!save.stats) {
    save.stats = {
      rogueKills: 0,
      singleWins: 0,
      hordeWins: 0,
      technoWins: 0,
      skeletonWins: 0,
      totalWins: 0,
      basicCratesOpened: 0,
      releaseCratesOpened: 0,
    };
  }
  if (save.stats.skeletonWins === undefined || save.stats.skeletonWins === null) save.stats.skeletonWins = 0;
  if (!save.forever) save.forever = { stage: 0, lastRandomId: null, currentTask: null, readyToClaim: false };
  if (typeof save.forever.readyToClaim !== "boolean") save.forever.readyToClaim = false;

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
  {
    id: "r_event_horde_release",
    title: "Event: Win 3× Dog Horde",
    reward: 0,
    rewardKind: "releaseCrate",
    type: "delta",
    goals: [{ key: "hordeWins", target: 3, label: "Dog Horde wins" }],
  },
  {
    id: "r_event_techno_release",
    title: "Event: Win 2× Techno Super Dog",
    reward: 0,
    rewardKind: "releaseCrate",
    type: "delta",
    goals: [{ key: "technoWins", target: 2, label: "Techno wins" }],
  },
];

function cloneStats(stats) {
  return {
    rogueKills: Number(stats?.rogueKills || 0),
    singleWins: Number(stats?.singleWins || 0),
    hordeWins: Number(stats?.hordeWins || 0),
    technoWins: Number(stats?.technoWins || 0),
    skeletonWins: Number(stats?.skeletonWins || 0),
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
  let candidates = RANDOM_TASKS.filter((t) => t.id !== lastRandomId);
  candidates = candidates.filter((t) => !(t.id === "r_skeleton" && sk < 1));
  const pick = candidates[(Math.random() * candidates.length) | 0] || RANDOM_TASKS[0];
  return makeTaskState(pick, cloneStats(stats));
}

/** Fix stuck/old event tasks (e.g. dual goal + open crate) when definitions change. */
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
  if (t.id === "r_event_horde_release") {
    const oldBase = Number(t.baseStats?.hordeWins ?? 0);
    const hordeProg = Math.max(0, save.stats.hordeWins - oldBase);
    const credit = Math.min(hordeProg, 2);
    bs.hordeWins = save.stats.hordeWins - credit;
  } else if (t.id === "r_event_techno_release") {
    const oldBase = Number(t.baseStats?.technoWins ?? 0);
    const technoProg = Math.max(0, save.stats.technoWins - oldBase);
    const credit = Math.min(technoProg, 2);
    bs.technoWins = save.stats.technoWins - credit;
  }
  save.forever.currentTask = makeTaskState(def, bs);
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
  const rk = curTask.rewardKind || "money";
  if (rk === "releaseCrate") {
    const itemId = rollLimitedReleaseLoot();
    ensureItemInInventory(s, itemId);
    s.stats.releaseCratesOpened = (s.stats.releaseCratesOpened || 0) + 1;
    saveGame(s);
    revealFreeReleaseCrate?.(itemId);
  } else {
    s.money = (s.money || 0) + Number(curTask.reward || 0);
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
}

// --------- Redeem / Limited Release Crate ----------
const LIMITED_RELEASE_CRATE_ENABLED = true; // set to false when you want to remove it

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
  };

  for (const t of tabs) {
    t.addEventListener("click", () => activate(t.dataset.panel));
  }

  activate("fights");
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

  const nameOrNone = (itemId) => (itemId && ITEMS[itemId] ? ITEMS[itemId].name : "You don't own any");

  set("slotHelmetValue", nameOrNone(save.equipped.helmet));
  set("slotChestValue", nameOrNone(save.equipped.chest));
  set("slotLegsValue", nameOrNone(save.equipped.legs));
  set("slotBootsValue", nameOrNone(save.equipped.boots));
  set("slotWeapon1Value", nameOrNone(save.equipped.weapon1));
  set("slotWeapon2Value", nameOrNone(save.equipped.weapon2));

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
          return { id, label: `${ITEMS[id].name}${suffix}` };
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
}

let updateShopUi = null;
let updateForeverUi = null;
/** Set in initShop: (itemId) => void — shows Limited Release reveal after event task */
let revealFreeReleaseCrate = null;

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
  const moneyText = $("#moneyText");
  const arenaTerrainLabel = $("#arenaTerrainLabel");

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

  const world = {
    w: canvas.width,
    h: canvas.height,
    // Big slide in the middle (solid, can't walk through)
    slide: { x: canvas.width / 2 - 130, y: canvas.height / 2 - 90, w: 260, h: 180 },
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
    bowDmg: 0,
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
  let dogs = [makeDog(world.w * 0.75, world.h * 0.45)];

  const keys = new Set();
  let mouseDown = false;
  let gameOver = false;
  let fightStarted = false;
  let lastT = performance.now();
  let lastMove = { x: 1, y: 0 };
  let animT = 0;
  let rewardGranted = false;
  let fightMode = "single"; // single | horde | techno | skeleton
  let terrainType = "playground"; // playground | paintball
  let paintballObstacles = [];
  let arrows = [];
  let playerMoving = false;
  let slideDestroyed = false;
  let slideLaserMs = 0;
  let slideExplosionMs = 0;

  const getSolidObstacles = () => {
    if (terrainType === "paintball") return paintballObstacles;
    if (!slideDestroyed) return [world.slide];
    return [];
  };

  const updateMoneyUi = () => {
    if (!moneyText) return;
    const s = loadSave();
    moneyText.textContent = `$${s.money}`;
  };

  const addMoney = (amount) => {
    const s = loadSave();
    s.money = (s.money || 0) + amount;
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
    const helmet = eq.helmet ? ITEMS[eq.helmet] : null;
    const chest = eq.chest ? ITEMS[eq.chest] : null;
    const legs = eq.legs ? ITEMS[eq.legs] : null;
    const boots = eq.boots ? ITEMS[eq.boots] : null;
    const weapon1 = eq.weapon1 ? ITEMS[eq.weapon1] : null;

    const hpBonus = (helmet?.hp ?? 0) + (chest?.hp ?? 0) + (legs?.hp ?? 0) + (boots?.hp ?? 0);
    const moveMult = Math.max(1.0, (chest?.moveMult ?? 1.0));

    if (weapon1?.bow) {
      player.usingBow = true;
      player.bowDmg = Number(weapon1.bowDmg ?? 0);
      player.dmg = 5;
      player.rangeMult = weapon1?.rangeMult ?? 1.0;
    } else {
      player.usingBow = false;
      player.bowDmg = 0;
      player.dmg = 5 + (weapon1?.dmg ?? 0);
      player.rangeMult = weapon1?.rangeMult ?? 1.0;
    }
    player.speed = 170 * moveMult;

    const newMax = 100 + hpBonus;
    const delta = newMax - player.hpMax;
    player.hpMax = newMax;
    player.hp = clamp(player.hp + delta, 0, player.hpMax);

    if (fightHintEl) {
      const w = weapon1;
      if (w?.bow) {
        fightHintEl.textContent = `${w.name}: ${player.bowDmg} dmg/arrow (auto-aim). Cooldown: 1.0s`;
      } else {
        fightHintEl.textContent = `Equipped weapon damage: ${player.dmg}. Cooldown: 1.0s`;
      }
    }
  };

  const reset = () => {
    player.hp = player.hpMax;
    player.cdLeft = 0;
    player.dashCdLeft = 0;
    player.x = world.w * 0.25;
    player.y = world.h * 0.65;

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
    }

    gameOver = false;
    rewardGranted = false;
    arrows = [];
    if (terrainType === "playground") {
      slideDestroyed = false;
      slideLaserMs = 0;
      slideExplosionMs = 0;
    }
    applyLoadout();
  };

  const setUi = () => {
    const pPct = clamp(player.hp / player.hpMax, 0, 1) * 100;
    const totalMax = dogs.reduce((a, d) => a + d.hpMax, 0) || 1;
    const totalHp = dogs.reduce((a, d) => a + Math.max(0, d.hp), 0);
    const dPct = clamp(totalHp / totalMax, 0, 1) * 100;
    if (ui.playerFill) ui.playerFill.style.width = `${pPct}%`;
    if (ui.dogFill) ui.dogFill.style.width = `${dPct}%`;
    if (ui.playerText) ui.playerText.textContent = `${player.hp} / ${player.hpMax}`;
    if (ui.dogText) ui.dogText.textContent = `${totalHp} / ${totalMax}`;

    const pReady = player.cdLeft <= 0 ? "ready" : `${(player.cdLeft / 1000).toFixed(1)}s`;
    const dogCdLeft = dogs.reduce((m, d) => Math.min(m, d.cdLeft ?? 0), Infinity);
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
      else if (terrainType === "paintball") arenaTerrainLabel.textContent = "Terrain: Paintball Arena (7 bunkers)";
      else arenaTerrainLabel.textContent = slideDestroyed ? "Terrain: Playground (slide destroyed)" : "Terrain: Playground (slide is solid)";
    }
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

  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) mouseDown = true;
    if (e.button === 2) {
      e.preventDefault();
      tryDash();
    }
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("mouseup", (e) => {
    if (e.button !== 0) return;
    mouseDown = false;
  });

  const tryPlayerAttack = () => {
    if (!fightStarted) return;
    if (gameOver) return;
    if (player.cdLeft > 0) return;
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
      const mobName =
        best.kind === "skeleton" ? "Skeleton" : best.kind === "techno" ? "Techno Super Dog" : "Rogue Dog";
      setStatus(`Arrow → ${mobName} (${player.bowDmg} dmg)`);
      return;
    }

    const range = (player.r + best.r + 16) * (player.rangeMult ?? 1.0);
    if (bestD > range) return; // melee range
    player.cdLeft = player.cdMs;
    best.hp = clamp(best.hp - player.dmg, 0, best.hpMax);
    const mobName =
      best.kind === "skeleton" ? "Skeleton" : best.kind === "techno" ? "Techno Super Dog" : "Rogue Dog";
    setStatus(`Hit ${mobName} for ${player.dmg}`);
  };

  const tryDash = () => {
    if (!fightStarted) return;
    if (gameOver) return;
    if (player.dashCdLeft > 0) return;

    const dashDist = 88; // "launch forward a bit"
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
      if (d0.kind === "skeleton" || d0.kind === "techno") continue;
      if (d0.cdLeft > 0) continue;
      const d = len(d0.x - player.x, d0.y - player.y);
      if (d > player.r + d0.r + 10) continue;
      d0.cdLeft = d0.cdMs;
      player.hp = clamp(player.hp - d0.dmg, 0, player.hpMax);
      d0.mode = "retreat";
      d0.retreatLeft = d0.justHitRetreatMs;
      setStatus(`Rogue Dog hit you for ${d0.dmg}`);
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
      const onPlayground = terrainType === "playground";
      const blockedBySlide =
        onPlayground && !slideDestroyed && segmentIntersectsAabb(x1, y1, player.x, player.y, world.slide);
      if (!blockedBySlide && dist <= player.r + d0.laserHalfW) {
        player.hp = clamp(player.hp - d0.laserDps * (dtMs / 1000), 0, player.hpMax);
        if (player.hp <= 0) {
          gameOver = true;
          setStatus("You were defeated");
        }
      }

      if (onPlayground && !slideDestroyed) {
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
      setStatus("Techno Super Dog used Bite");
      d0.nextActionInMs = 1000;
      return;
    }
    // laser
    const dx = player.x - d0.x;
    const dy = player.y - d0.y;
    const n = Math.hypot(dx, dy) || 1;
    d0.laserDir = { x: dx / n, y: dy / n };
    d0.laserActiveMs = 5000;
    d0.nextActionInMs = 6000; // 5s laser + 1s interval
    setStatus("Techno Super Dog fired Laser");
  };

  function step(dt) {
    animT += dt;
    slideExplosionMs = Math.max(0, slideExplosionMs - dt * 1000);
    // cooldowns
    player.cdLeft = Math.max(0, player.cdLeft - dt * 1000);
    player.dashCdLeft = Math.max(0, player.dashCdLeft - dt * 1000);
    for (const d0 of dogs) d0.cdLeft = Math.max(0, d0.cdLeft - dt * 1000);

    // player movement
    let vx = 0;
    let vy = 0;
    if (keys.has("w")) vy -= 1;
    if (keys.has("s")) vy += 1;
    if (keys.has("a")) vx -= 1;
    if (keys.has("d")) vx += 1;
    playerMoving = keys.has("w") || keys.has("a") || keys.has("s") || keys.has("d");
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
        if (d0.kind === "techno") technoAttackStep(d0, dt * 1000);
        if (gameOver) break;
        let dx = player.x - d0.x;
        let dy = player.y - d0.y;
        let d = Math.hypot(dx, dy) || 1;

        if (d0.kind === "techno" && d0.laserActiveMs > 0) {
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
        let ddx = ux * d0.speed * dt;
        let ddy = uy * d0.speed * dt;

        let dax = clamp(d0.x + ddx, d0.r, world.w - d0.r);
        let day = clamp(d0.y + ddy, d0.r, world.h - d0.r);
        const dogSolid = getSolidObstacles();
        const pushedDog = resolveCircleVsObstacles({ x: dax, y: day }, d0.r, dogSolid);
        d0.x = pushedDog.x;
        d0.y = pushedDog.y;
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
                d0.hp = clamp(d0.hp - a.dmg, 0, d0.hpMax);
                const mobName =
                  d0.kind === "skeleton" ? "Skeleton" : d0.kind === "techno" ? "Techno Super Dog" : "Rogue Dog";
                setStatus(`Arrow hit ${mobName} for ${a.dmg}`);
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

      const hasTechno = dogs.some((d0) => d0.kind === "techno" && d0.hp > 0);
      if (!hasTechno) dogHitPlayer();
    }

    // rewards + win condition
    if (fightStarted && !gameOver) {
      for (const d0 of dogs) {
        if (d0.hp <= 0 && !d0.rewarded) {
          d0.rewarded = true;
          const s = normalizeSave(loadSave());
          if (d0.kind !== "techno" && d0.kind !== "skeleton") s.stats.rogueKills += 1;
          saveGame(s);
        }
      }
      const alive = dogs.some((d0) => d0.hp > 0);
      if (!alive) {
        gameOver = true;
        const s = normalizeSave(loadSave());
        s.stats.totalWins += 1;
        if (fightMode === "horde") s.stats.hordeWins += 1;
        else if (fightMode === "techno") s.stats.technoWins += 1;
        else if (fightMode === "skeleton") s.stats.skeletonWins += 1;
        else s.stats.singleWins += 1;
        saveGame(s);
        if (!rewardGranted) {
          rewardGranted = true;
          if (fightMode === "horde") addMoney(50);
          else if (fightMode === "skeleton") addMoney(70);
          else addMoney(10);
        }
        runForeverTaskEngine();
        setStatus("Victory");
      }
    }

    setUi();
  }

  function draw() {
    const W = world.w;
    const H = world.h;
    ctx.clearRect(0, 0, W, H);

    if (!fightStarted) {
      // Before selection: pure black + prompt
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(234,240,255,.92)";
      ctx.font = "26px ui-sans-serif, system-ui, Segoe UI";
      ctx.fillText("choose a enemy!", W / 2 - 108, H / 2 - 6);
      ctx.fillStyle = "rgba(234,240,255,.70)";
      ctx.font = "13px ui-monospace, Menlo, Consolas, monospace";
      ctx.fillText("Click a mob in the list to start", W / 2 - 132, H / 2 + 18);
      // show player preview only
      drawPlayer(ctx, player, animT, lastMove);
      return;
    }

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

    // entities
    drawPlayer(ctx, player, animT, lastMove);
    for (const d0 of dogs) {
      if (d0.hp <= 0) continue;
      if (d0.kind === "techno") drawTechnoDog(ctx, d0, animT);
      else if (d0.kind === "skeleton") drawSkeleton(ctx, d0, animT);
      else drawRogueDog(ctx, d0, animT);
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

    if (gameOver) {
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(234,240,255,.95)";
      ctx.font = "24px ui-sans-serif, system-ui, Segoe UI";
      const text = player.hp <= 0 ? "DEFEATED" : "VICTORY";
      ctx.fillText(text, W / 2 - 62, H / 2 - 10);
      ctx.fillStyle = "rgba(234,240,255,.75)";
      ctx.font = "14px ui-monospace, Menlo, Consolas, monospace";
      ctx.fillText("Press R to reset", W / 2 - 72, H / 2 + 18);
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
        const c = sprite.p[y * sw + x];
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

  function drawTechnoDog(g, d0, t) {
    const scale = 8;
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
      if (terrainType === "playground" && !slideDestroyed) {
        const hit = segmentClipAabbT(d0.x, d0.y - 2, x2, y2, world.slide);
        if (hit && hit.tEnter >= 0) {
          x2 = d0.x + (x2 - d0.x) * hit.tEnter;
          y2 = (d0.y - 2) + (y2 - (d0.y - 2)) * hit.tEnter;
        }
      }
      g.strokeStyle = "rgba(255,70,70,.85)";
      g.lineWidth = 14;
      g.beginPath();
      g.moveTo(d0.x, d0.y - 2);
      g.lineTo(x2, y2);
      g.stroke();
      g.strokeStyle = "rgba(255,180,180,.95)";
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(d0.x, d0.y - 2);
      g.lineTo(x2, y2);
      g.stroke();
    }

    g.strokeStyle = "rgba(37,228,255,.38)";
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
    if (mode === "skeleton") {
      fightMode = "skeleton";
      terrainType = "paintball";
      paintballObstacles = buildPaintballObstacles(world.w, world.h);
      slideDestroyed = true;
      dogs = [makeSkeleton(world.w * 0.78, world.h * 0.42)];
      if (enemyLabel) enemyLabel.textContent = "Skeleton";
    } else {
      terrainType = "playground";
      paintballObstacles = [];
      fightMode = mode === "horde" ? "horde" : mode === "techno" ? "techno" : "single";
      if (mode === "horde") {
        dogs = [
          makeDog(world.w * 0.72, world.h * 0.40),
          makeDog(world.w * 0.80, world.h * 0.52),
          makeDog(world.w * 0.70, world.h * 0.58),
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
      mode === "skeleton"
        ? "Fight started: Skeleton (Paintball Arena)"
        : mode === "horde"
          ? "Fight started: Dog Horde!!!"
          : mode === "techno"
            ? "Fight started: Techno Super Dog"
            : "Fight started: Rogue Dog",
    );
  };

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
  const buySet = $("#buyReleasiteSet");
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
  const ownedReleasite = $("#ownedReleasite");
  const lootCrateResult = $("#lootCrateResult");
  const openUndeadCrate = $("#openUndeadCrate");
  const undeadCrateResult = $("#undeadCrateResult");
  const buyBowSpecial = $("#buyBowSpecial");
  const bowSpecialNote = $("#bowSpecialNote");
  const lootModal = $("#lootModal");
  const lootCanvas = $("#lootCanvas");
  const lootText = $("#lootText");
  const closeLootModal = $("#closeLootModal");

  if (!moneyText) return;

  let game = loadSave();

  const refresh = () => {
    moneyText.textContent = `$${game.money}`;
    const owned = !!game.armor?.ownedSet;
    if (ownedReleasite) ownedReleasite.textContent = owned ? "Owned (equip in Fights)" : "";
    if (buySet) buySet.disabled = owned || game.money < 300;
    if (openUndeadCrate) openUndeadCrate.disabled = game.money < 500;
    if (buyBowSpecial) buyBowSpecial.disabled = game.money < 2500;
    if (bowSpecialNote) {
      const n = Number(game.inventory?.counts?.bone_bow ?? 0);
      bowSpecialNote.textContent = n > 0 ? `You own: ${n}× Bow (equip in Weapons)` : "";
    }
    if (limitedSection) limitedSection.style.display = LIMITED_RELEASE_CRATE_ENABLED ? "" : "none";
  };

  const commit = () => {
    saveGame(game);
    refresh();
  };

  if (buySet) {
    buySet.addEventListener("click", () => {
      game = loadSave();
      if (game.money < 300) return refresh();
      if (!game.armor) game.armor = { ownedSet: false, equipped: { helmet: false, chest: false, legs: false, boots: false } };
      if (game.armor.ownedSet) return refresh();
      game.money -= 300;
      game.armor.ownedSet = true;
      // keep equipped false by default
      commit();
      setStatus("Bought: Full set of Releasite armor!!!");
      updateWeaponsSlots();
    });
  }

  if (buyBowSpecial) {
    buyBowSpecial.addEventListener("click", () => {
      game = normalizeSave(loadSave());
      if (game.money < 2500) {
        setStatus("Not enough money for Bow (special)");
        return refresh();
      }
      game.money -= 2500;
      ensureItemInInventory(game, "bone_bow");
      saveGame(game);
      refresh();
      updateWeaponsSlots();
      setStatus("Bought: Bow (special deal — 2500$)");
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
      if (redeemHelp) redeemHelp.textContent = res.reason === "used" ? "That code was already used." : "Incorrect code.";
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
    if (it.type === "weapon") {
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

  revealFreeReleaseCrate = (itemId) => {
    if (!LIMITED_RELEASE_CRATE_ENABLED || !itemId || !ITEMS[itemId]) return;
    const it = ITEMS[itemId];
    const detail = getItemDetailText(it);
    if (limitedCrateResult) limitedCrateResult.textContent = `Event reward (free crate): ${it.name} (${detail})`;
    showLootModal(
      `Event reward: ${it.name}`,
      (ctx, W, H) => {
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
      },
      "limited",
    );
    setStatus(`Event task: free Limited Release Crate — ${it.name}`);
    updateWeaponsSlots();
    updateShopUi?.();
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

  if (openLimitedCrate) {
    openLimitedCrate.addEventListener("click", () => {
      if (!LIMITED_RELEASE_CRATE_ENABLED) return;
      showRedeemModal();
    });
  }
  if (resetSaveBtn) {
    resetSaveBtn.addEventListener("click", () => {
      localStorage.removeItem(SAVE_KEY);
      game = loadSave();
      refresh();
      runForeverTaskEngine();
      setStatus("Save reset");
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
      task.rewardKind === "releaseCrate"
        ? "Event: complete the wins, then Claim — your Limited Release Crate opens immediately."
        : task.type === "abs"
          ? "Main progression task — Claim when the bar is full."
          : "Random forever task — Claim when complete.";
    progEl.textContent = p.done ? `${p.text} (Complete!)` : p.text;
    rewardEl.textContent = task.rewardKind === "releaseCrate" ? "Reward: 1× Release Crate" : `$${task.reward}`;
    stageEl.textContent = s.forever.stage < FIRST_TASKS.length ? `Stage: ${s.forever.stage + 1} / ${FIRST_TASKS.length}` : "Stage: Forever Random";
    if (claimBtn) claimBtn.disabled = !s.forever.readyToClaim;
  };

  if (claimBtn) claimBtn.addEventListener("click", () => claimForeverTask());

  runForeverTaskEngine();
  updateForeverUi();
}

window.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initRobot();
  initFights();
  initShop();
  initForeverTasks();
  updateWeaponsSlots();
  setStatus("Ready");
});

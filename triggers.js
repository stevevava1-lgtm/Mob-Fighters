// Centralized trigger config (editable in one place).
// This file is safe to edit manually.
//
// - Defaults live in DEFAULT_TRIGGERS
// - Runtime values persist in localStorage (overrides defaults)

(() => {
  const KEY = "bossFightingTriggers_v1";

  //All The Triggers Are Here
  const DEFAULT_TRIGGERS = {
    // Boss content master switch
    BOSS_UPDATE_TRIGGER: false,
    // Mods master switch (enables mod features)
    MOD_TRIGGER: false,
    // Shadow Blade event weapon in Shop (!)
    SHADOW_BLADE_EVENT_TRIGGER: true,
    // Unlocks "Powers" hotkeys in fights (Z/X/C/V)
    ".js": false,
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      // First-ever load: seed defaults into localStorage so players start
      // with the trigger states defined in this file.
      if (!raw) {
        const seeded = { ...DEFAULT_TRIGGERS };
        try {
          localStorage.setItem(KEY, JSON.stringify(seeded));
        } catch {
          // ignore
        }
        return seeded;
      }
      const parsed = JSON.parse(raw);
      const next = { ...DEFAULT_TRIGGERS };
      if (parsed && typeof parsed === "object") {
        for (const k of Object.keys(DEFAULT_TRIGGERS)) {
          if (Object.prototype.hasOwnProperty.call(parsed, k)) next[k] = !!parsed[k];
        }
      }
      return next;
    } catch {
      return { ...DEFAULT_TRIGGERS };
    }
  };

  const save = (obj) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(obj));
    } catch {
      // ignore
    }
  };

  const state = load();

  const getTrigger = (id) => !!state[id];
  const setTrigger = (id, enabled) => {
    state[id] = !!enabled;
    save(state);
    window.dispatchEvent(new CustomEvent("triggers:changed", { detail: { id, enabled: !!enabled } }));
  };
  const allTriggers = () => Object.keys(DEFAULT_TRIGGERS).sort().map((k) => ({ id: k, enabled: !!state[k] }));

  window.getTrigger = getTrigger;
  window.setTrigger = setTrigger;
  window.allTriggers = allTriggers;
})();


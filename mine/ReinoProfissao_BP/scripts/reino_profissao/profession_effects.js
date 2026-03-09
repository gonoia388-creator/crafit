import { EquipmentSlot, ItemStack, system, world } from "@minecraft/server";
import { DEFAULT_PROFESSION_TIER_ID } from "./constants.js";
import {
  getPlayerProfession,
  getPlayerProfessionTier,
  sanitizePlayerSelections,
} from "./state.js";

const PASSIVE_EFFECT_INTERVAL_TICKS = 40;
const PASSIVE_EFFECT_DURATION_TICKS = 80;
const PASSIVE_EFFECT_MIN_REMAINING_TICKS = 20;
const CROP_GROWTH_INTERVAL_TICKS = 20;
const ANIMAL_GROWTH_INTERVAL_TICKS = 100;
const VILLAGER_SESSION_INTERVAL_TICKS = 10;
const CLEANUP_INTERVAL_TICKS = 200;

const SHEEP_SHEAR_COOLDOWN_MS = 30000;
const SHEEP_INTERACTION_WINDOW_MS = 1500;
const VILLAGER_BLOCK_MESSAGE_COOLDOWN_MS = 1500;
const VILLAGER_SESSION_TTL_MS = 15000;
const VILLAGER_SESSION_MIN_REWARD_DISTANCE = 10;
const BREEDING_HINT_TTL_MS = 12000;
const POTION_SNAPSHOT_TTL_MS = 10000;
const BREW_REFUND_CHECK_TTL_MS = 4000;

const TRADE_COUNTER_OBJECTIVE_ID = "rp_trade_count";
const EXTRA_BABY_SKIP_TAG = "rp:extra_baby_generated";

const VILLAGER_TYPE_IDS = Object.freeze(
  new Set(["minecraft:villager", "minecraft:villager_v2", "minecraft:wandering_trader"])
);
const SHEEP_TYPE_ID = "minecraft:sheep";
const BREWING_STAND_TYPE_ID = "minecraft:brewing_stand";

const NEGATIVE_EFFECT_IDS = Object.freeze(
  new Set([
    "minecraft:bad_omen",
    "minecraft:blindness",
    "minecraft:darkness",
    "minecraft:fatal_poison",
    "minecraft:hunger",
    "minecraft:levitation",
    "minecraft:mining_fatigue",
    "minecraft:nausea",
    "minecraft:poison",
    "minecraft:slowness",
    "minecraft:weakness",
    "minecraft:wither",
  ])
);

const BREWING_INGREDIENT_IDS = Object.freeze(
  new Set([
    "minecraft:blaze_powder",
    "minecraft:dragon_breath",
    "minecraft:fermented_spider_eye",
    "minecraft:ghast_tear",
    "minecraft:glistering_melon_slice",
    "minecraft:glowstone_dust",
    "minecraft:golden_carrot",
    "minecraft:gunpowder",
    "minecraft:magma_cream",
    "minecraft:nether_wart",
    "minecraft:phantom_membrane",
    "minecraft:pufferfish",
    "minecraft:rabbit_foot",
    "minecraft:redstone",
    "minecraft:spider_eye",
    "minecraft:sugar",
    "minecraft:turtle_shell",
  ])
);

const POTION_ITEM_IDS = Object.freeze(
  new Set(["minecraft:potion", "minecraft:splash_potion", "minecraft:lingering_potion"])
);

const BOW_PROJECTILE_TYPE_IDS = Object.freeze(
  new Set([
    "minecraft:arrow",
    "minecraft:tipped_arrow",
    "minecraft:spectral_arrow",
    "minecraft:firework_rocket",
  ])
);

const ORE_BONUS_CONFIG = Object.freeze({
  coal: Object.freeze({
    blocks: new Set(["minecraft:coal_ore", "minecraft:deepslate_coal_ore"]),
    item: "minecraft:coal",
  }),
  copper: Object.freeze({
    blocks: new Set(["minecraft:copper_ore", "minecraft:deepslate_copper_ore"]),
    item: "minecraft:raw_copper",
  }),
  iron: Object.freeze({
    blocks: new Set(["minecraft:iron_ore", "minecraft:deepslate_iron_ore"]),
    item: "minecraft:raw_iron",
  }),
  gold: Object.freeze({
    blocks: new Set([
      "minecraft:gold_ore",
      "minecraft:deepslate_gold_ore",
      "minecraft:nether_gold_ore",
    ]),
    item: "minecraft:raw_gold",
  }),
});

const CROP_HARVEST_CONFIG = Object.freeze({
  "minecraft:wheat": Object.freeze({ itemId: "minecraft:wheat", stateName: "growth", maxState: 7 }),
  "minecraft:carrots": Object.freeze({ itemId: "minecraft:carrot", stateName: "growth", maxState: 7 }),
  "minecraft:potatoes": Object.freeze({ itemId: "minecraft:potato", stateName: "growth", maxState: 7 }),
  "minecraft:beetroot": Object.freeze({ itemId: "minecraft:beetroot", stateName: "growth", maxState: 3 }),
  "minecraft:sweet_berry_bush": Object.freeze({
    itemId: "minecraft:sweet_berries",
    stateName: "age",
    maxState: 3,
  }),
});

const NETHER_WART_CONFIG = Object.freeze({
  blockId: "minecraft:nether_wart",
  itemId: "minecraft:nether_wart",
  stateName: "age",
  maxState: 3,
});

const ANIMAL_MEAT_DROPS = Object.freeze({
  "minecraft:cow": "minecraft:beef",
  "minecraft:mooshroom": "minecraft:beef",
  "minecraft:pig": "minecraft:porkchop",
  "minecraft:chicken": "minecraft:chicken",
  "minecraft:sheep": "minecraft:mutton",
  "minecraft:rabbit": "minecraft:rabbit",
  "minecraft:goat": "minecraft:mutton",
  "minecraft:hoglin": "minecraft:porkchop",
});

const BREEDING_ITEMS_BY_ANIMAL = Object.freeze({
  "minecraft:cow": new Set(["minecraft:wheat"]),
  "minecraft:mooshroom": new Set(["minecraft:wheat"]),
  "minecraft:sheep": new Set(["minecraft:wheat"]),
  "minecraft:goat": new Set(["minecraft:wheat"]),
  "minecraft:pig": new Set([
    "minecraft:carrot",
    "minecraft:potato",
    "minecraft:beetroot",
  ]),
  "minecraft:chicken": new Set([
    "minecraft:wheat_seeds",
    "minecraft:beetroot_seeds",
    "minecraft:pumpkin_seeds",
    "minecraft:melon_seeds",
    "minecraft:torchflower_seeds",
    "minecraft:pitcher_pod",
  ]),
  "minecraft:rabbit": new Set([
    "minecraft:carrot",
    "minecraft:dandelion",
    "minecraft:golden_carrot",
  ]),
  "minecraft:horse": new Set(["minecraft:golden_apple", "minecraft:golden_carrot"]),
  "minecraft:donkey": new Set(["minecraft:golden_apple", "minecraft:golden_carrot"]),
  "minecraft:mule": new Set(["minecraft:golden_apple", "minecraft:golden_carrot"]),
  "minecraft:llama": new Set(["minecraft:hay_block"]),
  "minecraft:camel": new Set(["minecraft:cactus"]),
  "minecraft:wolf": new Set([
    "minecraft:beef",
    "minecraft:cooked_beef",
    "minecraft:chicken",
    "minecraft:cooked_chicken",
    "minecraft:mutton",
    "minecraft:cooked_mutton",
    "minecraft:porkchop",
    "minecraft:cooked_porkchop",
    "minecraft:rabbit",
    "minecraft:cooked_rabbit",
    "minecraft:rotten_flesh",
  ]),
  "minecraft:cat": new Set(["minecraft:cod", "minecraft:salmon"]),
  "minecraft:fox": new Set(["minecraft:sweet_berries", "minecraft:glow_berries"]),
  "minecraft:bee": new Set(["minecraft:dandelion", "minecraft:poppy", "minecraft:blue_orchid", "minecraft:allium", "minecraft:azure_bluet", "minecraft:red_tulip", "minecraft:orange_tulip", "minecraft:white_tulip", "minecraft:pink_tulip", "minecraft:oxeye_daisy", "minecraft:cornflower", "minecraft:lily_of_the_valley", "minecraft:wither_rose", "minecraft:sunflower", "minecraft:lilac", "minecraft:rose_bush", "minecraft:peony", "minecraft:torchflower"]),
  "minecraft:panda": new Set(["minecraft:bamboo"]),
  "minecraft:strider": new Set(["minecraft:warped_fungus"]),
});

const ANIMAL_TYPE_IDS_FOR_GROWTH = Object.freeze(new Set(Object.keys(BREEDING_ITEMS_BY_ANIMAL)));

const LOG_COUNTERS_BY_PLAYER = new Map();
const SHEEP_INTERACTION_BY_PLAYER = new Map();
const SHEEP_COOLDOWN_BY_ENTITY = new Map();
const VILLAGER_BLOCK_MESSAGE_BY_PLAYER = new Map();
const VILLAGER_TRADE_SESSION_BY_PLAYER = new Map();
const BREW_REFUND_CHECK_BY_PLAYER = new Map();
const PLAYER_POTION_SNAPSHOT_BY_PLAYER = new Map();
const BREEDING_HINTS_BY_TYPE = new Map();
const SKIP_EXTRA_BABY_SPAWN_BY_TYPE = new Map();

let tradeCounterObjective;
let initialized = false;

function nowMs() {
  return Date.now();
}

function randomChance(chance) {
  return Math.random() < chance;
}

function isPlayer(entity) {
  return entity?.typeId === "minecraft:player";
}

function getPlayerById(playerId) {
  for (const player of world.getAllPlayers()) {
    if (player.id === playerId) {
      return player;
    }
  }

  return undefined;
}

function normalizeEffectId(effectId) {
  const raw = `${effectId ?? ""}`.trim().toLowerCase();
  if (!raw) {
    return "";
  }

  return raw.startsWith("minecraft:") ? raw : `minecraft:${raw}`;
}

function copyLocation(location) {
  return {
    x: location?.x ?? 0,
    y: location?.y ?? 0,
    z: location?.z ?? 0,
  };
}

function distanceSquared(a, b) {
  const dx = (a?.x ?? 0) - (b?.x ?? 0);
  const dy = (a?.y ?? 0) - (b?.y ?? 0);
  const dz = (a?.z ?? 0) - (b?.z ?? 0);
  return dx * dx + dy * dy + dz * dz;
}

function isWithinDistance(a, b, maxDistance) {
  return distanceSquared(a, b) <= maxDistance * maxDistance;
}

function getProfessionContext(player) {
  sanitizePlayerSelections(player);

  const professionId = getPlayerProfession(player);
  if (!professionId) {
    return undefined;
  }

  const tierId = getPlayerProfessionTier(player) ?? DEFAULT_PROFESSION_TIER_ID;
  return { professionId, tierId };
}

function getMainhandItem(player) {
  try {
    const equippable = player.getComponent("minecraft:equippable");
    if (!equippable) {
      return undefined;
    }

    return (
      equippable.getEquipment(EquipmentSlot.Mainhand) ??
      equippable.getEquipment("Mainhand") ??
      undefined
    );
  } catch {
    return undefined;
  }
}

function setMainhandItem(player, itemStack) {
  try {
    const equippable = player.getComponent("minecraft:equippable");
    if (!equippable) {
      return false;
    }

    equippable.setEquipment(EquipmentSlot.Mainhand, itemStack);
    return true;
  } catch {
    try {
      const equippable = player.getComponent("minecraft:equippable");
      if (!equippable) {
        return false;
      }

      equippable.setEquipment("Mainhand", itemStack);
      return true;
    } catch {
      return false;
    }
  }
}

function countItemInInventory(player, itemId) {
  if (!itemId) {
    return 0;
  }

  let total = 0;

  try {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) {
      return 0;
    }

    for (let i = 0; i < inventory.size; i += 1) {
      const stack = inventory.getItem(i);
      if (stack?.typeId === itemId) {
        total += stack.amount ?? 0;
      }
    }
  } catch {
    return total;
  }

  return total;
}

function addItemToPlayerOrDrop(player, itemId, amount, location = player.location) {
  if (!amount || amount <= 0) {
    return;
  }

  const maxStack = 64;
  let remaining = Math.floor(amount);

  while (remaining > 0) {
    const stackAmount = Math.min(maxStack, remaining);
    remaining -= stackAmount;

    let itemStack;
    try {
      itemStack = new ItemStack(itemId, stackAmount);
    } catch {
      continue;
    }

    let leftover;

    try {
      const inventory = player.getComponent("minecraft:inventory")?.container;
      if (inventory) {
        leftover = inventory.addItem(itemStack);
      } else {
        leftover = itemStack;
      }
    } catch {
      leftover = itemStack;
    }

    if (!leftover) {
      continue;
    }

    try {
      player.dimension.spawnItem(leftover, {
        x: (location?.x ?? player.location.x) + 0.5,
        y: (location?.y ?? player.location.y) + 0.5,
        z: (location?.z ?? player.location.z) + 0.5,
      });
    } catch {
      // Ignore failed drops.
    }
  }
}

function getActiveEffect(player, effectId) {
  try {
    if (typeof player.getEffect === "function") {
      return player.getEffect(effectId);
    }
  } catch {
    // Continue to generic lookup.
  }

  try {
    const effects = player.getEffects();
    const normalized = normalizeEffectId(effectId);

    for (const effect of effects) {
      const currentId = normalizeEffectId(effect?.typeId ?? effect?.type?.id);
      if (currentId === normalized) {
        return effect;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function addTimedEffectIfNeeded(player, effectId, durationTicks, amplifier = 0) {
  try {
    const current = getActiveEffect(player, effectId);

    if (current) {
      const currentAmp = current.amplifier ?? 0;
      const currentDuration = current.duration ?? 0;

      if (currentAmp === amplifier && currentDuration > PASSIVE_EFFECT_MIN_REMAINING_TICKS) {
        return;
      }
    }

    player.addEffect(effectId, durationTicks, {
      amplifier,
      showParticles: false,
    });
  } catch {
    // Ignore effect failures.
  }
}

function isSprinting(player) {
  try {
    return Boolean(player.isSprinting);
  } catch {
    return false;
  }
}

function isAxe(itemId) {
  return typeof itemId === "string" && itemId.endsWith("_axe");
}

function isWeaponForFerreiro(itemId) {
  if (typeof itemId !== "string") {
    return false;
  }

  return (
    itemId.endsWith("_sword") ||
    itemId.endsWith("_axe") ||
    itemId === "minecraft:trident" ||
    itemId === "minecraft:mace"
  );
}

function professionTierBoostValue(professionId, tierId, key) {
  const tiers = {
    cacador: {
      aprendiz: { bowDamage: 0.15, extraMeat: 1, miningFatigueEffect: 0 },
      profissional: {
        bowDamage: 0.22,
        extraMeat: 3,
        leatherChance: 0.3,
        miningFatigueEffect: 0,
      },
      mestre: {
        bowDamage: 0.35,
        extraMeat: 4,
        leatherOrFeatherChance: 0.4,
        runningSpeedEffect: 0,
        miningFatigueEffect: 0,
      },
    },
    alquimista: {
      aprendiz: { netherWartExtra: 1, meleeDamagePenalty: 0.1 },
      profissional: {
        netherWartExtra: 3,
        brewIngredientRefundChance: 0.3,
        meleeDamagePenalty: 0.1,
      },
      mestre: {
        netherWartExtra: 5,
        brewIngredientRefundChance: 0.45,
        potionDurationBonus: 0.3,
        meleeDamagePenalty: 0.1,
      },
    },
    ferreiro_armas: {
      aprendiz: { durabilityRefundChance: 0.15, movementSlowEffect: 0 },
      profissional: {
        durabilityRefundChance: 0.3,
        movementSlowEffect: 0,
        smeltingBonusChance: 0.25,
      },
      mestre: {
        durabilityRefundChance: 0.5,
        movementSlowEffect: 0,
        smeltingBonusChance: 0.4,
        craftedWeaponDamageBonus: 0.15,
      },
    },
    lenhador: {
      aprendiz: { logCounterStep: 3, extraLogsOnStep: 1, miningFatigueEffect: 1 },
      profissional: {
        logCounterStep: 2,
        extraLogsOnStep: 2,
        woodCuttingHasteEffect: 1,
        miningFatigueEffect: 1,
      },
      mestre: {
        extraLogsPerLog: 2,
        woodCuttingHasteEffect: 2,
        saplingChance: 0.3,
        miningFatigueEffect: 1,
      },
    },
    minerador: {
      aprendiz: { coalExtra: 1, miningHasteEffect: 0, runningHungerEffect: 0 },
      profissional: {
        coalExtra: 2,
        copperExtra: 2,
        miningHasteEffect: 1,
        runningHungerEffect: 0,
      },
      mestre: {
        coalExtra: 3,
        ironExtra: 2,
        goldExtra: 2,
        miningHasteEffect: 2,
        fallDamageReduction: 0.45,
        runningHungerEffect: 0,
      },
    },
    criador: {
      aprendiz: { extraWool: 1, miningFatigueEffect: 0 },
      profissional: {
        extraWool: 3,
        animalGrowthChance: 0.3,
        miningFatigueEffect: 0,
      },
      mestre: {
        extraWool: 4,
        animalGrowthChance: 0.45,
        extraBabyChance: 0.3,
        miningFatigueEffect: 0,
      },
    },
    lavrador: {
      aprendiz: { harvestExtra: 1, outgoingDamagePenalty: 0.15 },
      profissional: {
        harvestExtra: 3,
        cropGrowthChance: 0.35,
        outgoingDamagePenalty: 0.15,
      },
      mestre: {
        harvestExtra: 5,
        cropGrowthChance: 0.55,
        harvestExtraChance: 0.35,
        outgoingDamagePenalty: 0.15,
      },
    },
    rei: {
      aprendiz: { villagerCashbackChance: 0.12 },
      profissional: { villagerCashbackChance: 0.25, villagerEmeraldEveryTrades: 5 },
      mestre: {
        villagerCashbackChance: 0.4,
        villagerEmeraldEveryTrades: 2,
      },
    },
  };

  return tiers[professionId]?.[tierId]?.[key];
}

function runPassiveEffectTick() {
  for (const player of world.getAllPlayers()) {
    const context = getProfessionContext(player);
    if (!context) {
      continue;
    }

    const { professionId, tierId } = context;

    if (professionId === "minerador") {
      const hasteAmp = professionTierBoostValue(professionId, tierId, "miningHasteEffect");
      if (typeof hasteAmp === "number") {
        addTimedEffectIfNeeded(player, "haste", PASSIVE_EFFECT_DURATION_TICKS, hasteAmp);
      }

      const hungerAmp = professionTierBoostValue(professionId, tierId, "runningHungerEffect");
      if (typeof hungerAmp === "number" && isSprinting(player)) {
        addTimedEffectIfNeeded(player, "hunger", PASSIVE_EFFECT_DURATION_TICKS, hungerAmp);
      }
    }

    if (professionId === "lenhador") {
      const mainhandId = getMainhandItem(player)?.typeId;
      const hasteAmp = professionTierBoostValue(professionId, tierId, "woodCuttingHasteEffect");
      if (typeof hasteAmp === "number" && isAxe(mainhandId)) {
        addTimedEffectIfNeeded(player, "haste", PASSIVE_EFFECT_DURATION_TICKS, hasteAmp);
      }
    }

    if (professionId === "cacador" && tierId === "mestre" && isSprinting(player)) {
      const speedAmp = professionTierBoostValue(professionId, tierId, "runningSpeedEffect");
      if (typeof speedAmp === "number") {
        addTimedEffectIfNeeded(player, "speed", PASSIVE_EFFECT_DURATION_TICKS, speedAmp);
      }
    }

    if (professionId === "ferreiro_armas") {
      const slowAmp = professionTierBoostValue(professionId, tierId, "movementSlowEffect");
      if (typeof slowAmp === "number") {
        addTimedEffectIfNeeded(player, "slowness", PASSIVE_EFFECT_DURATION_TICKS, slowAmp);
      }
    }

    if (professionId === "cacador" || professionId === "lenhador" || professionId === "criador") {
      const fatigueAmp = professionTierBoostValue(professionId, tierId, "miningFatigueEffect");
      if (typeof fatigueAmp === "number") {
        addTimedEffectIfNeeded(player, "mining_fatigue", PASSIVE_EFFECT_DURATION_TICKS, fatigueAmp);
      }
    }
  }
}

function getStateSafe(permutation, stateName) {
  if (!permutation || !stateName) {
    return undefined;
  }

  try {
    return permutation.getState(stateName);
  } catch {
    return undefined;
  }
}

function setStateSafe(block, stateName, value) {
  try {
    const nextPermutation = block.permutation.withState(stateName, value);
    block.setPermutation(nextPermutation);
    return true;
  } catch {
    return false;
  }
}

function pickRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function growNearbyCropsForPlayer(player, cropGrowthChance) {
  const base = player.location;
  const dimension = player.dimension;

  for (let i = 0; i < 10; i += 1) {
    const x = Math.floor(base.x) + pickRandomInt(-5, 5);
    const y = Math.floor(base.y) + pickRandomInt(-1, 1);
    const z = Math.floor(base.z) + pickRandomInt(-5, 5);

    let block;
    try {
      block = dimension.getBlock({ x, y, z });
    } catch {
      continue;
    }

    if (!block) {
      continue;
    }

    const config = CROP_HARVEST_CONFIG[block.typeId];
    if (!config) {
      continue;
    }

    const currentGrowth = getStateSafe(block.permutation, config.stateName);
    if (typeof currentGrowth !== "number" || currentGrowth >= config.maxState) {
      continue;
    }

    if (!randomChance(cropGrowthChance)) {
      continue;
    }

    setStateSafe(block, config.stateName, currentGrowth + 1);
  }
}

function runCropGrowthTick() {
  for (const player of world.getAllPlayers()) {
    const context = getProfessionContext(player);
    if (!context || context.professionId !== "lavrador") {
      continue;
    }

    const cropGrowthChance = professionTierBoostValue(
      context.professionId,
      context.tierId,
      "cropGrowthChance"
    );

    if (typeof cropGrowthChance !== "number") {
      continue;
    }

    growNearbyCropsForPlayer(player, cropGrowthChance);
  }
}

function isEntityLikelyBaby(entity) {
  try {
    if (typeof entity?.isBaby === "boolean") {
      return entity.isBaby;
    }
  } catch {
    // Continue to component fallback.
  }

  try {
    const ageable = entity?.getComponent("minecraft:ageable");
    if (typeof ageable?.isBaby === "boolean") {
      return ageable.isBaby;
    }
  } catch {
    // Ignore unsupported component shape.
  }

  return false;
}

function tryAccelerateEntityGrowthApprox(entity, chance) {
  if (!randomChance(chance)) {
    return;
  }

  if (typeof entity?.triggerEvent !== "function") {
    return;
  }

  const growEvents = [
    "minecraft:ageable_grow_up",
    "minecraft:become_adult",
    "grow_up",
  ];

  for (const eventName of growEvents) {
    try {
      entity.triggerEvent(eventName);
      return;
    } catch {
      // Try next fallback event name.
    }
  }
}

function runAnimalGrowthTick() {
  for (const player of world.getAllPlayers()) {
    const context = getProfessionContext(player);
    if (!context || context.professionId !== "criador") {
      continue;
    }

    const chance = professionTierBoostValue(context.professionId, context.tierId, "animalGrowthChance");
    if (typeof chance !== "number") {
      continue;
    }

    let nearbyEntities = [];

    try {
      nearbyEntities = player.dimension.getEntities({
        location: player.location,
        maxDistance: 16,
      });
    } catch {
      nearbyEntities = [];
    }

    for (const entity of nearbyEntities) {
      if (!ANIMAL_TYPE_IDS_FOR_GROWTH.has(entity.typeId)) {
        continue;
      }

      if (!isEntityLikelyBaby(entity)) {
        continue;
      }

      tryAccelerateEntityGrowthApprox(entity, chance);
    }
  }
}

function getSheepShearedState(sheep) {
  try {
    const sheared = sheep.getComponent("minecraft:is_sheared");

    if (typeof sheared?.value === "boolean") {
      return sheared.value;
    }

    if (typeof sheared?.isSheared === "boolean") {
      return sheared.isSheared;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function resolveSheepWoolItemId(sheep) {
  try {
    const colorComponent = sheep.getComponent("minecraft:color");
    const rawColor = `${colorComponent?.value ?? "white"}`.toLowerCase().replace(/\s+/g, "_");
    return `minecraft:${rawColor}_wool`;
  } catch {
    return "minecraft:white_wool";
  }
}

function trackSheepInteraction(player, sheep, currentTime) {
  const context = getProfessionContext(player);
  if (!context || context.professionId !== "criador") {
    return;
  }

  const mainhandItem = getMainhandItem(player);
  if (mainhandItem?.typeId !== "minecraft:shears") {
    return;
  }

  SHEEP_INTERACTION_BY_PLAYER.set(player.id, {
    sheepId: sheep.id,
    interactedAt: currentTime,
    beforeSheared: getSheepShearedState(sheep),
  });
}

function tryRewardSheepShear(player, sheep, currentTime) {
  const record = SHEEP_INTERACTION_BY_PLAYER.get(player.id);
  if (!record) {
    return;
  }

  SHEEP_INTERACTION_BY_PLAYER.delete(player.id);

  if (record.sheepId !== sheep.id) {
    return;
  }

  if (currentTime - record.interactedAt > SHEEP_INTERACTION_WINDOW_MS) {
    return;
  }

  const context = getProfessionContext(player);
  if (!context || context.professionId !== "criador") {
    return;
  }

  const extraWool = professionTierBoostValue(context.professionId, context.tierId, "extraWool") ?? 0;
  if (extraWool <= 0) {
    return;
  }

  const lastReward = SHEEP_COOLDOWN_BY_ENTITY.get(sheep.id) ?? 0;
  if (currentTime - lastReward < SHEEP_SHEAR_COOLDOWN_MS) {
    return;
  }

  const afterSheared = getSheepShearedState(sheep);
  let shearedNow = false;

  if (typeof record.beforeSheared === "boolean" && typeof afterSheared === "boolean") {
    shearedNow = record.beforeSheared === false && afterSheared === true;
  } else {
    shearedNow = true;
  }

  if (!shearedNow) {
    return;
  }

  SHEEP_COOLDOWN_BY_ENTITY.set(sheep.id, currentTime);
  const woolItemId = resolveSheepWoolItemId(sheep);
  addItemToPlayerOrDrop(player, woolItemId, extraWool, sheep.location);
}

function resolveSaplingFromLog(logTypeId) {
  const map = {
    "minecraft:oak_log": "minecraft:oak_sapling",
    "minecraft:birch_log": "minecraft:birch_sapling",
    "minecraft:spruce_log": "minecraft:spruce_sapling",
    "minecraft:jungle_log": "minecraft:jungle_sapling",
    "minecraft:acacia_log": "minecraft:acacia_sapling",
    "minecraft:dark_oak_log": "minecraft:dark_oak_sapling",
    "minecraft:mangrove_log": "minecraft:mangrove_propagule",
    "minecraft:cherry_log": "minecraft:cherry_sapling",
    "minecraft:crimson_stem": "minecraft:crimson_fungus",
    "minecraft:warped_stem": "minecraft:warped_fungus",
  };

  return map[logTypeId] ?? "minecraft:oak_sapling";
}

function isLogBlock(typeId) {
  return typeId.endsWith("_log") || typeId.endsWith("_stem") || typeId.endsWith("_hyphae");
}

function getBrokenBlockTypeId(eventData) {
  const fromPermutation = eventData.brokenBlockPermutation?.type?.id;
  if (fromPermutation) {
    return fromPermutation;
  }

  const fromPermutationId = eventData.brokenBlockPermutation?.typeId;
  if (fromPermutationId) {
    return fromPermutationId;
  }

  return eventData.block?.typeId ?? "";
}

function isCropMature(permutation, stateName, maxState) {
  if (!stateName) {
    return true;
  }

  const stateValue = getStateSafe(permutation, stateName);
  if (typeof stateValue !== "number") {
    return true;
  }

  return stateValue >= maxState;
}

function giveLenhadorDrops(player, tierId, blockTypeId, location) {
  if (tierId === "mestre") {
    const perLogExtra = professionTierBoostValue("lenhador", tierId, "extraLogsPerLog") ?? 0;
    if (perLogExtra > 0) {
      addItemToPlayerOrDrop(player, blockTypeId, perLogExtra, location);
    }

    const saplingChance = professionTierBoostValue("lenhador", tierId, "saplingChance") ?? 0;
    if (saplingChance > 0 && randomChance(saplingChance)) {
      addItemToPlayerOrDrop(player, resolveSaplingFromLog(blockTypeId), 1, location);
    }

    return;
  }

  const step = professionTierBoostValue("lenhador", tierId, "logCounterStep");
  const extraLogsOnStep = professionTierBoostValue("lenhador", tierId, "extraLogsOnStep");

  if (typeof step !== "number" || typeof extraLogsOnStep !== "number") {
    return;
  }

  const playerId = player.id;
  const nextCounter = (LOG_COUNTERS_BY_PLAYER.get(playerId) ?? 0) + 1;

  if (nextCounter >= step) {
    LOG_COUNTERS_BY_PLAYER.set(playerId, nextCounter - step);
    addItemToPlayerOrDrop(player, blockTypeId, extraLogsOnStep, location);
    return;
  }

  LOG_COUNTERS_BY_PLAYER.set(playerId, nextCounter);
}

function giveMineradorDrops(player, tierId, blockTypeId, location) {
  for (const [oreKey, config] of Object.entries(ORE_BONUS_CONFIG)) {
    if (!config.blocks.has(blockTypeId)) {
      continue;
    }

    const extra = professionTierBoostValue("minerador", tierId, `${oreKey}Extra`) ?? 0;
    if (extra > 0) {
      addItemToPlayerOrDrop(player, config.item, extra, location);
    }

    break;
  }
}

function giveLavradorHarvestDrops(player, tierId, blockTypeId, permutation, location) {
  const config = CROP_HARVEST_CONFIG[blockTypeId];
  if (!config) {
    return;
  }

  if (!isCropMature(permutation, config.stateName, config.maxState)) {
    return;
  }

  const guaranteed = professionTierBoostValue("lavrador", tierId, "harvestExtra") ?? 0;
  if (guaranteed > 0) {
    addItemToPlayerOrDrop(player, config.itemId, guaranteed, location);
  }

  const chance = professionTierBoostValue("lavrador", tierId, "harvestExtraChance") ?? 0;
  if (chance > 0 && randomChance(chance)) {
    addItemToPlayerOrDrop(player, config.itemId, 1, location);
  }
}

function giveAlquimistaNetherWartDrops(player, tierId, blockTypeId, permutation, location) {
  if (blockTypeId !== NETHER_WART_CONFIG.blockId) {
    return;
  }

  if (!isCropMature(permutation, NETHER_WART_CONFIG.stateName, NETHER_WART_CONFIG.maxState)) {
    return;
  }

  const extra = professionTierBoostValue("alquimista", tierId, "netherWartExtra") ?? 0;
  if (extra > 0) {
    addItemToPlayerOrDrop(player, NETHER_WART_CONFIG.itemId, extra, location);
  }
}

function maybeGiveFerreiroSmeltingBonus(player, tierId, blockTypeId, location) {
  const chance = professionTierBoostValue("ferreiro_armas", tierId, "smeltingBonusChance") ?? 0;
  if (chance <= 0) {
    return;
  }

  for (const config of Object.values(ORE_BONUS_CONFIG)) {
    if (!config.blocks.has(blockTypeId)) {
      continue;
    }

    if (randomChance(chance)) {
      const smeltedMap = {
        "minecraft:raw_copper": "minecraft:copper_ingot",
        "minecraft:raw_iron": "minecraft:iron_ingot",
        "minecraft:raw_gold": "minecraft:gold_ingot",
        "minecraft:coal": "minecraft:coal",
      };

      addItemToPlayerOrDrop(player, smeltedMap[config.item] ?? config.item, 1, location);
    }

    break;
  }
}

function handlePlayerBreakBlock(eventData) {
  const player = eventData.player;
  if (!isPlayer(player)) {
    return;
  }

  const context = getProfessionContext(player);
  if (!context) {
    return;
  }

  const blockTypeId = getBrokenBlockTypeId(eventData);
  const location = eventData.block?.location ?? player.location;
  const permutation = eventData.brokenBlockPermutation;

  if (context.professionId === "lenhador" && isLogBlock(blockTypeId)) {
    giveLenhadorDrops(player, context.tierId, blockTypeId, location);
    return;
  }

  if (context.professionId === "minerador") {
    giveMineradorDrops(player, context.tierId, blockTypeId, location);
    return;
  }

  if (context.professionId === "lavrador") {
    giveLavradorHarvestDrops(player, context.tierId, blockTypeId, permutation, location);
    return;
  }

  if (context.professionId === "alquimista") {
    giveAlquimistaNetherWartDrops(player, context.tierId, blockTypeId, permutation, location);
    return;
  }

  if (context.professionId === "ferreiro_armas") {
    maybeGiveFerreiroSmeltingBonus(player, context.tierId, blockTypeId, location);
  }
}

function resolveAttackingPlayer(damageSource) {
  const directCandidates = [
    damageSource?.damagingEntity,
    damageSource?.sourceEntity,
    damageSource?.causingEntity,
  ];

  for (const candidate of directCandidates) {
    if (isPlayer(candidate)) {
      return candidate;
    }
  }

  const projectile = damageSource?.damagingProjectile;
  if (projectile) {
    try {
      const projectileComponent = projectile.getComponent("minecraft:projectile");
      const owner = projectileComponent?.owner;
      if (isPlayer(owner)) {
        return owner;
      }
    } catch {
      // Ignore missing projectile ownership.
    }
  }

  return undefined;
}

function normalizeDamageCause(cause) {
  return `${cause ?? ""}`.toLowerCase();
}

function isProjectileDamageCause(causeToken) {
  return causeToken.includes("projectile");
}

function isMeleeDamageCause(causeToken) {
  return causeToken.includes("entity_attack") || causeToken.includes("entityattack");
}

function isFallDamageCause(causeToken) {
  return causeToken.includes("fall");
}

function isLikelyBowProjectile(projectile) {
  const typeId = projectile?.typeId ?? "";

  if (!typeId) {
    return false;
  }

  if (BOW_PROJECTILE_TYPE_IDS.has(typeId)) {
    return true;
  }

  return typeId.endsWith("arrow");
}

function getOutgoingDamageMultiplier(attacker, damageSource, causeToken) {
  if (!attacker) {
    return 1;
  }

  const context = getProfessionContext(attacker);
  if (!context) {
    return 1;
  }

  let multiplier = 1;

  if (context.professionId === "cacador") {
    const bowBonus = professionTierBoostValue(context.professionId, context.tierId, "bowDamage");
    const hasProjectileCause = isProjectileDamageCause(causeToken);
    const projectile = damageSource?.damagingProjectile;
    const isBowShot = projectile ? isLikelyBowProjectile(projectile) : hasProjectileCause;

    if (typeof bowBonus === "number" && isBowShot) {
      multiplier *= 1 + bowBonus;
    }
  }

  if (context.professionId === "alquimista" && isMeleeDamageCause(causeToken)) {
    const penalty = professionTierBoostValue(context.professionId, context.tierId, "meleeDamagePenalty");
    if (typeof penalty === "number") {
      multiplier *= 1 - penalty;
    }
  }

  if (context.professionId === "lavrador") {
    const penalty = professionTierBoostValue(context.professionId, context.tierId, "outgoingDamagePenalty");
    if (typeof penalty === "number") {
      multiplier *= 1 - penalty;
    }
  }

  if (context.professionId === "ferreiro_armas" && context.tierId === "mestre") {
    const bonus = professionTierBoostValue(context.professionId, context.tierId, "craftedWeaponDamageBonus");
    const mainhandItemId = getMainhandItem(attacker)?.typeId;

    if (
      typeof bonus === "number" &&
      isWeaponForFerreiro(mainhandItemId) &&
      isMeleeDamageCause(causeToken)
    ) {
      multiplier *= 1 + bonus;
    }
  }

  return multiplier;
}

function getIncomingDamageMultiplier(hurtEntity, causeToken) {
  if (!isPlayer(hurtEntity)) {
    return 1;
  }

  const context = getProfessionContext(hurtEntity);
  if (!context) {
    return 1;
  }

  let multiplier = 1;

  if (context.professionId === "minerador" && context.tierId === "mestre" && isFallDamageCause(causeToken)) {
    const reduction = professionTierBoostValue(context.professionId, context.tierId, "fallDamageReduction");
    if (typeof reduction === "number") {
      multiplier *= 1 - reduction;
    }
  }

  return multiplier;
}

function applyDamageMultipliersBefore(eventData) {
  if (typeof eventData.damage !== "number") {
    return;
  }

  const attacker = resolveAttackingPlayer(eventData.damageSource);
  const causeToken = normalizeDamageCause(eventData.damageSource?.cause);

  const outgoingMultiplier = getOutgoingDamageMultiplier(attacker, eventData.damageSource, causeToken);
  const incomingMultiplier = getIncomingDamageMultiplier(eventData.hurtEntity, causeToken);

  const totalMultiplier = Math.max(0, outgoingMultiplier * incomingMultiplier);
  eventData.damage *= totalMultiplier;
}

function applyDamageMultipliersAfterFallback(eventData) {
  if (typeof eventData.damage !== "number") {
    return;
  }

  const attacker = resolveAttackingPlayer(eventData.damageSource);
  const causeToken = normalizeDamageCause(eventData.damageSource?.cause);

  const outgoingMultiplier = getOutgoingDamageMultiplier(attacker, eventData.damageSource, causeToken);
  const incomingMultiplier = getIncomingDamageMultiplier(eventData.hurtEntity, causeToken);
  const totalMultiplier = Math.max(0, outgoingMultiplier * incomingMultiplier);

  if (totalMultiplier <= 1) {
    return;
  }

  const extraDamage = eventData.damage * (totalMultiplier - 1);

  if (extraDamage <= 0.01) {
    return;
  }

  try {
    eventData.hurtEntity.applyDamage(extraDamage, attacker ? { damagingEntity: attacker } : undefined);
  } catch {
    // Ignore fallback damage failures.
  }
}

function applyDurabilityRefundToMainhand(player) {
  const mainhandItem = getMainhandItem(player);
  if (!mainhandItem) {
    return false;
  }

  try {
    const clone = mainhandItem.clone();
    const durability = clone.getComponent("minecraft:durability");

    if (!durability || typeof durability.damage !== "number" || durability.damage <= 0) {
      return false;
    }

    durability.damage = Math.max(0, durability.damage - 1);
    return setMainhandItem(player, clone);
  } catch {
    // Continue to in-place fallback.
  }

  try {
    const durability = mainhandItem.getComponent("minecraft:durability");

    if (!durability || typeof durability.damage !== "number" || durability.damage <= 0) {
      return false;
    }

    durability.damage = Math.max(0, durability.damage - 1);
    return setMainhandItem(player, mainhandItem);
  } catch {
    return false;
  }
}

function maybeRefundWeaponDurability(eventData) {
  const player = eventData.damagingEntity;
  if (!isPlayer(player)) {
    return;
  }

  const context = getProfessionContext(player);
  if (!context || context.professionId !== "ferreiro_armas") {
    return;
  }

  const chance = professionTierBoostValue(context.professionId, context.tierId, "durabilityRefundChance") ?? 0;
  if (!randomChance(chance)) {
    return;
  }

  applyDurabilityRefundToMainhand(player);
}

function resolveAnimalMeatDrop(typeId) {
  return ANIMAL_MEAT_DROPS[typeId];
}

function maybeGiveHunterKillDrops(eventData) {
  const deadEntity = eventData.deadEntity;
  const killer = resolveAttackingPlayer(eventData.damageSource);

  if (!killer) {
    return;
  }

  const context = getProfessionContext(killer);
  if (!context || context.professionId !== "cacador") {
    return;
  }

  const meatDropId = resolveAnimalMeatDrop(deadEntity?.typeId);
  if (!meatDropId) {
    return;
  }

  const extraMeat = professionTierBoostValue(context.professionId, context.tierId, "extraMeat") ?? 0;
  if (extraMeat > 0) {
    addItemToPlayerOrDrop(killer, meatDropId, extraMeat, deadEntity.location);
  }

  if (context.tierId === "profissional") {
    const leatherChance = professionTierBoostValue(context.professionId, context.tierId, "leatherChance") ?? 0;
    if (leatherChance > 0 && randomChance(leatherChance)) {
      addItemToPlayerOrDrop(killer, "minecraft:leather", 1, deadEntity.location);
    }
  }

  if (context.tierId === "mestre") {
    const extraChance =
      professionTierBoostValue(context.professionId, context.tierId, "leatherOrFeatherChance") ?? 0;

    if (extraChance > 0 && randomChance(extraChance)) {
      const bonusItem = deadEntity.typeId === "minecraft:chicken"
        ? "minecraft:feather"
        : randomChance(0.5)
          ? "minecraft:leather"
          : "minecraft:feather";

      addItemToPlayerOrDrop(killer, bonusItem, 1, deadEntity.location);
    }
  }
}

function ensureTradeObjective() {
  if (tradeCounterObjective) {
    return tradeCounterObjective;
  }

  try {
    tradeCounterObjective = world.scoreboard.getObjective(TRADE_COUNTER_OBJECTIVE_ID);
  } catch {
    tradeCounterObjective = undefined;
  }

  if (tradeCounterObjective) {
    return tradeCounterObjective;
  }

  try {
    tradeCounterObjective = world.scoreboard.addObjective(TRADE_COUNTER_OBJECTIVE_ID, "Trocas Profissao");
  } catch {
    tradeCounterObjective = world.scoreboard.getObjective(TRADE_COUNTER_OBJECTIVE_ID);
  }

  return tradeCounterObjective;
}

function incrementVillagerTradeCounter(player) {
  const objective = ensureTradeObjective();
  if (!objective || !player.scoreboardIdentity) {
    return 0;
  }

  let current = 0;

  try {
    current = objective.getScore(player.scoreboardIdentity) ?? 0;
  } catch {
    current = 0;
  }

  const next = current + 1;

  try {
    objective.setScore(player.scoreboardIdentity, next);
  } catch {
    // Ignore scoreboard write failures.
  }

  return next;
}

function startVillagerTradeSession(player, villager, context, currentTime) {
  const existing = VILLAGER_TRADE_SESSION_BY_PLAYER.get(player.id);
  if (existing && currentTime - existing.startedAt < 800) {
    return;
  }

  VILLAGER_TRADE_SESSION_BY_PLAYER.set(player.id, {
    startedAt: currentTime,
    expiresAt: currentTime + VILLAGER_SESSION_TTL_MS,
    villagerLocation: copyLocation(villager.location),
    dimensionId: player.dimension?.id,
    emeraldBefore: countItemInInventory(player, "minecraft:emerald"),
    tierId: context.tierId,
  });
}

function handleVillagerInteractionBefore(eventData, currentTime) {
  const player = eventData.player;
  const target = eventData.target;

  if (!isPlayer(player) || !VILLAGER_TYPE_IDS.has(target?.typeId ?? "")) {
    return;
  }

  const context = getProfessionContext(player);

  if (!context || context.professionId !== "rei") {
    const lastMessageTime = VILLAGER_BLOCK_MESSAGE_BY_PLAYER.get(player.id) ?? 0;

    if (currentTime - lastMessageTime >= VILLAGER_BLOCK_MESSAGE_COOLDOWN_MS) {
      player.sendMessage("\u00A7cSomente quem e Rei do Reino pode negociar com villagers.");
      VILLAGER_BLOCK_MESSAGE_BY_PLAYER.set(player.id, currentTime);
    }

    try {
      eventData.cancel = true;
    } catch {
      // Ignore cancellation failures.
    }

    return;
  }

  startVillagerTradeSession(player, target, context, currentTime);
}

function rewardVillagerTrade(player, context) {
  const cashbackChance = professionTierBoostValue(
    context.professionId,
    context.tierId,
    "villagerCashbackChance"
  ) ?? 0;

  if (cashbackChance > 0 && randomChance(cashbackChance)) {
    addItemToPlayerOrDrop(player, "minecraft:emerald", 1, player.location);
  }

  const tradeCounter = incrementVillagerTradeCounter(player);
  const milestone = professionTierBoostValue(
    context.professionId,
    context.tierId,
    "villagerEmeraldEveryTrades"
  );

  if (typeof milestone === "number" && milestone > 0 && tradeCounter > 0 && tradeCounter % milestone === 0) {
    addItemToPlayerOrDrop(player, "minecraft:emerald", 1, player.location);
  }
}

function processVillagerTradeSessions() {
  const currentTime = nowMs();

  for (const [playerId, session] of VILLAGER_TRADE_SESSION_BY_PLAYER.entries()) {
    const player = getPlayerById(playerId);

    if (!player) {
      VILLAGER_TRADE_SESSION_BY_PLAYER.delete(playerId);
      continue;
    }

    const context = getProfessionContext(player);
    if (!context || context.professionId !== "rei") {
      VILLAGER_TRADE_SESSION_BY_PLAYER.delete(playerId);
      continue;
    }

    if (currentTime > session.expiresAt) {
      VILLAGER_TRADE_SESSION_BY_PLAYER.delete(playerId);
      continue;
    }

    if (player.dimension?.id !== session.dimensionId) {
      VILLAGER_TRADE_SESSION_BY_PLAYER.delete(playerId);
      continue;
    }

    if (!isWithinDistance(player.location, session.villagerLocation, VILLAGER_SESSION_MIN_REWARD_DISTANCE)) {
      continue;
    }

    const emeraldNow = countItemInInventory(player, "minecraft:emerald");

    if (emeraldNow >= session.emeraldBefore) {
      continue;
    }

    rewardVillagerTrade(player, context);
    VILLAGER_TRADE_SESSION_BY_PLAYER.delete(playerId);
  }
}

function handleBrewingIngredientUseBefore(eventData) {
  const player = eventData.source;
  if (!isPlayer(player)) {
    return;
  }

  const blockTypeId = eventData.block?.typeId ?? "";
  if (blockTypeId !== BREWING_STAND_TYPE_ID) {
    return;
  }

  const context = getProfessionContext(player);
  if (!context || context.professionId !== "alquimista") {
    return;
  }

  const refundChance = professionTierBoostValue(
    context.professionId,
    context.tierId,
    "brewIngredientRefundChance"
  );

  if (typeof refundChance !== "number" || refundChance <= 0) {
    return;
  }

  const itemId = eventData.itemStack?.typeId;
  if (!BREWING_INGREDIENT_IDS.has(itemId)) {
    return;
  }

  const beforeCount = countItemInInventory(player, itemId);
  if (beforeCount <= 0) {
    return;
  }

  BREW_REFUND_CHECK_BY_PLAYER.set(player.id, {
    itemId,
    beforeCount,
    refundChance,
    expiresAt: nowMs() + BREW_REFUND_CHECK_TTL_MS,
  });

  system.runTimeout(() => {
    const check = BREW_REFUND_CHECK_BY_PLAYER.get(player.id);
    if (!check) {
      return;
    }

    BREW_REFUND_CHECK_BY_PLAYER.delete(player.id);

    if (nowMs() > check.expiresAt) {
      return;
    }

    const afterCount = countItemInInventory(player, check.itemId);
    if (afterCount >= check.beforeCount) {
      return;
    }

    if (!randomChance(check.refundChance)) {
      return;
    }

    addItemToPlayerOrDrop(player, check.itemId, 1, player.location);
  }, 4);
}

function captureCurrentPositiveEffects(player) {
  const snapshot = new Map();

  let effects = [];

  try {
    effects = player.getEffects();
  } catch {
    effects = [];
  }

  for (const effect of effects) {
    const effectId = normalizeEffectId(effect?.typeId ?? effect?.type?.id);

    if (!effectId || NEGATIVE_EFFECT_IDS.has(effectId)) {
      continue;
    }

    const duration = effect.duration ?? 0;
    const amplifier = effect.amplifier ?? 0;

    snapshot.set(effectId, { duration, amplifier });
  }

  return snapshot;
}

function handlePotionUseBefore(eventData) {
  const player = eventData.source;
  if (!isPlayer(player)) {
    return;
  }

  const context = getProfessionContext(player);
  if (!context || context.professionId !== "alquimista" || context.tierId !== "mestre") {
    return;
  }

  const itemId = eventData.itemStack?.typeId ?? "";
  if (!POTION_ITEM_IDS.has(itemId)) {
    return;
  }

  const bonusFraction = professionTierBoostValue(context.professionId, context.tierId, "potionDurationBonus");
  if (typeof bonusFraction !== "number" || bonusFraction <= 0) {
    return;
  }

  PLAYER_POTION_SNAPSHOT_BY_PLAYER.set(player.id, {
    bonusFraction,
    effects: captureCurrentPositiveEffects(player),
    expiresAt: nowMs() + POTION_SNAPSHOT_TTL_MS,
  });
}

function extendPositivePotionEffectsFromSnapshot(player, snapshot) {
  if (!snapshot || snapshot.bonusFraction <= 0) {
    return;
  }

  let effects = [];

  try {
    effects = player.getEffects();
  } catch {
    effects = [];
  }

  for (const effect of effects) {
    const effectId = normalizeEffectId(effect?.typeId ?? effect?.type?.id);
    if (!effectId || NEGATIVE_EFFECT_IDS.has(effectId)) {
      continue;
    }

    const duration = effect.duration ?? 0;
    const amplifier = effect.amplifier ?? 0;
    const previous = snapshot.effects.get(effectId);

    let shouldExtend = false;

    if (!previous) {
      shouldExtend = true;
    } else if (previous.amplifier !== amplifier) {
      shouldExtend = true;
    } else if (duration > previous.duration + 2) {
      shouldExtend = true;
    }

    if (!shouldExtend || duration <= 0) {
      continue;
    }

    const extendedDuration = duration + Math.max(1, Math.floor(duration * snapshot.bonusFraction));

    try {
      player.addEffect(effectId, extendedDuration, {
        amplifier,
        showParticles: false,
      });
    } catch {
      // Ignore extension failures.
    }
  }
}

function handlePotionConsumption(eventData) {
  const player = eventData.source;
  if (!isPlayer(player)) {
    return;
  }

  const context = getProfessionContext(player);
  if (!context || context.professionId !== "alquimista" || context.tierId !== "mestre") {
    PLAYER_POTION_SNAPSHOT_BY_PLAYER.delete(player.id);
    return;
  }

  const itemId = eventData.itemStack?.typeId ?? "";
  if (!POTION_ITEM_IDS.has(itemId)) {
    PLAYER_POTION_SNAPSHOT_BY_PLAYER.delete(player.id);
    return;
  }

  const snapshot = PLAYER_POTION_SNAPSHOT_BY_PLAYER.get(player.id);
  PLAYER_POTION_SNAPSHOT_BY_PLAYER.delete(player.id);

  if (!snapshot || nowMs() > snapshot.expiresAt) {
    return;
  }

  system.run(() => {
    extendPositivePotionEffectsFromSnapshot(player, snapshot);
  });
}

function registerBreedingHint(player, target, itemId, currentTime) {
  const context = getProfessionContext(player);
  if (!context || context.professionId !== "criador" || context.tierId !== "mestre") {
    return;
  }

  const breedingItems = BREEDING_ITEMS_BY_ANIMAL[target.typeId];
  if (!breedingItems || !breedingItems.has(itemId)) {
    return;
  }

  if (isEntityLikelyBaby(target)) {
    return;
  }

  const extraBabyChance = professionTierBoostValue(context.professionId, context.tierId, "extraBabyChance");
  if (typeof extraBabyChance !== "number" || extraBabyChance <= 0) {
    return;
  }

  const hints = BREEDING_HINTS_BY_TYPE.get(target.typeId) ?? [];
  const validHints = hints.filter((hint) => currentTime <= hint.expiresAt);

  validHints.push({
    playerId: player.id,
    createdAt: currentTime,
    expiresAt: currentTime + BREEDING_HINT_TTL_MS,
    location: copyLocation(target.location),
    extraBabyChance,
  });

  BREEDING_HINTS_BY_TYPE.set(target.typeId, validHints);
}

function consumeBreedingHint(typeId, location, currentTime) {
  const hints = BREEDING_HINTS_BY_TYPE.get(typeId);
  if (!hints || hints.length === 0) {
    return undefined;
  }

  let selected;
  const remaining = [];

  for (const hint of hints) {
    if (currentTime > hint.expiresAt) {
      continue;
    }

    if (!selected && isWithinDistance(location, hint.location, 12)) {
      selected = hint;
      continue;
    }

    remaining.push(hint);
  }

  if (remaining.length > 0) {
    BREEDING_HINTS_BY_TYPE.set(typeId, remaining);
  } else {
    BREEDING_HINTS_BY_TYPE.delete(typeId);
  }

  return selected;
}

function handleEntitySpawn(eventData) {
  const entity = eventData.entity;
  if (!entity || !ANIMAL_TYPE_IDS_FOR_GROWTH.has(entity.typeId)) {
    return;
  }

  try {
    if (entity.hasTag(EXTRA_BABY_SKIP_TAG)) {
      return;
    }
  } catch {
    // Ignore tag lookup failures.
  }

  const skipCount = SKIP_EXTRA_BABY_SPAWN_BY_TYPE.get(entity.typeId) ?? 0;
  if (skipCount > 0) {
    SKIP_EXTRA_BABY_SPAWN_BY_TYPE.set(entity.typeId, skipCount - 1);
    return;
  }

  if (!isEntityLikelyBaby(entity)) {
    return;
  }

  const currentTime = nowMs();
  const hint = consumeBreedingHint(entity.typeId, entity.location, currentTime);

  if (!hint) {
    return;
  }

  const player = getPlayerById(hint.playerId);
  if (!player) {
    return;
  }

  const context = getProfessionContext(player);
  if (!context || context.professionId !== "criador" || context.tierId !== "mestre") {
    return;
  }

  if (!randomChance(hint.extraBabyChance)) {
    return;
  }

  try {
    SKIP_EXTRA_BABY_SPAWN_BY_TYPE.set(
      entity.typeId,
      (SKIP_EXTRA_BABY_SPAWN_BY_TYPE.get(entity.typeId) ?? 0) + 1
    );

    const extraBaby = entity.dimension.spawnEntity(entity.typeId, entity.location);
    extraBaby.addTag(EXTRA_BABY_SKIP_TAG);
  } catch {
    // Ignore spawn failures.
  }
}

function handlePlayerInteractWithEntityBefore(eventData) {
  const player = eventData.player;
  const target = eventData.target;

  if (!isPlayer(player) || !target) {
    return;
  }

  const currentTime = nowMs();

  if (VILLAGER_TYPE_IDS.has(target.typeId)) {
    handleVillagerInteractionBefore(eventData, currentTime);
    return;
  }

  if (target.typeId === SHEEP_TYPE_ID) {
    trackSheepInteraction(player, target, currentTime);
  }

  const itemId = eventData.itemStack?.typeId ?? getMainhandItem(player)?.typeId;
  if (itemId) {
    registerBreedingHint(player, target, itemId, currentTime);
  }
}

function handlePlayerInteractWithEntityAfter(eventData) {
  const player = eventData.player;
  const target = eventData.target;

  if (!isPlayer(player) || !target) {
    return;
  }

  if (target.typeId !== SHEEP_TYPE_ID) {
    return;
  }

  tryRewardSheepShear(player, target, nowMs());
}

function runCleanupTick() {
  const currentTime = nowMs();

  for (const [playerId, record] of SHEEP_INTERACTION_BY_PLAYER.entries()) {
    if (currentTime - record.interactedAt > SHEEP_INTERACTION_WINDOW_MS) {
      SHEEP_INTERACTION_BY_PLAYER.delete(playerId);
    }
  }

  for (const [playerId, session] of VILLAGER_TRADE_SESSION_BY_PLAYER.entries()) {
    if (currentTime > session.expiresAt) {
      VILLAGER_TRADE_SESSION_BY_PLAYER.delete(playerId);
    }
  }

  for (const [playerId, check] of BREW_REFUND_CHECK_BY_PLAYER.entries()) {
    if (currentTime > check.expiresAt) {
      BREW_REFUND_CHECK_BY_PLAYER.delete(playerId);
    }
  }

  for (const [playerId, snapshot] of PLAYER_POTION_SNAPSHOT_BY_PLAYER.entries()) {
    if (currentTime > snapshot.expiresAt) {
      PLAYER_POTION_SNAPSHOT_BY_PLAYER.delete(playerId);
    }
  }

  for (const [typeId, hints] of BREEDING_HINTS_BY_TYPE.entries()) {
    const valid = hints.filter((hint) => currentTime <= hint.expiresAt);

    if (valid.length > 0) {
      BREEDING_HINTS_BY_TYPE.set(typeId, valid);
    } else {
      BREEDING_HINTS_BY_TYPE.delete(typeId);
    }
  }

  for (const [typeId, count] of SKIP_EXTRA_BABY_SPAWN_BY_TYPE.entries()) {
    if (count <= 0) {
      SKIP_EXTRA_BABY_SPAWN_BY_TYPE.delete(typeId);
    }
  }
}

export function handleProfessionGameplayPlayerLeave(playerId) {
  LOG_COUNTERS_BY_PLAYER.delete(playerId);
  SHEEP_INTERACTION_BY_PLAYER.delete(playerId);
  VILLAGER_BLOCK_MESSAGE_BY_PLAYER.delete(playerId);
  VILLAGER_TRADE_SESSION_BY_PLAYER.delete(playerId);
  BREW_REFUND_CHECK_BY_PLAYER.delete(playerId);
  PLAYER_POTION_SNAPSHOT_BY_PLAYER.delete(playerId);
}

export function initializeProfessionGameplaySystem() {
  if (initialized) {
    return;
  }

  initialized = true;

  if (world.afterEvents.playerBreakBlock) {
    world.afterEvents.playerBreakBlock.subscribe(handlePlayerBreakBlock);
  }

  if (world.afterEvents.entityDie) {
    world.afterEvents.entityDie.subscribe(maybeGiveHunterKillDrops);
  }

  if (world.beforeEvents?.entityHurt) {
    world.beforeEvents.entityHurt.subscribe(applyDamageMultipliersBefore);
  } else if (world.afterEvents.entityHurt) {
    world.afterEvents.entityHurt.subscribe(applyDamageMultipliersAfterFallback);
  }

  if (world.afterEvents.entityHitEntity) {
    world.afterEvents.entityHitEntity.subscribe(maybeRefundWeaponDurability);
  }

  if (world.beforeEvents?.playerInteractWithEntity) {
    world.beforeEvents.playerInteractWithEntity.subscribe(handlePlayerInteractWithEntityBefore);
  }

  if (world.afterEvents.playerInteractWithEntity) {
    world.afterEvents.playerInteractWithEntity.subscribe(handlePlayerInteractWithEntityAfter);
  }

  if (world.beforeEvents?.itemUseOn) {
    world.beforeEvents.itemUseOn.subscribe(handleBrewingIngredientUseBefore);
  }

  if (world.beforeEvents?.itemUse) {
    world.beforeEvents.itemUse.subscribe(handlePotionUseBefore);
  }

  if (world.afterEvents.itemCompleteUse) {
    world.afterEvents.itemCompleteUse.subscribe(handlePotionConsumption);
  }

  if (world.afterEvents.entitySpawn) {
    world.afterEvents.entitySpawn.subscribe(handleEntitySpawn);
  }

  if (world.afterEvents.playerLeave) {
    world.afterEvents.playerLeave.subscribe((eventData) => {
      handleProfessionGameplayPlayerLeave(eventData.playerId);
    });
  }

  system.runInterval(runPassiveEffectTick, PASSIVE_EFFECT_INTERVAL_TICKS);
  system.runInterval(runCropGrowthTick, CROP_GROWTH_INTERVAL_TICKS);
  system.runInterval(runAnimalGrowthTick, ANIMAL_GROWTH_INTERVAL_TICKS);
  system.runInterval(processVillagerTradeSessions, VILLAGER_SESSION_INTERVAL_TICKS);
  system.runInterval(runCleanupTick, CLEANUP_INTERVAL_TICKS);
  system.run(ensureTradeObjective);
}
import { system, world } from "@minecraft/server";
import {
  KINGDOMS,
  KINGDOM_NPC_TAG,
  NPC_ENTITY_TYPE_IDS,
  NPC_TAG_PREFIXES,
  PROFESSION_NPC_TAG,
  kingdomNpcDisplayName,
  kingdomNpcTagFor,
  resolveKingdomId,
} from "./constants.js";
import { buildDisplayTag, refreshPlayerDisplay } from "./display.js";
import {
  clearPlayerProfession,
  sanitizePlayerSelections,
  setPlayerKingdom,
} from "./state.js";
import {
  handleProfessionSelection,
  hasDefinedProfession,
  PROFESSION_MENU_RESULT,
  PROFESSION_SELECTION_RESULT,
  showProfessionMenu,
} from "./profession_menu.js";

const EVENT_NAMESPACE = "reinos:";
const STATE_SYNC_INTERVAL_TICKS = 20;

const ENABLE_AUTO_MENU_ON_FIRST_SPAWN = false;
const AUTO_MENU_INITIAL_DELAY_TICKS = 100;
const AUTO_MENU_RETRY_DELAY_TICKS = 30;
const AUTO_MENU_MAX_ATTEMPTS = 7;
const AUTO_MENU_FAILURE_MESSAGE = "§cNão foi possível abrir o menu de profissão agora.";
const AUTO_MENU_DEBUG_PREFIX = "§8[debug:auto-menu]§r";

const KINGDOM_ASSIGN_FAILED_MESSAGE =
  "§cNão foi possível definir o reino automaticamente pelo NPC.";
const SUMMON_NPC_FAILED_MESSAGE = "§cNão foi possível invocar o NPC de reino agora.";

const NPC_TYPE_IDS = Object.freeze(new Set(NPC_ENTITY_TYPE_IDS));

const stateCache = new Map();
const autoMenuSessions = new Map();
let initialized = false;

function formatValidIds(catalog) {
  return Object.values(catalog)
    .map((entry) => entry.display)
    .join(", ");
}

function stringifyError(error) {
  if (error instanceof Error) {
    return error.message || error.name;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isPlayer(entity) {
  return entity?.typeId === "minecraft:player";
}

function isNpcEntity(entity) {
  return NPC_TYPE_IDS.has(entity?.typeId ?? "");
}

function hasEntityTag(entity, tag) {
  try {
    return entity.hasTag(tag);
  } catch {
    return false;
  }
}

function hasProfessionNpcTag(entity) {
  return hasEntityTag(entity, PROFESSION_NPC_TAG);
}

function hasKingdomNpcTag(entity) {
  return hasEntityTag(entity, KINGDOM_NPC_TAG);
}

function getNpcKingdomId(entity) {
  let tags;

  try {
    tags = entity.getTags();
  } catch {
    return undefined;
  }

  for (const tag of tags) {
    if (!tag.startsWith(NPC_TAG_PREFIXES.kingdomNpc)) {
      continue;
    }

    const rawKingdom = tag.slice(NPC_TAG_PREFIXES.kingdomNpc.length);
    const kingdomId = resolveKingdomId(rawKingdom);

    if (kingdomId && KINGDOMS[kingdomId]) {
      return kingdomId;
    }
  }

  return undefined;
}

function getPlayerById(playerId) {
  for (const player of world.getAllPlayers()) {
    if (player.id === playerId) {
      return player;
    }
  }

  return undefined;
}

function stateFingerprint(state) {
  return `${state.kingdomId ?? "-"}|${state.professionId ?? "-"}`;
}

function syncPlayer(player, force = false) {
  const state = sanitizePlayerSelections(player);
  const fingerprint = stateFingerprint(state);
  const previous = stateCache.get(player.id);

  if (force || previous !== fingerprint) {
    refreshPlayerDisplay(player);
    stateCache.set(player.id, fingerprint);
    return;
  }

  const expected = buildDisplayTag(player);
  if (player.nameTag !== expected) {
    player.nameTag = expected;
  }
}

function clearAutoMenuSession(playerId) {
  const session = autoMenuSessions.get(playerId);

  if (!session) {
    return;
  }

  if (typeof session.timeoutId === "number" && typeof system.clearRun === "function") {
    system.clearRun(session.timeoutId);
  }

  autoMenuSessions.delete(playerId);
}

function ensureAutoMenuSession(playerId) {
  let session = autoMenuSessions.get(playerId);

  if (!session) {
    session = {
      attempts: 0,
      timeoutId: undefined,
    };

    autoMenuSessions.set(playerId, session);
  }

  return session;
}

function describeAutoMenuFailure(result) {
  const reason = result?.reason ?? result?.cancelationReason ?? result?.status ?? "unknown";

  if (result?.errorMessage) {
    return `${reason} | ${result.errorMessage}`;
  }

  return String(reason);
}

function debugAutoMenuFailure(player, attemptNumber, result) {
  const detail = describeAutoMenuFailure(result);

  try {
    player.sendMessage(
      `${AUTO_MENU_DEBUG_PREFIX} Tentativa ${attemptNumber}/${AUTO_MENU_MAX_ATTEMPTS} falhou: ${detail}`
    );
  } catch {
    // Ignore chat errors during debug logging.
  }

  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(
      `[reino_profissao:auto_menu] player=${player.name} attempt=${attemptNumber}/${AUTO_MENU_MAX_ATTEMPTS} status=${result?.status ?? "unknown"} detail=${detail}`
    );
  }
}

function shouldNotifyAutoMenuFailure(result, attemptNumber) {
  if (result.status === PROFESSION_MENU_RESULT.busy) {
    return attemptNumber >= AUTO_MENU_MAX_ATTEMPTS;
  }

  if (result.status === PROFESSION_MENU_RESULT.closed) {
    return false;
  }

  return true;
}

function handleKingdomBoundProfessionSelection(player, kingdomId, professionId) {
  const kingdomApplied = setPlayerKingdom(player, kingdomId);

  if (!kingdomApplied) {
    player.sendMessage(KINGDOM_ASSIGN_FAILED_MESSAGE);

    return {
      status: PROFESSION_SELECTION_RESULT.invalid,
      reason: "kingdom_apply_failed",
    };
  }

  const selectionResult = handleProfessionSelection(player, professionId);

  if (selectionResult.status !== PROFESSION_SELECTION_RESULT.applied) {
    return selectionResult;
  }

  return {
    ...selectionResult,
    kingdomId,
  };
}

function openProfessionMenuForPlayer(player, options = {}) {
  const { manual = true, kingdomId } = options;

  const menuOptions = {};

  if (kingdomId) {
    menuOptions.contextKingdomId = kingdomId;
    menuOptions.onSelection = (targetPlayer, professionId) =>
      handleKingdomBoundProfessionSelection(targetPlayer, kingdomId, professionId);
  }

  return new Promise((resolve) => {
    system.run(() => {
      showProfessionMenu(player, menuOptions)
        .then((result) => {
          if (result.status === PROFESSION_MENU_RESULT.applied) {
            syncPlayer(player, true);
            clearAutoMenuSession(player.id);

            if (manual && result.kingdomId) {
              const kingdomDisplay = KINGDOMS[result.kingdomId]?.display ?? result.kingdomId;
              player.sendMessage(`§aReino atual: ${kingdomDisplay}`);
            }
          }

          if (manual && result.status === PROFESSION_MENU_RESULT.error) {
            player.sendMessage(AUTO_MENU_FAILURE_MESSAGE);
          }

          resolve(result);
        })
        .catch((error) => {
          const result = {
            status: PROFESSION_MENU_RESULT.error,
            reason: "show_rejected",
            errorMessage: stringifyError(error),
          };

          if (manual) {
            player.sendMessage(AUTO_MENU_FAILURE_MESSAGE);
          }

          resolve(result);
        });
    });
  });
}

function scheduleAutoMenuAttempt(playerId, delayTicks) {
  const session = ensureAutoMenuSession(playerId);

  if (typeof session.timeoutId === "number" && typeof system.clearRun === "function") {
    system.clearRun(session.timeoutId);
  }

  session.timeoutId = system.runTimeout(() => {
    session.timeoutId = undefined;
    runAutoMenuAttempt(playerId);
  }, delayTicks);
}

function startAutoMenuFlow(player) {
  if (hasDefinedProfession(player)) {
    return;
  }

  clearAutoMenuSession(player.id);
  autoMenuSessions.set(player.id, {
    attempts: 0,
    timeoutId: undefined,
  });

  scheduleAutoMenuAttempt(player.id, AUTO_MENU_INITIAL_DELAY_TICKS);
}

function runAutoMenuAttempt(playerId) {
  const session = autoMenuSessions.get(playerId);

  if (!session) {
    return;
  }

  const player = getPlayerById(playerId);
  if (!player) {
    clearAutoMenuSession(playerId);
    return;
  }

  if (hasDefinedProfession(player)) {
    clearAutoMenuSession(playerId);
    return;
  }

  session.attempts += 1;
  const attemptNumber = session.attempts;

  openProfessionMenuForPlayer(player, { manual: false }).then((result) => {
    if (!autoMenuSessions.has(playerId)) {
      return;
    }

    if (
      result.status === PROFESSION_MENU_RESULT.applied ||
      result.status === PROFESSION_MENU_RESULT.locked
    ) {
      clearAutoMenuSession(playerId);
      return;
    }

    debugAutoMenuFailure(player, attemptNumber, result);

    if (result.status === PROFESSION_MENU_RESULT.busy) {
      if (attemptNumber < AUTO_MENU_MAX_ATTEMPTS) {
        scheduleAutoMenuAttempt(playerId, AUTO_MENU_RETRY_DELAY_TICKS);
        return;
      }

      player.sendMessage(AUTO_MENU_FAILURE_MESSAGE);
      clearAutoMenuSession(playerId);
      return;
    }

    if (shouldNotifyAutoMenuFailure(result, attemptNumber)) {
      player.sendMessage(AUTO_MENU_FAILURE_MESSAGE);
    }

    clearAutoMenuSession(playerId);
  });
}

function handleSetKingdom(player, rawValue) {
  const success = setPlayerKingdom(player, rawValue);

  if (!success) {
    player.sendMessage(
      `§cReino inválido. Opções: ${formatValidIds(KINGDOMS)}`
    );
    return;
  }

  syncPlayer(player, true);
}

function handleSetProfession(player, rawValue) {
  const result = handleProfessionSelection(player, rawValue);

  if (result.status === PROFESSION_SELECTION_RESULT.applied) {
    syncPlayer(player, true);
    clearAutoMenuSession(player.id);
  }
}

function handleResetProfession(player) {
  const hadProfession = hasDefinedProfession(player);

  clearPlayerProfession(player);
  syncPlayer(player, true);
  clearAutoMenuSession(player.id);

  if (hadProfession) {
    player.sendMessage("§aProfissão resetada para admin/teste.");
    return;
  }

  player.sendMessage("§eVocê já estava sem profissão.");
}

function spawnLocationInFrontOfPlayer(player, distance = 2) {
  const location = player.location;
  const viewDirection = player.getViewDirection();

  return {
    x: location.x + viewDirection.x * distance,
    y: location.y,
    z: location.z + viewDirection.z * distance,
  };
}

function spawnNpcEntity(dimension, location) {
  for (const typeId of NPC_ENTITY_TYPE_IDS) {
    try {
      const npc = dimension.spawnEntity(typeId, location);

      if (npc) {
        return npc;
      }
    } catch {
      // Try the next alias.
    }
  }

  return undefined;
}

function configureKingdomNpc(npc, kingdomId) {
  const kingdomTag = kingdomNpcTagFor(kingdomId);

  try {
    for (const tag of npc.getTags()) {
      if (tag.startsWith(NPC_TAG_PREFIXES.kingdomNpc) && tag !== kingdomTag) {
        npc.removeTag(tag);
      }
    }

    npc.addTag(PROFESSION_NPC_TAG);
    npc.addTag(KINGDOM_NPC_TAG);
    npc.addTag(kingdomTag);
    npc.nameTag = kingdomNpcDisplayName(kingdomId);

    return true;
  } catch {
    return false;
  }
}

function handleSummonKingdomNpc(player, rawValue) {
  const kingdomId = resolveKingdomId(rawValue);

  if (!kingdomId) {
    player.sendMessage(`§cReino inválido. Opções: ${formatValidIds(KINGDOMS)}`);
    return;
  }

  const spawnLocation = spawnLocationInFrontOfPlayer(player, 2);
  const npc = spawnNpcEntity(player.dimension, spawnLocation);

  if (!npc) {
    player.sendMessage(SUMMON_NPC_FAILED_MESSAGE);
    return;
  }

  if (!configureKingdomNpc(npc, kingdomId)) {
    player.sendMessage(SUMMON_NPC_FAILED_MESSAGE);
    return;
  }

  player.sendMessage(`§aNPC de ${KINGDOMS[kingdomId].display} invocado com sucesso.`);
}

function getLookedNpc(player, maxDistance = 8) {
  const hits = player.getEntitiesFromViewDirection({ maxDistance });

  for (const hit of hits) {
    const entity = hit.entity;
    if (isNpcEntity(entity)) {
      return entity;
    }
  }

  return undefined;
}

function handleMarkProfessionNpc(player) {
  let npc;

  try {
    npc = getLookedNpc(player, 8);
  } catch {
    player.sendMessage("§cNão foi possível detectar o NPC no seu olhar.");
    return;
  }

  if (!npc) {
    player.sendMessage("§eOlhe diretamente para um NPC até 8 blocos e tente de novo.");
    return;
  }

  if (hasProfessionNpcTag(npc)) {
    player.sendMessage("§eEsse NPC já está marcado como NPC de profissão.");
    return;
  }

  const tagged = npc.addTag(PROFESSION_NPC_TAG);

  if (!tagged) {
    player.sendMessage("§cNão foi possível marcar o NPC de profissão.");
    return;
  }

  player.sendMessage("§aNPC de profissão marcado com sucesso.");
}

function handleScriptEvent(eventData) {
  if (!eventData.id.startsWith(EVENT_NAMESPACE)) {
    return;
  }

  const player = eventData.sourceEntity;
  if (!isPlayer(player)) {
    return;
  }

  const action = eventData.id.slice(EVENT_NAMESPACE.length);
  const value = eventData.message ?? "";

  switch (action) {
    case "set_kingdom":
    case "definir_reino":
      handleSetKingdom(player, value);
      break;
    case "set_profession":
    case "definir_profissao":
      handleSetProfession(player, value);
      break;
    case "open_profession_menu":
    case "abrir_menu_profissao":
      openProfessionMenuForPlayer(player, { manual: true });
      break;
    case "summon_kingdom_npc":
    case "invocar_npc_reino":
      handleSummonKingdomNpc(player, value);
      break;
    case "mark_profession_npc":
    case "marcar_npc_profissao":
      handleMarkProfessionNpc(player);
      break;
    case "reset_profession":
    case "resetar_profissao":
      handleResetProfession(player);
      break;
    case "refresh_display":
      syncPlayer(player, true);
      break;
    default:
      break;
  }
}

function tryOpenProfessionMenuFromNpcInteraction(player, target) {
  if (!isNpcEntity(target)) {
    return false;
  }

  const kingdomId = getNpcKingdomId(target);

  if (kingdomId) {
    openProfessionMenuForPlayer(player, { manual: true, kingdomId });
    return true;
  }

  if (hasKingdomNpcTag(target)) {
    player.sendMessage("§cEsse NPC de reino está sem um reino válido configurado.");
    return true;
  }

  if (!hasProfessionNpcTag(target)) {
    return false;
  }

  openProfessionMenuForPlayer(player, { manual: true });
  return true;
}

function handlePlayerInteractWithEntityBefore(eventData) {
  const handled = tryOpenProfessionMenuFromNpcInteraction(eventData.player, eventData.target);

  if (!handled) {
    return;
  }

  try {
    eventData.cancel = true;
  } catch {
    // Ignore if cancel is unavailable on this runtime.
  }
}

function handlePlayerInteractWithEntityAfter(eventData) {
  tryOpenProfessionMenuFromNpcInteraction(eventData.player, eventData.target);
}

export function initializeKingdomProfessionSystem() {
  if (initialized) {
    return;
  }

  initialized = true;

  world.afterEvents.playerSpawn.subscribe((eventData) => {
    const player = eventData.player;

    syncPlayer(player, true);

    if (
      ENABLE_AUTO_MENU_ON_FIRST_SPAWN &&
      eventData.initialSpawn &&
      !hasDefinedProfession(player)
    ) {
      startAutoMenuFlow(player);
    }
  });

  if (world.afterEvents.playerLeave) {
    world.afterEvents.playerLeave.subscribe((eventData) => {
      stateCache.delete(eventData.playerId);
      clearAutoMenuSession(eventData.playerId);
    });
  }

  if (world.beforeEvents?.playerInteractWithEntity) {
    world.beforeEvents.playerInteractWithEntity.subscribe(handlePlayerInteractWithEntityBefore);
  } else if (world.afterEvents.playerInteractWithEntity) {
    world.afterEvents.playerInteractWithEntity.subscribe(handlePlayerInteractWithEntityAfter);
  }

  system.afterEvents.scriptEventReceive.subscribe(handleScriptEvent);

  system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
      syncPlayer(player);

      if (hasDefinedProfession(player)) {
        clearAutoMenuSession(player.id);
      }
    }
  }, STATE_SYNC_INTERVAL_TICKS);

  system.run(() => {
    for (const player of world.getAllPlayers()) {
      syncPlayer(player, true);

      if (hasDefinedProfession(player)) {
        clearAutoMenuSession(player.id);
      }
    }
  });
}

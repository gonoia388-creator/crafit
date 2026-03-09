import {
  DEFAULT_PROFESSION_TIER_ID,
  PROFESSIONS,
  PROFESSION_TIERS,
  resolveProfessionTierId,
} from "./constants.js";
import {
  advancePlayerProfessionTier,
  getPlayerProfession,
  getPlayerProfessionTier,
  resetPlayerProfessionTier,
  setPlayerProfessionTier,
} from "./state.js";

function tierDisplayName(tierId) {
  return PROFESSION_TIERS[tierId]?.display ?? tierId;
}

function professionDisplayName(professionId) {
  return PROFESSIONS[professionId]?.display ?? professionId;
}

function sendCurrentTierStatus(player) {
  const professionId = getPlayerProfession(player);
  const tierId = getPlayerProfessionTier(player) ?? DEFAULT_PROFESSION_TIER_ID;

  if (!professionId) {
    player.sendMessage("§eVocê está sem profissão no momento.");
    return;
  }

  player.sendMessage(
    `§aProfissão atual: ${professionDisplayName(professionId)} | Tier: ${tierDisplayName(tierId)}`
  );
}

function handleSetTier(player, rawTier) {
  const professionId = getPlayerProfession(player);

  if (!professionId) {
    player.sendMessage("§cDefina uma profissão antes de ajustar o tier.");
    return true;
  }

  const tierId = resolveProfessionTierId(rawTier);

  if (!tierId) {
    const valid = Object.values(PROFESSION_TIERS)
      .map((entry) => entry.display)
      .join(", ");

    player.sendMessage(`§cTier inválido. Opções: ${valid}`);
    return true;
  }

  if (!setPlayerProfessionTier(player, tierId)) {
    player.sendMessage("§cNão foi possível atualizar o tier agora.");
    return true;
  }

  player.sendMessage(`§aTier definido: ${tierDisplayName(tierId)}`);
  return true;
}

function handleAdvanceTier(player) {
  const professionId = getPlayerProfession(player);

  if (!professionId) {
    player.sendMessage("§cDefina uma profissão antes de avançar o tier.");
    return true;
  }

  const nextTierId = advancePlayerProfessionTier(player);

  if (!nextTierId) {
    player.sendMessage("§cNão foi possível avançar o tier agora.");
    return true;
  }

  player.sendMessage(`§aTier atualizado para: ${tierDisplayName(nextTierId)}`);
  return true;
}

function handleResetTier(player) {
  const professionId = getPlayerProfession(player);

  if (!professionId) {
    resetPlayerProfessionTier(player);
    player.sendMessage("§eVocê está sem profissão; tier limpo.");
    return true;
  }

  const tierId = resetPlayerProfessionTier(player);
  player.sendMessage(`§aTier resetado para: ${tierDisplayName(tierId ?? DEFAULT_PROFESSION_TIER_ID)}`);
  return true;
}

export function handleProfessionTierScriptEvent(player, action, value = "") {
  switch (action) {
    case "set_profession_tier":
    case "definir_tier_profissao":
      return handleSetTier(player, value);
    case "advance_profession_tier":
    case "avancar_tier_profissao":
      return handleAdvanceTier(player);
    case "reset_profession_tier":
    case "resetar_tier_profissao":
      return handleResetTier(player);
    case "show_profession_tier":
    case "mostrar_tier_profissao":
      sendCurrentTierStatus(player);
      return true;
    default:
      return false;
  }
}

export { sendCurrentTierStatus, tierDisplayName };

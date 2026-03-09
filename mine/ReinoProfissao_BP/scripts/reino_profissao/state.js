import {
  DEFAULT_PROFESSION_TIER_ID,
  KINGDOMS,
  PROFESSIONS,
  PROFESSION_TIERS,
  TAG_PREFIXES,
  kingdomTagFor,
  professionTagFor,
  professionTierTagFor,
  resolveKingdomId,
  resolveProfessionId,
  resolveProfessionTierId,
} from "./constants.js";

function categoryTagIds(player, prefix) {
  return player
    .getTags()
    .filter((tag) => tag.startsWith(prefix))
    .map((tag) => tag.slice(prefix.length));
}

function pickFirstValidId(ids, catalog) {
  for (const id of ids) {
    if (catalog[id]) {
      return id;
    }
  }

  return undefined;
}

function clearCategoryTags(player, prefix) {
  for (const tag of player.getTags()) {
    if (tag.startsWith(prefix)) {
      player.removeTag(tag);
    }
  }
}

function keepOnlySelectedTag(player, prefix, selectedId, buildTag) {
  for (const tag of player.getTags()) {
    if (!tag.startsWith(prefix)) {
      continue;
    }

    if (!selectedId || tag !== buildTag(selectedId)) {
      player.removeTag(tag);
    }
  }
}

function replaceCategoryTag(player, prefix, selectedId, buildTag) {
  clearCategoryTags(player, prefix);

  if (selectedId) {
    player.addTag(buildTag(selectedId));
  }
}

function ensureProfessionTierForCurrentProfession(player, professionId) {
  if (!professionId) {
    replaceCategoryTag(player, TAG_PREFIXES.tier, undefined, professionTierTagFor);
    return undefined;
  }

  const currentTierId = getPlayerProfessionTier(player);
  const tierId = currentTierId ?? DEFAULT_PROFESSION_TIER_ID;

  replaceCategoryTag(player, TAG_PREFIXES.tier, tierId, professionTierTagFor);
  return tierId;
}

export function getPlayerKingdom(player) {
  const kingdomIds = categoryTagIds(player, TAG_PREFIXES.kingdom);
  return pickFirstValidId(kingdomIds, KINGDOMS);
}

export function setPlayerKingdom(player, rawKingdom) {
  const kingdomId = resolveKingdomId(rawKingdom);

  if (!kingdomId) {
    return false;
  }

  replaceCategoryTag(player, TAG_PREFIXES.kingdom, kingdomId, kingdomTagFor);
  return true;
}

export function getPlayerProfession(player) {
  const professionIds = categoryTagIds(player, TAG_PREFIXES.profession);
  return pickFirstValidId(professionIds, PROFESSIONS);
}

export function getPlayerProfessionTier(player) {
  const tierIds = categoryTagIds(player, TAG_PREFIXES.tier);
  return pickFirstValidId(tierIds, PROFESSION_TIERS);
}

export function setPlayerProfession(player, rawProfession) {
  const professionId = resolveProfessionId(rawProfession);

  if (!professionId) {
    return false;
  }

  const previousProfessionId = getPlayerProfession(player);

  replaceCategoryTag(player, TAG_PREFIXES.profession, professionId, professionTagFor);

  if (previousProfessionId !== professionId) {
    replaceCategoryTag(
      player,
      TAG_PREFIXES.tier,
      DEFAULT_PROFESSION_TIER_ID,
      professionTierTagFor
    );
  } else {
    ensureProfessionTierForCurrentProfession(player, professionId);
  }

  return true;
}

export function setPlayerProfessionTier(player, rawTier) {
  const professionId = getPlayerProfession(player);
  if (!professionId) {
    return false;
  }

  const tierId = resolveProfessionTierId(rawTier);
  if (!tierId) {
    return false;
  }

  replaceCategoryTag(player, TAG_PREFIXES.tier, tierId, professionTierTagFor);
  return true;
}

export function advancePlayerProfessionTier(player) {
  const professionId = getPlayerProfession(player);
  if (!professionId) {
    return undefined;
  }

  const currentTierId = getPlayerProfessionTier(player) ?? DEFAULT_PROFESSION_TIER_ID;
  const order = ["aprendiz", "profissional", "mestre"];
  const currentIndex = order.indexOf(currentTierId);
  const nextTierId = order[Math.min(currentIndex + 1, order.length - 1)] ?? DEFAULT_PROFESSION_TIER_ID;

  replaceCategoryTag(player, TAG_PREFIXES.tier, nextTierId, professionTierTagFor);
  return nextTierId;
}

export function clearPlayerProfession(player) {
  replaceCategoryTag(player, TAG_PREFIXES.profession, undefined, professionTagFor);
  replaceCategoryTag(player, TAG_PREFIXES.tier, undefined, professionTierTagFor);
}

export function resetPlayerProfessionTier(player) {
  const professionId = getPlayerProfession(player);

  if (!professionId) {
    replaceCategoryTag(player, TAG_PREFIXES.tier, undefined, professionTierTagFor);
    return undefined;
  }

  replaceCategoryTag(player, TAG_PREFIXES.tier, DEFAULT_PROFESSION_TIER_ID, professionTierTagFor);
  return DEFAULT_PROFESSION_TIER_ID;
}

export function sanitizePlayerSelections(player) {
  const kingdomId = getPlayerKingdom(player);
  const professionId = getPlayerProfession(player);
  const tierId = professionId
    ? ensureProfessionTierForCurrentProfession(player, professionId)
    : undefined;

  keepOnlySelectedTag(player, TAG_PREFIXES.kingdom, kingdomId, kingdomTagFor);
  keepOnlySelectedTag(player, TAG_PREFIXES.profession, professionId, professionTagFor);
  keepOnlySelectedTag(player, TAG_PREFIXES.tier, tierId, professionTierTagFor);

  return { kingdomId, professionId, tierId };
}

export function getPlayerSelectionSnapshot(player) {
  const kingdomId = getPlayerKingdom(player);
  const professionId = getPlayerProfession(player);
  const tierId = professionId
    ? getPlayerProfessionTier(player) ?? DEFAULT_PROFESSION_TIER_ID
    : undefined;

  return {
    kingdomId,
    professionId,
    tierId,
    kingdom: kingdomId ? KINGDOMS[kingdomId] : undefined,
    profession: professionId ? PROFESSIONS[professionId] : undefined,
    professionTier: tierId ? PROFESSION_TIERS[tierId] : undefined,
  };
}

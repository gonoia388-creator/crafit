import {
  KINGDOMS,
  PROFESSIONS,
  TAG_PREFIXES,
  kingdomTagFor,
  professionTagFor,
  resolveKingdomId,
  resolveProfessionId,
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

export function setPlayerProfession(player, rawProfession) {
  const professionId = resolveProfessionId(rawProfession);

  if (!professionId) {
    return false;
  }

  replaceCategoryTag(player, TAG_PREFIXES.profession, professionId, professionTagFor);
  return true;
}

export function clearPlayerProfession(player) {
  replaceCategoryTag(player, TAG_PREFIXES.profession, undefined, professionTagFor);
}

export function sanitizePlayerSelections(player) {
  const kingdomId = getPlayerKingdom(player);
  const professionId = getPlayerProfession(player);

  keepOnlySelectedTag(player, TAG_PREFIXES.kingdom, kingdomId, kingdomTagFor);
  keepOnlySelectedTag(player, TAG_PREFIXES.profession, professionId, professionTagFor);

  return { kingdomId, professionId };
}

export function getPlayerSelectionSnapshot(player) {
  const kingdomId = getPlayerKingdom(player);
  const professionId = getPlayerProfession(player);

  return {
    kingdomId,
    professionId,
    kingdom: kingdomId ? KINGDOMS[kingdomId] : undefined,
    profession: professionId ? PROFESSIONS[professionId] : undefined,
  };
}

import { getPlayerSelectionSnapshot } from "./state.js";

const EMPTY_KINGDOM_LABEL = "Sem Reino";
const EMPTY_PROFESSION_LABEL = "Sem Profiss\u00e3o";
const MULTILINE_NAME_TAG = true;

export function buildDisplayTag(player) {
  const { kingdom, profession } = getPlayerSelectionSnapshot(player);

  const kingdomText = kingdom?.display ?? EMPTY_KINGDOM_LABEL;
  const professionText = profession?.display ?? EMPTY_PROFESSION_LABEL;
  const firstLine = `${kingdomText} \u2022 ${professionText}`;

  return MULTILINE_NAME_TAG
    ? `${firstLine}\n${player.name}`
    : `${firstLine} \u2022 ${player.name}`;
}

export function refreshPlayerDisplay(player) {
  const displayTag = buildDisplayTag(player);

  if (player.nameTag !== displayTag) {
    player.nameTag = displayTag;
  }
}

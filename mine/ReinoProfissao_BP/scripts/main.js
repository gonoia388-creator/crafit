import { initializeKingdomProfessionSystem } from "./reino_profissao/events.js";

initializeKingdomProfessionSystem();

export {
  clearPlayerProfession,
  getPlayerKingdom,
  getPlayerProfession,
  getPlayerSelectionSnapshot,
  sanitizePlayerSelections,
  setPlayerKingdom,
  setPlayerProfession,
} from "./reino_profissao/state.js";

export { buildDisplayTag, refreshPlayerDisplay } from "./reino_profissao/display.js";

export {
  handleProfessionSelection,
  hasDefinedProfession,
  PROFESSION_LOCK_MESSAGE,
  refreshProfessionState,
  showProfessionMenu,
} from "./reino_profissao/profession_menu.js";

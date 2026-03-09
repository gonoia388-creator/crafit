import { initializeKingdomProfessionSystem } from "./reino_profissao/events.js";

initializeKingdomProfessionSystem();

export {
  advancePlayerProfessionTier,
  clearPlayerProfession,
  getPlayerKingdom,
  getPlayerProfession,
  getPlayerProfessionTier,
  getPlayerSelectionSnapshot,
  resetPlayerProfessionTier,
  sanitizePlayerSelections,
  setPlayerKingdom,
  setPlayerProfession,
  setPlayerProfessionTier,
} from "./reino_profissao/state.js";

export { buildDisplayTag, refreshPlayerDisplay } from "./reino_profissao/display.js";

export {
  handleProfessionSelection,
  hasDefinedProfession,
  PROFESSION_LOCK_MESSAGE,
  refreshProfessionState,
  showProfessionMenu,
} from "./reino_profissao/profession_menu.js";

export {
  handleProfessionTierScriptEvent,
  sendCurrentTierStatus,
  tierDisplayName,
} from "./reino_profissao/profession_progression.js";

export {
  handleProfessionGameplayPlayerLeave,
  initializeProfessionGameplaySystem,
} from "./reino_profissao/profession_effects.js";

import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { KINGDOMS, PROFESSIONS } from "./constants.js";
import {
  getPlayerProfession,
  sanitizePlayerSelections,
  setPlayerProfession,
} from "./state.js";
import { refreshPlayerDisplay } from "./display.js";

const PROFESSION_MENU_ORDER = Object.freeze([
  "cacador",
  "alquimista",
  "ferreiro_armas",
  "lenhador",
  "minerador",
  "criador",
  "lavrador",
  "rei",
]);

const PROFESSION_LOCK_MESSAGE = "Você pode trocar de profissão quando quiser.";

const PROFESSION_SELECTION_RESULT = Object.freeze({
  applied: "applied",
  invalid: "invalid",
  locked: "locked",
});

const PROFESSION_MENU_RESULT = Object.freeze({
  applied: "applied",
  busy: "busy",
  closed: "closed",
  canceled: "canceled",
  invalid: "invalid",
  locked: "locked",
  error: "error",
});

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

function resolveProfessionLabel(professionId) {
  return PROFESSIONS[professionId]?.display ?? professionId;
}

function resolveKingdomLabel(kingdomId) {
  return KINGDOMS[kingdomId]?.display ?? kingdomId;
}

function buildProfessionForm(options = {}) {
  const { contextKingdomId } = options;
  const bodyLines = [
    "§7Escolha sua profissão atual.",
    "§7Você pode trocar quando quiser clicando no NPC de reino.",
  ];

  if (contextKingdomId) {
    bodyLines.push(
      "",
      `§7Reino definido pelo NPC: §f${resolveKingdomLabel(contextKingdomId)}`
    );
  }

  const form = new ActionFormData()
    .title("§6Conselho de Profissões")
    .body(bodyLines.join("\n"));

  for (const professionId of PROFESSION_MENU_ORDER) {
    form.button(resolveProfessionLabel(professionId));
  }

  return form;
}

function normalizeCancelationReason(reason) {
  if (!reason) {
    return undefined;
  }

  if (reason === FormCancelationReason.UserBusy || reason === "UserBusy") {
    return FormCancelationReason.UserBusy;
  }

  if (reason === FormCancelationReason.UserClosed || reason === "UserClosed") {
    return FormCancelationReason.UserClosed;
  }

  return reason;
}

export function hasDefinedProfession(player) {
  return Boolean(getPlayerProfession(player));
}

export function refreshProfessionState(player) {
  sanitizePlayerSelections(player);
  refreshPlayerDisplay(player);
}

export function handleProfessionSelection(player, professionId) {
  const success = setPlayerProfession(player, professionId);

  if (!success) {
    const validOptions = PROFESSION_MENU_ORDER
      .map((id) => resolveProfessionLabel(id))
      .join(", ");

    player.sendMessage(`§cProfissão inválida. Opções: ${validOptions}`);
    return { status: PROFESSION_SELECTION_RESULT.invalid };
  }

  refreshProfessionState(player);

  return {
    status: PROFESSION_SELECTION_RESULT.applied,
    professionId,
  };
}

export async function showProfessionMenu(player, options = {}) {
  const { onSelection, contextKingdomId } = options;

  const form = buildProfessionForm({ contextKingdomId });
  let response;

  try {
    response = await form.show(player);
  } catch (error) {
    return {
      status: PROFESSION_MENU_RESULT.error,
      reason: "show_exception",
      errorMessage: stringifyError(error),
    };
  }

  if (response.canceled) {
    const cancelationReason = normalizeCancelationReason(response.cancelationReason);

    if (cancelationReason === FormCancelationReason.UserBusy) {
      return {
        status: PROFESSION_MENU_RESULT.busy,
        reason: "UserBusy",
        cancelationReason,
      };
    }

    if (cancelationReason === FormCancelationReason.UserClosed) {
      return {
        status: PROFESSION_MENU_RESULT.closed,
        reason: "UserClosed",
        cancelationReason,
      };
    }

    return {
      status: PROFESSION_MENU_RESULT.canceled,
      reason: cancelationReason ?? "canceled",
      cancelationReason,
    };
  }

  const selectedIndex = response.selection;
  if (typeof selectedIndex !== "number") {
    return {
      status: PROFESSION_MENU_RESULT.error,
      reason: "missing_selection",
    };
  }

  const selectedProfessionId = PROFESSION_MENU_ORDER[Math.trunc(selectedIndex)];
  if (!selectedProfessionId) {
    return {
      status: PROFESSION_MENU_RESULT.error,
      reason: "invalid_selection_index",
      selectedIndex,
    };
  }

  const selectionHandler =
    typeof onSelection === "function" ? onSelection : handleProfessionSelection;

  let selectionResult;

  try {
    selectionResult = await Promise.resolve(
      selectionHandler(player, selectedProfessionId, {
        contextKingdomId,
      })
    );
  } catch (error) {
    return {
      status: PROFESSION_MENU_RESULT.error,
      reason: "selection_exception",
      errorMessage: stringifyError(error),
    };
  }

  if (selectionResult?.status === PROFESSION_SELECTION_RESULT.applied) {
    player.sendMessage(`§aProfissão atual: ${resolveProfessionLabel(selectedProfessionId)}`);

    const result = {
      status: PROFESSION_MENU_RESULT.applied,
      professionId: selectedProfessionId,
    };

    if (selectionResult && typeof selectionResult === "object") {
      for (const [key, value] of Object.entries(selectionResult)) {
        if (key === "status") {
          continue;
        }

        result[key] = value;
      }
    }

    return result;
  }

  if (selectionResult?.status === PROFESSION_SELECTION_RESULT.locked) {
    return { status: PROFESSION_MENU_RESULT.locked };
  }

  return { status: PROFESSION_MENU_RESULT.invalid };
}

export {
  PROFESSION_LOCK_MESSAGE,
  PROFESSION_MENU_RESULT,
  PROFESSION_SELECTION_RESULT,
};

const TAG_PREFIXES = Object.freeze({
  kingdom: "rp:kingdom:",
  profession: "rp:profession:",
});

const NPC_TAG_PREFIXES = Object.freeze({
  kingdomNpc: "reino_npc:",
});

export const KINGDOMS = Object.freeze({
  ardena: Object.freeze({ id: "ardena", label: "Reino de Ardena", display: "Ardena" }),
  cinzas: Object.freeze({ id: "cinzas", label: "Reino das Cinzas", display: "Cinzas" }),
  fjordur: Object.freeze({ id: "fjordur", label: "Reino de Fjordur", display: "Fjordur" }),
  nevoa: Object.freeze({ id: "nevoa", label: "Reino da Névoa", display: "Névoa" }),
});

export const PROFESSIONS = Object.freeze({
  minerador: Object.freeze({
    id: "minerador",
    label: "Minerador do Reino",
    display: "Minerador do Reino",
  }),
  lenhador: Object.freeze({
    id: "lenhador",
    label: "Lenhador da Coroa",
    display: "Lenhador da Coroa",
  }),
  fazendeiro: Object.freeze({
    id: "fazendeiro",
    label: "Lavrador Real",
    display: "Lavrador Real",
  }),
  pescador: Object.freeze({
    id: "pescador",
    label: "Pescador dos Rios",
    display: "Pescador dos Rios",
  }),
  criador: Object.freeze({
    id: "criador",
    label: "Criador do Reino",
    display: "Criador do Reino",
  }),
  ferreiro: Object.freeze({
    id: "ferreiro",
    label: "Ferreiro da Forja",
    display: "Ferreiro da Forja",
  }),
});

function stripDiacritics(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeToken(value) {
  if (typeof value !== "string") {
    return "";
  }

  return stripDiacritics(value)
    .toLowerCase()
    .trim()
    .replace(/^(reino\s+de\s+|reino\s+das\s+|reino\s+da\s+)/, "")
    .replace(/\s+/g, " ");
}

function createAliasMap(catalog) {
  const aliases = {};

  for (const entry of Object.values(catalog)) {
    const id = entry.id;
    const normalizedId = normalizeToken(id);
    const normalizedDisplay = normalizeToken(entry.display);
    const normalizedLabel = normalizeToken(entry.label);

    aliases[normalizedId] = id;
    aliases[normalizedDisplay] = id;
    aliases[normalizedLabel] = id;
  }

  return Object.freeze(aliases);
}

const KINGDOM_ALIASES = createAliasMap(KINGDOMS);
const PROFESSION_ALIASES = createAliasMap(PROFESSIONS);

export function resolveKingdomId(value) {
  const token = normalizeToken(value);
  return KINGDOM_ALIASES[token];
}

export function resolveProfessionId(value) {
  const token = normalizeToken(value);
  return PROFESSION_ALIASES[token];
}

export function kingdomTagFor(kingdomId) {
  return `${TAG_PREFIXES.kingdom}${kingdomId}`;
}

export function professionTagFor(professionId) {
  return `${TAG_PREFIXES.profession}${professionId}`;
}

export const PROFESSION_NPC_TAG = "profissao_npc";
export const KINGDOM_NPC_TAG = "reino_npc";
export const NPC_ENTITY_TYPE_IDS = Object.freeze(["minecraft:npc", "npc"]);

export function kingdomNpcTagFor(kingdomId) {
  return `${NPC_TAG_PREFIXES.kingdomNpc}${kingdomId}`;
}

export function kingdomNpcDisplayName(kingdomId) {
  const kingdom = KINGDOMS[kingdomId];
  return kingdom ? `§6NPC do Reino: ${kingdom.display}` : "§6NPC de Reino";
}

export { NPC_TAG_PREFIXES, TAG_PREFIXES };

import type { BacklogSlot, CompletionType, GameStatus } from "@/lib/backlog/constants";

export type DashboardSearchItem = {
  id: string;
  title: string;
  steamAppId: number | null;
  status: GameStatus;
  backlogSlot: BacklogSlot;
  completionType: CompletionType;
  currentRotation: boolean;
  queuePosition: number | null;
};

export function searchDashboardGames(
  games: DashboardSearchItem[],
  query: string,
  options: { limit?: number } = {},
) {
  const preparedQuery = prepareQuery(query);
  const limit = Math.max(1, options.limit ?? 8);

  if (!preparedQuery.normalized) return [];

  return games
    .map((game, index) => {
      const rank = getSearchRank(game, preparedQuery);
      return rank == null ? null : { game, index, rank };
    })
    .filter((result): result is { game: DashboardSearchItem; index: number; rank: number } => result != null)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.game.currentRotation !== b.game.currentRotation) return a.game.currentRotation ? -1 : 1;
      const aQueued = a.game.queuePosition != null;
      const bQueued = b.game.queuePosition != null;
      if (aQueued !== bQueued) return aQueued ? -1 : 1;
      if (aQueued && bQueued && a.game.queuePosition !== b.game.queuePosition) {
        return (a.game.queuePosition ?? Number.MAX_SAFE_INTEGER) - (b.game.queuePosition ?? Number.MAX_SAFE_INTEGER);
      }
      const titleSort = a.game.title.localeCompare(b.game.title);
      return titleSort === 0 ? a.index - b.index : titleSort;
    })
    .slice(0, limit)
    .map((result) => result.game);
}

type PreparedQuery = {
  normalized: string;
  compact: string;
  terms: string[];
};

function getSearchRank(game: DashboardSearchItem, query: PreparedQuery) {
  const title = normalizeSearchText(game.title);
  const compactTitle = compactText(title);
  const appId = game.steamAppId == null ? "" : String(game.steamAppId);

  const matchesAllTerms = query.terms.every(
    (term) => title.includes(term) || compactTitle.includes(term) || appId.includes(term),
  );

  if (!matchesAllTerms) return null;
  if (title === query.normalized || compactTitle === query.compact) return 0;
  if (title.startsWith(query.normalized) || compactTitle.startsWith(query.compact)) return 1;
  if (
    title.includes(query.normalized) ||
    compactTitle.includes(query.compact) ||
    query.terms.every((term) => title.includes(term) || compactTitle.includes(term))
  ) {
    return 2;
  }
  return 3;
}

function prepareQuery(query: string): PreparedQuery {
  const normalized = normalizeSearchText(query);
  return {
    normalized,
    compact: compactText(normalized),
    terms: normalized.split(" ").filter(Boolean),
  };
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compactText(value: string) {
  return value.replace(/\s+/g, "");
}

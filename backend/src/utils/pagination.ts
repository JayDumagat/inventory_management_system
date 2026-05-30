const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 100;

function parsePositiveInt(value: unknown, fallback: number): number {
  const raw = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function parsePaginationParams(query: { page?: unknown; perPage?: unknown; limit?: unknown }, defaults?: { perPage?: number; maxPerPage?: number }) {
  const page = parsePositiveInt(query.page, DEFAULT_PAGE);
  const perPageFallback = defaults?.perPage ?? DEFAULT_PER_PAGE;
  const maxPerPage = defaults?.maxPerPage ?? MAX_PER_PAGE;
  const requestedPerPage = parsePositiveInt(query.perPage ?? query.limit, perPageFallback);
  const perPage = Math.min(requestedPerPage, maxPerPage);
  const offset = (page - 1) * perPage;

  return { page, perPage, offset };
}
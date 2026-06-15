// Client-side normalization mirroring the backend. The server re-normalizes on
// ingest, so this is purely to preview grouping to the user during a scan.

function stripAccents(value: string): string {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

const LEADING_ARTICLES = ["the ", "a ", "an "];
const FEAT = /\s*[\(\[]?\s*(feat\.?|featuring|ft\.?|with)\s+.*$/i;
const QUALIFIER = /\s*[\(\[][^\)\]]*[\)\]]/g;

function base(value: string): string {
  return stripAccents(value).toLowerCase().trim().replace(/\s+/g, " ");
}

function stripArticle(value: string): string {
  for (const a of LEADING_ARTICLES) {
    if (value.startsWith(a)) return value.slice(a.length);
  }
  return value;
}

function trimEdges(value: string): string {
  return value.replace(/^[^\w]+|[^\w]+$/g, "");
}

export function normalizeArtist(artist: string | null | undefined): string {
  if (!artist) return "";
  let v = base(artist).replace(FEAT, "").replace(QUALIFIER, "");
  v = stripArticle(v);
  return trimEdges(v).trim();
}

export function normalizeTitle(title: string | null | undefined): string {
  if (!title) return "";
  let v = base(title).replace(QUALIFIER, "");
  v = stripArticle(v);
  return trimEdges(v).trim();
}

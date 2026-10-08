// Guide ids are validated against the Wiki catalogue at build time.
export function wikiLink(id?: string) {
  return id ? `/wiki/${encodeURIComponent(id)}` : "/wiki";
}

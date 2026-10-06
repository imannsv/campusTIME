import { renderToString } from "react-dom/server";
import App from "./App";
import type { SiteConfig } from "./site";
export { pageTitles, pageForPath } from "./site";
export function renderPage(path: string, config: SiteConfig) {
  return renderToString(<App path={path} config={config} />);
}

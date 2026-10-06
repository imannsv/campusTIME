import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import { pageForPath, type SiteConfig } from "./site";
import "./styles.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-800.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";

document.documentElement.classList.add("js");
const container = document.getElementById("root")!;
const data = document.getElementById("site-data");
const initial: { path: string; config: SiteConfig } | null = data
  ? JSON.parse(data.textContent || "{}")
  : null;
const path = location.pathname;
const app = <App path={path} config={initial?.config || __SITE_CONFIG__} />;
if (initial && pageForPath(initial.path) === pageForPath(path))
  hydrateRoot(container, app);
else createRoot(container).render(app);

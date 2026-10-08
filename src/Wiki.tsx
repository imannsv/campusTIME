import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ExternalLink,
  Menu,
  Search,
  X,
} from "lucide-react";
import { api, DEMO_MODE } from "./api";
import { Brand, Login, SessionState } from "./Auth";
import { Modal } from "./components";
import { wikiLink } from "./wiki-links";
import "./wiki.css";

type Article = {
  id: string;
  title: string;
  section: string;
  parentId: string | null;
  summary: string;
  keywords: string[];
  updatedAt: string;
  searchText: string;
  related: string[];
  images: string[];
};
const normalize = (text: string) =>
  text
    .toLocaleLowerCase("de")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
const slug = (text: string) =>
  normalize(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
function currentArticle() {
  try {
    return decodeURIComponent(location.pathname.split("/")[2] || "");
  } catch {
    return "unknown";
  }
}
function currentAnchor() {
  try {
    return decodeURIComponent(location.hash.slice(1));
  } catch {
    return "";
  }
}

export default function Wiki() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selected, setSelected] = useState(currentArticle);
  const [body, setBody] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [articleError, setArticleError] = useState("");
  const [menu, setMenu] = useState(false);
  const [image, setImage] = useState<{ src: string; alt: string } | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const menuToggle = useRef<HTMLButtonElement>(null);
  const version = useRef(0);
  const authCheck = useRef(0);
  const selectedArticle = articles.find((item) => item.id === selected);
  const identity = session?.authenticated
    ? `${session.user}:${session.institution.id}`
    : "";

  useEffect(() => {
    if (!menu || !matchMedia("(max-width:767px)").matches) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () =>
      Array.from(
        navigation.current?.querySelectorAll<HTMLElement>(
          "button, a[href], summary",
        ) || [],
      ).filter((el) => el.offsetParent !== null);
    controls()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const elements = controls(),
        first = elements[0],
        last = elements.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      document.body.style.overflow = previousOverflow;
      menuToggle.current?.focus();
    };
  }, [menu]);

  useEffect(() => {
    if (DEMO_MODE) return;
    let mounted = true;
    const check = async (clear = false) => {
      const request = ++authCheck.current;
      if (clear) {
        version.current++;
        setSession(null);
        setArticles([]);
        setBody("");
        setImage(null);
      }
      try {
        const state = await api("auth/me/");
        if (mounted && request === authCheck.current) {
          if (!state.authenticated) {
            version.current++;
            setArticles([]);
            setBody("");
            setImage(null);
          }
          setSession(state);
          setError("");
        }
      } catch (err) {
        if (mounted && request === authCheck.current) {
          version.current++;
          setArticles([]);
          setBody("");
          setImage(null);
          setSession(null);
          setError((err as Error).message);
        }
      }
    };
    const focus = () => {
      void check();
    };
    const storage = (e: StorageEvent) => {
      if (e.key === "campuszeit-auth-event") void check(true);
    };
    const visible = () => {
      if (document.visibilityState === "visible") void check();
    };
    void check();
    const timer = setInterval(focus, 30000);
    window.addEventListener("focus", focus);
    window.addEventListener("storage", storage);
    document.addEventListener("visibilitychange", visible);
    return () => {
      mounted = false;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      window.removeEventListener("storage", storage);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  useEffect(() => {
    if (!identity) return;
    const controller = new AbortController();
    const request = ++version.current;
    setArticles([]);
    setBody("");
    api("wiki/", "GET", undefined, { signal: controller.signal })
      .then((data) => {
        if (request !== version.current) return;
        setArticles(data.articles);
        setError("");
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, [identity]);

  useEffect(() => {
    if (!identity || !selected || !selectedArticle) {
      setBody("");
      return;
    }
    const controller = new AbortController();
    const request = version.current;
    setBody("");
    setArticleError("");
    setImage(null);
    api(`wiki/articles/${encodeURIComponent(selected)}/`, "GET", undefined, {
      signal: controller.signal,
    })
      .then((data) => {
        if (request !== version.current || controller.signal.aborted) return;
        setBody(data.markdown);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setArticleError(err.message);
      });
    return () => controller.abort();
  }, [selected, selectedArticle, identity]);

  useEffect(() => {
    const pop = () => {
      setSelected(currentArticle());
      setQuery("");
      setMenu(false);
    };
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        search.current?.focus();
      }
      if (e.key === "Escape") {
        setMenu(false);
        if (query) {
          setQuery("");
          search.current?.focus();
        }
      }
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("keydown", key);
    };
  }, [query]);
  useEffect(() => {
    document.title = `${selectedArticle?.title || "Wiki & Hilfe"} · CampusZeit`;
    if (body) {
      const target = location.hash
        ? document.getElementById(currentAnchor())
        : null;
      if (target) target.scrollIntoView();
      else {
        window.scrollTo(0, 0);
        heading.current?.focus({ preventScroll: true });
      }
    }
  }, [body, selectedArticle]);

  const sections = [...new Set(articles.map((item) => item.section))];
  const results = useMemo(() => {
    const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
    return articles
      .map((item) => {
        const title = normalize(item.title),
          keywords = normalize(item.keywords.join(" ")),
          text = normalize(item.summary + " " + item.searchText);
        const score = terms.every(
          (term) =>
            title.includes(term) ||
            keywords.includes(term) ||
            text.includes(term),
        )
          ? terms.reduce(
              (sum, term) =>
                sum +
                (title.includes(term) ? 10 : keywords.includes(term) ? 5 : 1),
              0,
            )
          : 0;
        return { item, score };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [query, articles]);
  const headings = useMemo(() => {
    const used = new Map<string, number>();
    return body.split("\n").flatMap((line, index) => {
      const match = /^(#{2,3})\s+(.+)$/.exec(line);
      if (!match) return [];
      const title = match[2].replace(/\*|`/g, ""),
        base = slug(title),
        count = used.get(base) || 0;
      used.set(base, count + 1);
      return [
        {
          line: index + 1,
          title,
          id: count ? `${base}-${count}` : base,
          level: match[1].length,
        },
      ];
    });
  }, [body]);
  function navigate(id: string) {
    if (id === selected && !query) {
      setMenu(false);
      return;
    }
    history.pushState(null, "", wikiLink(id));
    setSelected(id);
    setQuery("");
    setMenu(false);
    setArticleError("");
    window.scrollTo(0, 0);
  }
  const headingId = (line?: number) =>
    headings.find((item) => item.line === line)?.id;

  if (DEMO_MODE)
    return (
      <main className="wiki-gate">
        <Brand />
        <BookOpen size={32} />
        <h1>Wiki & Hilfe</h1>
        <p>
          Die Wiki ist in der Vollversion nach der Anmeldung verfügbar. Diese
          öffentliche Browser-Demo hat keine echte Anmeldung.
        </p>
        <a className="button primary" href="/">
          Zur Demo
        </a>
      </main>
    );
  if (!session)
    return (
      <main className="wiki-gate">
        <Brand />
        <h1>Wiki & Hilfe</h1>
        <p role={error ? "alert" : "status"}>{error || "Anmeldung prüfen …"}</p>
        {error && (
          <button className="button" onClick={() => location.reload()}>
            Erneut versuchen
          </button>
        )}
      </main>
    );
  if (!session.authenticated)
    return (
      <Login
        onLogin={(state) => {
          authCheck.current++;
          setSession(state);
          setError("");
        }}
      />
    );
  const renderTree = (parentId: string | null) =>
    articles
      .filter((item) => item.parentId === parentId)
      .map((item) => (
        <div key={item.id} className="wiki-tree-item">
          <a
            href={wikiLink(item.id)}
            aria-current={selected === item.id && !query ? "page" : undefined}
            onClick={(e) => {
              if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                e.preventDefault();
                navigate(item.id);
              }
            }}
          >
            {item.title}
          </a>
          {articles.some((child) => child.parentId === item.id) && (
            <div className="wiki-tree-children">{renderTree(item.id)}</div>
          )}
        </div>
      ));
  return (
    <div className="wiki-shell">
      <a className="wiki-skip" href="#wiki-content">
        Zum Inhalt
      </a>
      <header className="wiki-header">
        <a
          href="/wiki"
          className="wiki-brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("");
          }}
        >
          <Brand />
        </a>
        <span className="wiki-label">Wiki & Hilfe</span>
        <div className="wiki-search">
          <Search size={18} />
          <input
            ref={search}
            aria-label="Wiki durchsuchen"
            placeholder="Anleitungen durchsuchen …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="icon-button"
              aria-label="Suche leeren"
              onClick={() => {
                setQuery("");
                search.current?.focus();
              }}
            >
              <X size={17} />
            </button>
          )}
        </div>
        <a className="button wiki-back" href="/">
          <ArrowLeft size={16} />
          <span>Zur Anwendung</span>
        </a>
        <button
          ref={menuToggle}
          className="icon-button wiki-menu-toggle"
          aria-label={menu ? "Themen schließen" : "Themen öffnen"}
          aria-expanded={menu}
          aria-controls="wiki-navigation"
          onClick={() => setMenu(!menu)}
        >
          <Menu size={22} />
        </button>
      </header>
      {menu && (
        <button
          className="wiki-scrim"
          aria-label="Themen schließen"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        ref={navigation}
        id="wiki-navigation"
        className={`wiki-navigation ${menu ? "open" : ""}`}
      >
        <button
          className="icon-button wiki-menu-close"
          aria-label="Themen schließen"
          onClick={() => setMenu(false)}
        >
          <X size={20} />
        </button>
        <a
          className={!selected && !query ? "wiki-home active" : "wiki-home"}
          href="/wiki"
          onClick={(e) => {
            e.preventDefault();
            navigate("");
          }}
        >
          <BookOpen size={17} />
          Übersicht
        </a>
        {sections.map((section) => (
          <details key={section} open className="wiki-section">
            <summary>
              {section}
              <ChevronDown size={15} />
            </summary>
            {articles
              .filter((item) => item.section === section && !item.parentId)
              .map((root) => (
                <div key={root.id} className="wiki-tree-item">
                  <a
                    href={wikiLink(root.id)}
                    aria-current={
                      selected === root.id && !query ? "page" : undefined
                    }
                    onClick={(e) => {
                      if (
                        !e.ctrlKey &&
                        !e.metaKey &&
                        !e.shiftKey &&
                        e.button === 0
                      ) {
                        e.preventDefault();
                        navigate(root.id);
                      }
                    }}
                  >
                    {root.title}
                  </a>
                  {articles.some((child) => child.parentId === root.id) && (
                    <div className="wiki-tree-children">
                      {renderTree(root.id)}
                    </div>
                  )}
                </div>
              ))}
          </details>
        ))}
        <small className="wiki-institution">
          {session.institution.name}
          <br />
          Angemeldet als {session.user}
        </small>
      </aside>
      <main id="wiki-content" className="wiki-content" tabIndex={-1}>
        {error ? (
          <div className="wiki-error" role="alert">
            <h1>Wiki konnte nicht geladen werden</h1>
            <p>{error}</p>
            <button className="button" onClick={() => location.reload()}>
              Erneut versuchen
            </button>
          </div>
        ) : !articles.length ? (
          <p role="status">Anleitungen laden …</p>
        ) : query.trim() ? (
          <>
            <div className="wiki-breadcrumb">Suche</div>
            <h1>Suchergebnisse</h1>
            <p role="status">
              {results.length}{" "}
              {results.length === 1 ? "Ergebnis" : "Ergebnisse"} für „
              {query.trim()}“
            </p>
            {results.length ? (
              <div className="wiki-results">
                {results.map(({ item }) => (
                  <a
                    key={item.id}
                    href={wikiLink(item.id)}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(item.id);
                    }}
                  >
                    <small>{item.section}</small>
                    <h2>{item.title}</h2>
                    <p>{item.summary}</p>
                  </a>
                ))}
              </div>
            ) : (
              <p>
                Keine passende Anleitung gefunden. Versuche einen Begriff wie
                „Räume“, „Klausur“ oder „Lehrplan“.
              </p>
            )}
          </>
        ) : !selected ? (
          <>
            <div className="wiki-breadcrumb">CampusZeit</div>
            <h1 ref={heading} tabIndex={-1}>
              Wiki & Hilfe
            </h1>
            <p className="wiki-intro">
              Anleitungen für Einrichtung, Planung und Veröffentlichung.
            </p>
            <a
              className="wiki-start"
              href={wikiLink("setup")}
              onClick={(e) => {
                e.preventDefault();
                navigate("setup");
              }}
            >
              <BookOpen size={25} />
              <div>
                <h2>Neu anfangen</h2>
                <p>
                  Schritt für Schritt vom leeren System zum veröffentlichten
                  Plan.
                </p>
              </div>
              <ArrowRight size={20} />
            </a>
            <div className="wiki-topics">
              {sections.map((section) => (
                <section key={section}>
                  <h2>{section}</h2>
                  {articles
                    .filter(
                      (item) => item.section === section && !item.parentId,
                    )
                    .map((item) => (
                      <a
                        key={item.id}
                        href={wikiLink(item.id)}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(item.id);
                        }}
                      >
                        {item.title}
                        <ArrowRight size={14} />
                      </a>
                    ))}
                </section>
              ))}
            </div>
          </>
        ) : !selectedArticle ? (
          <>
            <h1>Artikel nicht gefunden</h1>
            <p>Dieser Wiki-Link ist nicht verfügbar.</p>
            <a
              className="button"
              href="/wiki"
              onClick={(e) => {
                e.preventDefault();
                navigate("");
              }}
            >
              Zur Wiki-Übersicht
            </a>
          </>
        ) : (
          <>
            <div className="wiki-breadcrumb">
              <a
                href="/wiki"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("");
                }}
              >
                Wiki
              </a>
              <span>/</span>
              {selectedArticle.section}
            </div>
            <h1 ref={heading} tabIndex={-1}>
              {selectedArticle.title}
            </h1>
            <p className="wiki-updated">
              Aktualisiert am{" "}
              {new Date(
                selectedArticle.updatedAt + "T12:00:00",
              ).toLocaleDateString("de-DE")}
            </p>
            {!!headings.length && (
              <details className="wiki-inline-toc">
                <summary>Inhaltsverzeichnis</summary>
                <nav aria-label="Artikelabschnitte">
                  {headings.map((item) => (
                    <a key={item.id} href={`#${item.id}`}>
                      {item.title}
                    </a>
                  ))}
                </nav>
              </details>
            )}
            {articleError ? (
              <div role="alert">
                <p>{articleError}</p>
                <button className="button" onClick={() => location.reload()}>
                  Erneut versuchen
                </button>
              </div>
            ) : !body ? (
              <p role="status">Artikel laden …</p>
            ) : (
              <article className="wiki-article">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  skipHtml
                  components={{
                    p: ({ node, children }) =>
                      node?.children.some(
                        (child) =>
                          child.type === "element" && child.tagName === "img",
                      ) ? (
                        <div>{children}</div>
                      ) : (
                        <p>{children}</p>
                      ),
                    h2: ({ node, children, ...props }) => (
                      <h2 {...props} id={headingId(node?.position?.start.line)}>
                        {children}
                      </h2>
                    ),
                    h3: ({ node, children, ...props }) => (
                      <h3 {...props} id={headingId(node?.position?.start.line)}>
                        {children}
                      </h3>
                    ),
                    img: ({ src, alt }) =>
                      src?.startsWith("/api/wiki/assets/") ? (
                        <figure>
                          <button
                            type="button"
                            className="wiki-image-button"
                            aria-label={`Bild vergrößern: ${alt || "Anleitung"}`}
                            onClick={() =>
                              setImage({ src, alt: alt || "Anleitung" })
                            }
                          >
                            <img src={src} alt={alt || ""} loading="lazy" />
                          </button>
                          <figcaption>{alt}</figcaption>
                        </figure>
                      ) : null,
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        {...(href?.startsWith("https://")
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        onClick={(e) => {
                          if (
                            href?.startsWith("/wiki/") &&
                            !e.ctrlKey &&
                            !e.metaKey &&
                            !e.shiftKey
                          ) {
                            e.preventDefault();
                            const [id, hash] = href.slice(6).split("#");
                            navigate(id);
                            if (hash) {
                              history.replaceState(null, "", href);
                              requestAnimationFrame(() =>
                                document.getElementById(hash)?.scrollIntoView(),
                              );
                            }
                          }
                        }}
                      >
                        {children}
                        {href?.startsWith("https://") && (
                          <ExternalLink size={12} />
                        )}
                      </a>
                    ),
                    table: ({ children }) => (
                      <div className="wiki-table">
                        <table>{children}</table>
                      </div>
                    ),
                  }}
                >
                  {body}
                </Markdown>
              </article>
            )}
            {!!selectedArticle.related.length && (
              <footer className="wiki-related">
                <h2>Weiterführende Anleitungen</h2>
                {selectedArticle.related
                  .map((id) => articles.find((item) => item.id === id))
                  .filter((item): item is Article => !!item)
                  .map((item) => (
                    <a
                      key={item.id}
                      href={wikiLink(item.id)}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(item.id);
                      }}
                    >
                      {item.title}
                      <ArrowRight size={16} />
                    </a>
                  ))}
              </footer>
            )}
          </>
        )}
      </main>
      {!!headings.length && !query && (
        <aside className="wiki-toc" aria-label="Inhaltsverzeichnis">
          <strong>Auf dieser Seite</strong>
          {headings.map((item) => (
            <a
              key={item.id}
              className={item.level === 3 ? "sub" : ""}
              href={`#${item.id}`}
            >
              {item.title}
            </a>
          ))}
        </aside>
      )}
      {image && (
        <Modal title="Bildansicht" wide onClose={() => setImage(null)}>
          <div className="wiki-lightbox">
            <img src={image.src} alt={image.alt} />
            <p>{image.alt}</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

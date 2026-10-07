import { useEffect, useRef, useState } from "react";
import { Icon, Logo } from "./Icon";
import { ProductPreview, Schedule } from "./ProductPreview";
import { faq, features, steps } from "./content";
import { pageForPath, type SiteConfig } from "./site";
import legal from "../content/legal.json";

function DemoLink({
  config,
  className = "button primary",
  children = "Browser-Demo öffnen",
}: {
  config: SiteConfig;
  className?: string;
  children?: string;
}) {
  return (
    <a
      className={className}
      href={config.demoUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <Icon name="arrow" />
      <span className="sr-only"> (öffnet in einem neuen Tab)</span>
    </a>
  );
}

function Header({ config, home }: { config: SiteConfig; home: boolean }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  const prefix = home ? "" : "/";
  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="logo-link" href="/" aria-label="CampusZeit Startseite">
          <Logo />
        </a>
        <button
          ref={button}
          className="menu-toggle enhanced-only"
          type="button"
          aria-expanded={open}
          aria-controls="main-nav"
          aria-label={open ? "Menü schließen" : "Menü öffnen"}
          onClick={() => setOpen(!open)}
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
        <nav
          id="main-nav"
          aria-label="Hauptnavigation"
          className={`nav-links ${open ? "is-open" : ""}`}
        >
          <a href={`${prefix}#produkt`} onClick={() => setOpen(false)}>
            Produkt
          </a>
          <a href={`${prefix}#ablauf`} onClick={() => setOpen(false)}>
            Ablauf
          </a>
          <a href={`${prefix}#zielgruppen`} onClick={() => setOpen(false)}>
            Für wen
          </a>
          <a href={`${prefix}#fragen`} onClick={() => setOpen(false)}>
            Fragen
          </a>
          <DemoLink
            config={config}
            className="button header-demo"
            children="Demo ansehen"
          />
        </nav>
      </div>
    </header>
  );
}

function Footer({ config }: { config: SiteConfig }) {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <a href="/" aria-label="CampusZeit Startseite">
          <Logo />
        </a>
        <p>
          Unterricht, Studium und Prüfungen.
          <br />
          Mit einem Plan für das Ganze.
        </p>
        <a href="/#kontakt" className="footer-contact">
          Kontakt
          <Icon name="arrow" />
        </a>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getUTCFullYear()} CampusZeit</span>
        <div>
          <a href="/impressum/">Impressum</a>
          <a href="/datenschutz/">Datenschutz</a>
          {!config.publicRelease ? (
            <span className="draft-label">Entwurf zur Prüfung</span>
          ) : null}
        </div>
      </div>
    </footer>
  );
}

function Freddy() {
  return (
    <svg
      className="freddy-illustration"
      width="130"
      height="130"
      viewBox="0 0 130 130"
      role="img"
      aria-label="Illustration von Freddy, dem mintfarbenen CampusAI-Assistenten"
    >
      <path
        d="M66 12C95 9 115 34 116 64c1 30-19 51-48 53C37 120 13 101 13 72S34 15 66 12Z"
        fill="#6ed8bf"
      />
      <ellipse cx="48" cy="62" rx="9" ry="11" fill="#173b50" />
      <ellipse cx="83" cy="62" rx="9" ry="11" fill="#173b50" />
      <circle cx="50" cy="59" r="3" fill="white" />
      <circle cx="85" cy="59" r="3" fill="white" />
    </svg>
  );
}

function Home({ config }: { config: SiteConfig }) {
  return (
    <>
      <section className="hero container" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">Ein Stundenplan, der alles zusammenbringt.</h1>
          <p className="hero-description">
            Räume, Lehrpläne, Menschen und Prüfungen gemeinsam planen. Damit aus
            vielen Vorgaben ein übersichtlicher, geprüfter Plan wird.
          </p>
          <div className="hero-actions">
            <DemoLink config={config} />
            <a className="text-link" href="#kontakt">
              Ins Gespräch kommen
              <Icon name="chevron" />
            </a>
          </div>
          <p className="demo-disclosure">
            Die Browser-Demo verwendet fiktive Testdaten.
            <br />
            Änderungen bleiben in Ihrem Browser.
          </p>
        </div>
        <div className="hero-product">
          <div className="hero-window">
            <div className="mini-window-bar">
              <span className="mini-mark">
                <Icon name="calendar" />
                Stundenplanung
              </span>
              <span className="mini-code">WI26</span>
            </div>
            <Schedule compact />
          </div>
          <div className="hero-caption">
            <span className="caption-line" />
            Ein Plan. Alle Zusammenhänge im Blick.<span>Fiktives Beispiel</span>
          </div>
        </div>
      </section>
      <div className="scope-strip">
        <div className="container">
          <span>Von der ersten Einrichtung bis zum freigegebenen Plan</span>
          <div>
            <span>
              <Icon name="room" />
              Räume
            </span>
            <span>
              <Icon name="book" />
              Lehrpläne
            </span>
            <span>
              <Icon name="calendar" />
              Stundenpläne
            </span>
            <span>
              <Icon name="exam" />
              Prüfungen
            </span>
          </div>
        </div>
      </div>

      <section
        id="produkt"
        className="section container"
        aria-labelledby="product-title"
      >
        <div className="section-intro">
          <div>
            <p className="section-label">Das Produkt</p>
            <h2 id="product-title">
              Viele Aufgaben.
              <br />
              Ein gemeinsamer Überblick.
            </h2>
          </div>
          <p>
            Wer einen Stundenplan erstellt, plant mehr als Uhrzeiten. CampusZeit
            verbindet die Informationen, die Ihre Verwaltung dafür braucht.
          </p>
        </div>
        <ProductPreview />
        <div className="feature-list">
          {features.map((feature) => (
            <article key={feature.title}>
              <span className="feature-icon">
                <Icon name={feature.icon} />
              </span>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        id="ablauf"
        className="workflow"
        aria-labelledby="workflow-title"
      >
        <div className="container">
          <div className="workflow-intro">
            <p className="section-label">Der Ablauf</p>
            <h2 id="workflow-title">
              Von guten Grundlagen
              <br />
              zu einem guten Plan.
            </h2>
            <p>
              Die Verwaltung behält die Entscheidung. CampusZeit unterstützt
              beim Vorbereiten, Prüfen und Veröffentlichen.
            </p>
          </div>
          <ol className="workflow-steps">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="step-number" aria-hidden="true">
                  0{index + 1}
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="workflow-note">
            <Icon name="check" />
            <p>
              Automatische Planung liefert einen Vorschlag. Übernahme und
              Veröffentlichung sind separate Schritte.
            </p>
          </div>
        </div>
      </section>

      <section
        id="zielgruppen"
        className="section container"
        aria-labelledby="audience-title"
      >
        <div className="section-intro">
          <div>
            <p className="section-label">Für Ihre Einrichtung</p>
            <h2 id="audience-title">
              Andere Anforderungen.
              <br />
              Dieselbe Sorgfalt.
            </h2>
          </div>
          <p>
            Hochschulen planen in Modulen und Semestern. Schulen organisieren
            Klassen und Unterricht. CampusZeit bietet Grundlagen für beide
            Abläufe.
          </p>
        </div>
        <div className="audience-grid">
          <article>
            <Icon name="book" />
            <h3>Für Hochschulen</h3>
            <p>
              Studienstrukturen nachvollziehbar aufbauen und Jahrgänge durch
              ihre Semester begleiten.
            </p>
            <ul>
              <li>Lehrplanversionen, Module und Credit Points</li>
              <li>Wahlpflichtkurse und gemeinsame Veranstaltungen</li>
              <li>Semesterbelastung und Modulvoraussetzungen</li>
              <li>Prüfungsanforderungen, Klausuren und Abgaben</li>
            </ul>
          </article>
          <article>
            <Icon name="people" />
            <h3>Für Schulen</h3>
            <p>
              Klassen, Lehrende und Räume zusammenbringen und Unterricht für den
              gewählten Zeitraum planen.
            </p>
            <ul>
              <li>Bildungsgänge, Jahrgänge und Klassen</li>
              <li>Unterrichtsumfang und Lehrendenteams</li>
              <li>Verfügbarkeiten, freie Tage und Raumbelegung</li>
              <li>Freigegebene Pläne für Gruppen und Anzeigen</li>
            </ul>
          </article>
        </div>
      </section>

      <section
        className="assistant-section container"
        aria-labelledby="assistant-title"
      >
        <div className="assistant-copy">
          <p className="section-label">Freddy / CampusAI</p>
          <h2 id="assistant-title">
            Eine Hilfe, die weiß,
            <br />
            wo Sie gerade sind.
          </h2>
          <p>
            Freddy erklärt Funktionen, zeigt Hinweise zur aktuellen Planung und
            führt Sie zur passenden Ansicht. Auf Wunsch öffnet er ein
            vorbereitetes Formular. Sie prüfen und speichern selbst.
          </p>
          <p className="assistant-limits">
            In der Browser-Demo gibt es Schnellhilfe. Im Backend kann optional
            ein lokales Sprachmodell Antworten formulieren. Diese Antworten
            können Fehler enthalten.
          </p>
          <a href="#fragen" className="text-link">
            Mehr über Freddy
            <Icon name="chevron" />
          </a>
        </div>
        <div className="assistant-example">
          <div className="assistant-identity">
            <Freddy />
            <div>
              <strong>Hallo, ich bin Freddy.</strong>
              <span>Ihr Assistent in CampusZeit</span>
            </div>
          </div>
          <div className="sample-question">
            Wie lege ich einen neuen Raum an?
          </div>
          <div className="sample-answer">
            <p>
              Öffnen Sie die Raumverwaltung und wählen Sie einen Bereich und ein
              Stockwerk. Danach können Sie den Raum mit Kapazität und
              Ausstattung anlegen.
            </p>
            <span>
              <Icon name="room" />
              Passende Ansicht: Räume
            </span>
          </div>
          <p className="example-caption">
            Beispiel einer Bedienhilfe, kein Live-Chat.
          </p>
        </div>
      </section>

      <section
        id="kontakt"
        className="contact-section"
        aria-labelledby="contact-title"
      >
        <div className="container contact-grid">
          <div>
            <p className="section-label">Individuelles Angebot</p>
            <h2 id="contact-title">
              Passt CampusZeit
              <br />
              zu Ihrer Einrichtung?
            </h2>
            <p>
              Probieren Sie die Oberfläche aus. Für einen Pilotbetrieb werden
              Ihre Abläufe, Daten und die Betriebsumgebung gemeinsam geprüft.
              Ein Angebot richtet sich nach Ihrer Einrichtung; feste Preise sind
              noch nicht veröffentlicht.
            </p>
          </div>
          <div className="contact-panel">
            <h3>Der erste Schritt: kennenlernen.</h3>
            <p>
              Die Demo zeigt Ihnen, wie sich die Arbeit mit CampusZeit anfühlt.
            </p>
            <DemoLink config={config} />
            <div className="contact-divider" />
            {config.contactEmail ? (
              <>
                <h3>Demo anfragen</h3>
                <p>
                  Beschreiben Sie kurz Ihre Einrichtung und Ihren
                  Planungsbedarf.
                </p>
                <a
                  className="text-link"
                  href={`mailto:${config.contactEmail}?subject=${encodeURIComponent("CampusZeit – Demo und individuelles Angebot")}`}
                >
                  <Icon name="mail" />
                  {config.contactEmail}
                </a>
                <p className="small-print">
                  Öffnet Ihr E-Mail-Programm. Die Anfrage wird erst versendet,
                  wenn Sie die E-Mail dort abschicken.
                </p>
              </>
            ) : (
              <>
                <h3>Persönlich sprechen</h3>
                <p className="pending-contact">
                  Der persönliche Kontaktweg wird gerade eingerichtet.
                </p>
                <p className="small-print">
                  Sobald die Kontaktadresse bestätigt ist, können Sie hier eine
                  Demo oder ein individuelles Angebot anfragen.
                </p>
              </>
            )}
            <p className="small-print demo-limit">
              Die Online-Demo ist auf Testdaten und Browser-Speicherung
              beschränkt. Automatische Planung benötigt das Backend.
            </p>
          </div>
        </div>
      </section>

      <section
        id="fragen"
        className="section container faq-section"
        aria-labelledby="faq-title"
      >
        <div className="faq-intro">
          <p className="section-label">Häufige Fragen</p>
          <h2 id="faq-title">
            Gut zu wissen,
            <br />
            bevor Sie planen.
          </h2>
          <p>Was heute funktioniert und wo die Grenzen liegen.</p>
        </div>
        <div className="faq-list">
          {faq.map((item) => (
            <details key={item.question}>
              <summary>
                {item.question}
                <span className="faq-plus" aria-hidden="true" />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

function LegalPage({
  privacy,
  config,
}: {
  privacy: boolean;
  config: SiteConfig;
}) {
  const sections: { heading: string; paragraphs: string[] }[] = privacy
    ? legal.privacy
    : legal.imprint;
  return (
    <article className="legal-page container">
      <a className="text-link back-link" href="/">
        Zur Startseite
      </a>
      <h1>{privacy ? "Datenschutz" : "Impressum"}</h1>
      {!config.legalReady ? (
        <>
          <div className="legal-notice">
            <Icon name="clock" />
            <div>
              <strong>Noch nicht zur Veröffentlichung freigegeben.</strong>
              <p>
                Dieser Entwurf enthält Platzhalter in eckigen Klammern. Sie
                müssen durch bestätigte Angaben ersetzt werden. Nicht
                einschlägige Abschnitte sind vor der Freigabe zu entfernen.
              </p>
            </div>
          </div>
        </>
      ) : null}
      {sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </section>
      ))}
    </article>
  );
}

export default function App({
  path = "/",
  config,
}: {
  path?: string;
  config: SiteConfig;
}) {
  const page = pageForPath(path);
  return (
    <>
      <a className="skip-link" href="#main">
        Zum Inhalt
      </a>
      <Header config={config} home={page === "home"} />
      <main id="main">
        {page === "home" ? (
          <Home config={config} />
        ) : page === "imprint" || page === "privacy" ? (
          <LegalPage privacy={page === "privacy"} config={config} />
        ) : (
          <section className="notfound container">
            <span className="notfound-code">404</span>
            <h1>Hier geht es nicht weiter.</h1>
            <p>
              Diese Seite gibt es nicht. Auf der Startseite finden Sie Produkt,
              Demo und die wichtigsten Fragen.
            </p>
            <a href="/" className="button primary">
              Zur Startseite
              <Icon name="arrow" />
            </a>
          </section>
        )}
      </main>
      <Footer config={config} />
    </>
  );
}

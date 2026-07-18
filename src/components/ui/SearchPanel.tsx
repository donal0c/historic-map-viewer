import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { SearchResult } from "../../types";
import { searchPlaces } from "../../lib/heritage";
import {
  readRecentSearches,
  rememberSearch,
  searchLocalPlaces,
} from "../../lib/placeSearch";

interface SearchPanelProps {
  placeLabel?: string;
  onSelect: (result: SearchResult) => void;
  onSearchStart?: () => void;
  onExplore?: () => void;
}

type SearchStatus = "idle" | "suggesting" | "searching" | "empty" | "error";

export default function SearchPanel({
  placeLabel,
  onSelect,
  onSearchStart,
  onExplore,
}: SearchPanelProps) {
  const [query, setQuery] = useState(placeLabel ?? "");
  const [localResults, setLocalResults] = useState<SearchResult[]>([]);
  const [externalResults, setExternalResults] = useState<SearchResult[]>([]);
  const [recentResults, setRecentResults] = useState<SearchResult[]>(() =>
    readRecentSearches(),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const resultButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const cleanQuery = query.trim();
  const visibleResults =
    cleanQuery.length === 0 ? recentResults : [...localResults, ...externalResults];

  useEffect(() => {
    if (placeLabel) setQuery(placeLabel);
  }, [placeLabel]);

  useEffect(() => {
    setExternalResults([]);
    if (cleanQuery.length < 2) {
      setLocalResults([]);
      setStatus("idle");
      return;
    }

    let active = true;
    setStatus("suggesting");
    const timer = window.setTimeout(() => {
      void searchLocalPlaces(cleanQuery)
        .then((results) => {
          if (!active) return;
          setLocalResults(results);
          setStatus("idle");
          setMenuOpen(true);
        })
        .catch(() => {
          if (!active) return;
          setLocalResults([]);
          setStatus("error");
          setMenuOpen(true);
        });
    }, 140);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [cleanQuery]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await runExternalSearch();
  }

  async function runExternalSearch() {
    if (cleanQuery.length < 2) return;

    setStatus("searching");
    setMenuOpen(true);
    onSearchStart?.();
    try {
      const results = await searchPlaces(cleanQuery);
      setExternalResults(results);
      setStatus(results.length || localResults.length ? "idle" : "empty");
    } catch {
      setStatus(localResults.length ? "idle" : "error");
    }
  }

  function selectResult(result: SearchResult) {
    onSelect(result);
    rememberSearch(result);
    setRecentResults(readRecentSearches());
    setLocalResults([]);
    setExternalResults([]);
    setQuery(result.label);
    setMenuOpen(false);
    setStatus("idle");
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && visibleResults.length > 0) {
      event.preventDefault();
      resultButtons.current[0]?.focus();
    }
    if (event.key === "Escape") setMenuOpen(false);
  }

  return (
    <section className="search-panel">
      <div className="search-panel-heading">
        <div>
          <p className="eyebrow">Irish place-time explorer</p>
          <h1>Historic Map Viewer</h1>
        </div>
        {onExplore && (
          <button className="atlas-open-button" type="button" onClick={onExplore}>
            Open atlas
          </button>
        )}
      </div>

      <form onSubmit={submit} className="search-form" role="search">
        <input
          value={query}
          onFocus={() => setMenuOpen(true)}
          onKeyDown={handleInputKeyDown}
          onChange={(event) => {
            setQuery(event.target.value);
            setMenuOpen(true);
          }}
          placeholder="Townland, village or landmark…"
          aria-label="Search place"
          aria-autocomplete="list"
          aria-controls="place-search-results"
          aria-expanded={menuOpen && (visibleResults.length > 0 || status !== "idle")}
        />
        <button
          type="submit"
          disabled={status === "searching"}
          aria-label={
            status === "searching"
              ? "Searching beyond townlands"
              : "Search beyond townlands"
          }
        >
          <span className="search-button-wide">
            {status === "searching" ? "Searching" : "Search"}
          </span>
          <span className="search-button-compact" aria-hidden="true">
            {status === "searching" ? "…" : "Go"}
          </span>
        </button>
      </form>

      {menuOpen && (
        <div className="search-results" id="place-search-results">
          {cleanQuery.length === 0 && recentResults.length > 0 && (
            <p className="search-results-label">Recent places</p>
          )}
          {cleanQuery.length >= 2 && localResults.length > 0 && (
            <p className="search-results-label">
              Irish townlands <span>Tailte Éireann</span>
            </p>
          )}
          {visibleResults.map((result, index) => {
            const isExternal =
              index >= localResults.length && cleanQuery.length > 0;
            return (
              <button
                key={`${result.source}-${result.id}`}
                ref={(element) => {
                  resultButtons.current[index] = element;
                }}
                type="button"
                onClick={() => selectResult(result)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    resultButtons.current[index + 1]?.focus();
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    if (index === 0) {
                      event.currentTarget
                        .closest(".search-panel")
                        ?.querySelector<HTMLInputElement>("input")
                        ?.focus();
                    } else {
                      resultButtons.current[index - 1]?.focus();
                    }
                  } else if (event.key === "Escape") {
                    setMenuOpen(false);
                  }
                }}
              >
                <em>{isExternal ? "↗" : String(index + 1).padStart(2, "0")}</em>
                <strong>{result.label}</strong>
                <span>{result.detail}</span>
              </button>
            );
          })}

          {cleanQuery.length >= 2 && externalResults.length === 0 && (
            <button
              className="external-search-action"
              type="button"
              onClick={() => void runExternalSearch()}
              disabled={status === "searching"}
            >
              <em>↗</em>
              <strong>
                {status === "searching"
                  ? "Searching Ireland…"
                  : `Search Ireland for “${cleanQuery}”`}
              </strong>
              <span>Settlements, addresses and landmarks via OpenStreetMap</span>
            </button>
          )}

          {status === "suggesting" && (
            <p className="panel-note" role="status">Checking the townland index…</p>
          )}
          {status === "empty" && (
            <p className="panel-note" role="status">
              No place found. Try a nearby town, county, or alternate spelling.
            </p>
          )}
          {status === "error" && (
            <p className="panel-note" role="status">
              Place search is temporarily unavailable. The map still works normally.
            </p>
          )}
          {cleanQuery.length >= 2 && localResults.length > 0 && (
            <p className="search-attribution">
              Gazetteer data © Tailte Éireann, CC BY 4.0
            </p>
          )}
        </div>
      )}
    </section>
  );
}

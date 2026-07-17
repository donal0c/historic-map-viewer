import { type FormEvent, useEffect, useState } from "react";
import type { SearchResult } from "../../types";
import { searchPlaces } from "../../lib/heritage";

interface SearchPanelProps {
  placeLabel?: string;
  onSelect: (result: SearchResult) => void;
  onSearchStart?: () => void;
}

export default function SearchPanel({
  placeLabel,
  onSelect,
  onSearchStart,
}: SearchPanelProps) {
  const [query, setQuery] = useState(placeLabel ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showCurated, setShowCurated] = useState(false);
  const [status, setStatus] = useState<"idle" | "searching" | "empty" | "error">(
    "idle"
  );
  const visibleResults =
    results.length > 0
      ? results
      : showCurated && query.trim().length === 0
        ? CURATED_PLACES
        : [];

  useEffect(() => {
    if (placeLabel) setQuery(placeLabel);
  }, [placeLabel]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;

    setStatus("searching");
    onSearchStart?.();
    try {
      const next = await searchPlaces(query);
      setResults(next);
      setStatus(next.length ? "idle" : "empty");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="search-panel">
      <div>
        <p className="eyebrow">Irish place-time explorer</p>
        <h1>Historic Map Viewer</h1>
      </div>
      <form onSubmit={submit} className="search-form">
        <input
          value={query}
          onFocus={() => setShowCurated(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setResults([]);
          }}
          placeholder="Search a place..."
          aria-label="Search place"
        />
        <button
          type="submit"
          disabled={status === "searching"}
          aria-label={status === "searching" ? "Searching for place" : "Search for place"}
        >
          <span className="search-button-wide">
            {status === "searching" ? "Searching" : "Search"}
          </span>
          <span className="search-button-compact" aria-hidden="true">
            {status === "searching" ? "…" : "Go"}
          </span>
        </button>
      </form>
      {status === "empty" && <p className="panel-note" role="status">No Irish place match found.</p>}
      {status === "error" && (
        <p className="panel-note" role="status">Search is unavailable. Try again in a moment.</p>
      )}
      {visibleResults.length > 0 && (
        <div className="search-results">
          {showCurated && results.length === 0 && (
            <p className="search-results-label">Start exploring</p>
          )}
          {visibleResults.map((result, index) => (
            <button
              key={result.id}
              type="button"
              onClick={() => {
                onSelect(result);
                setResults([]);
                setQuery(result.label);
                setShowCurated(false);
              }}
            >
              <em>{String(index + 1).padStart(2, "0")}</em>
              <strong>{result.label}</strong>
              <span>{result.detail}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

const CURATED_PLACES: SearchResult[] = [
  {
    id: "curated-dublin",
    label: "Medieval Dublin",
    detail: "City walls, archaeology and architectural layers",
    lat: 53.3438,
    lng: -6.2675,
  },
  {
    id: "curated-glendalough",
    label: "Glendalough",
    detail: "Monastic landscape in County Wicklow",
    lat: 53.0105,
    lng: -6.3272,
  },
  {
    id: "curated-cobh",
    label: "Cobh",
    detail: "Maritime heritage and Cork Harbour",
    lat: 51.8503,
    lng: -8.2943,
  },
  {
    id: "curated-clonmacnoise",
    label: "Clonmacnoise",
    detail: "Early medieval settlement beside the Shannon",
    lat: 53.326,
    lng: -7.986,
  },
  {
    id: "curated-kilkenny",
    label: "Kilkenny",
    detail: "A dense historic town and medieval core",
    lat: 52.6541,
    lng: -7.2448,
  },
  {
    id: "curated-galway",
    label: "Galway",
    detail: "Urban archaeology at Ireland's Atlantic edge",
    lat: 53.274,
    lng: -9.049,
  },
];

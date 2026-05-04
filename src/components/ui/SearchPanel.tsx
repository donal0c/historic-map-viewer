import { type FormEvent, useState } from "react";
import type { SearchResult } from "../../types";
import { searchPlaces } from "../../lib/heritage";

interface SearchPanelProps {
  onSelect: (result: SearchResult) => void;
}

export default function SearchPanel({ onSelect }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "searching" | "empty" | "error">(
    "idle"
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;

    setStatus("searching");
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
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a place..."
          aria-label="Search place"
        />
        <button type="submit" disabled={status === "searching"}>
          {status === "searching" ? "Searching" : "Search"}
        </button>
      </form>
      {status === "empty" && <p className="panel-note">No Irish place match found.</p>}
      {status === "error" && (
        <p className="panel-note">Search is unavailable. Try again in a moment.</p>
      )}
      {results.length > 0 && (
        <div className="search-results">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              onClick={() => {
                onSelect(result);
                setResults([]);
                setQuery(result.label);
              }}
            >
              <strong>{result.label}</strong>
              <span>{result.detail}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

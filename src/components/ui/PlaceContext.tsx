import { usePlaceContext } from "../../hooks/usePlaceContext";

interface PlaceContextProps {
  center: [number, number];
  placeLabel?: string;
}

export default function PlaceContext({
  center,
  placeLabel,
}: PlaceContextProps) {
  const { context, status, load } = usePlaceContext(center, placeLabel);
  const isNamedPlace = Boolean(placeLabel);

  return (
    <section className="place-context" aria-labelledby="place-context-title">
      <div className="place-context-heading">
        <div>
          <span className="eyebrow">
            {isNamedPlace ? "About this place" : "Nearby on the map"}
          </span>
          <h3 id="place-context-title">
            {isNamedPlace ? "A wider historical context" : "Context near this point"}
          </h3>
        </div>
        {status === "idle" && (
          <button type="button" onClick={() => void load()}>
            Add context
          </button>
        )}
      </div>

      {status === "idle" && (
        <p>
          {isNamedPlace
            ? "Request a carefully matched overview from Wikipedia and Wikidata."
            : "Request the nearest confidently identified Wikipedia place within one kilometre."}
          {" "}Nothing is loaded until you ask.
        </p>
      )}
      {status === "loading" && (
        <div className="context-state" role="status">
          <span className="context-spinner" aria-hidden="true" />
          <strong>Looking for a confident place match…</strong>
        </div>
      )}
      {status === "empty" && (
        <div className="context-state">
          <strong>No confident match found</strong>
          <span>We have left this blank rather than attach uncertain context.</span>
        </div>
      )}
      {status === "error" && (
        <div className="context-state">
          <strong>Context is unavailable just now</strong>
          <button type="button" onClick={() => void load()}>Try again</button>
        </div>
      )}
      {status === "ready" && context && (
        <article className="context-article">
          {context.image && (
            <figure>
              <img
                src={context.image.url}
                alt={`Image associated with ${context.title} on Wikimedia Commons`}
                loading="lazy"
                decoding="async"
              />
              <figcaption>
                <a href={context.image.sourceUrl} target="_blank" rel="noreferrer">
                  Image
                </a>{" "}
                by {context.image.artist},{" "}
                <a href={context.image.licenceUrl} target="_blank" rel="noreferrer">
                  {context.image.licence}
                </a>
              </figcaption>
            </figure>
          )}
          <div>
            <span className="context-match">
              {context.matchedBy === "name"
                ? "Place-name match"
                : `Nearest notable page · ${formatDistance(context.distanceMeters)}`}
            </span>
            <h4>{context.title}</h4>
            <p>{context.summary}</p>
            <div className="context-links">
              <a href={context.pageUrl} target="_blank" rel="noreferrer">
                Read on Wikipedia
              </a>
              {context.wikidataUrl && (
                <a href={context.wikidataUrl} target="_blank" rel="noreferrer">
                  Wikidata
                </a>
              )}
            </div>
          </div>
        </article>
      )}

      <small className="context-disclaimer">
        Context only — not part of the mapped heritage evidence.
      </small>
    </section>
  );
}

function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1_000) return `${Math.max(10, Math.round(distanceMeters / 10) * 10)} m`;
  return `${(distanceMeters / 1_000).toFixed(1)} km`;
}

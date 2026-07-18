import type { AtlasDestination, AtlasStory } from "../../data/stories";

interface ExplorePanelProps {
  open: boolean;
  imagesReady: boolean;
  stories: AtlasStory[];
  destinations: AtlasDestination[];
  locateStatus: "idle" | "locating" | "denied" | "error";
  onClose: () => void;
  onSelectDestination: (destination: AtlasDestination) => void;
  onStartStory: (storyId: string) => void;
  onLocate: () => void;
}

export default function ExplorePanel({
  open,
  imagesReady,
  stories,
  destinations,
  locateStatus,
  onClose,
  onSelectDestination,
  onStartStory,
  onLocate,
}: ExplorePanelProps) {
  if (!open) return null;
  const leadStory = stories[0];

  return (
    <aside
      className={`explore-panel${imagesReady ? " images-ready" : ""}`}
      aria-label="Explore the atlas"
    >
      <header className="explore-header">
        <div>
          <p className="eyebrow">Six map series · 27 public sources</p>
          <h2>Choose a way into the map</h2>
          <p className="explore-intro">
            Search an Irish place, follow a story, or read the map alongside
            archaeology and architecture.
          </p>
        </div>
        <button
          className="icon-close"
          type="button"
          onClick={onClose}
          aria-label="Close atlas"
        >
          ×
        </button>
      </header>

      <div className="explore-composition">
        <button
          className="featured-story"
          type="button"
          onClick={() => onStartStory(leadStory.id)}
        >
          <img src={imagesReady ? leadStory.previewUrl : undefined} alt="" />
          <span className="featured-story-shade" />
          <span className="featured-story-copy">
            <em>{leadStory.eyebrow}</em>
            <strong>{leadStory.title}</strong>
            <span>{leadStory.summary}</span>
            <b>Begin story <i aria-hidden="true">→</i></b>
          </span>
          <span className="featured-story-number">{leadStory.number}</span>
        </button>

        <div className="story-index">
          <p className="explore-section-label">Guided stories</p>
          {stories.slice(1).map((story) => (
            <button
              key={story.id}
              type="button"
              onClick={() => onStartStory(story.id)}
            >
              <em>{story.number}</em>
              <span>
                <strong>{story.title}</strong>
                <small>{story.place} · {story.steps.length} stops</small>
              </span>
              <i aria-hidden="true">→</i>
            </button>
          ))}
          <button
            className="near-me-action"
            type="button"
            onClick={onLocate}
            disabled={locateStatus === "locating"}
          >
            <em aria-hidden="true">◎</em>
            <span>
              <strong>
                {locateStatus === "locating" ? "Finding you…" : "Explore near me"}
              </strong>
              <small>Your location stays in this browser</small>
            </span>
          </button>
          {locateStatus === "denied" && (
            <p className="location-note" role="status">
              Location was not shared. Choose a place below instead.
            </p>
          )}
          {locateStatus === "error" && (
            <p className="location-note" role="status">
              Your location could not be read. The rest of the atlas is available.
            </p>
          )}
        </div>
      </div>

      <div className="destination-strip">
        <p className="explore-section-label">Places to open</p>
        <div>
          {destinations.map((destination) => (
            <button
              key={destination.id}
              type="button"
              onClick={() => onSelectDestination(destination)}
            >
              <img
                src={imagesReady ? destination.previewUrl : undefined}
                alt=""
                loading="lazy"
              />
              <span>
                <em>{destination.period}</em>
                <strong>{destination.label}</strong>
              </span>
            </button>
          ))}
        </div>
      </div>

      <footer>
        Historical map crops courtesy of the National Library of Scotland.
        Stories separate editorial guidance from linked public evidence.
      </footer>
    </aside>
  );
}

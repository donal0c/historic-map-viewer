import { useEffect } from "react";
import type { AtlasStory } from "../../data/stories";

interface StoryPlayerProps {
  story: AtlasStory;
  stepIndex: number;
  onStepChange: (stepIndex: number) => void;
  onExit: () => void;
  onShare: () => void;
}

export default function StoryPlayer({
  story,
  stepIndex,
  onStepChange,
  onExit,
  onShare,
}: StoryPlayerProps) {
  const step = story.steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === story.steps.length - 1;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select")) return;
      if (event.key === "ArrowLeft" && !isFirst) onStepChange(stepIndex - 1);
      if (event.key === "ArrowRight" && !isLast) onStepChange(stepIndex + 1);
      if (event.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFirst, isLast, onExit, onStepChange, stepIndex]);

  return (
    <aside className="story-player" aria-label={`Story: ${story.title}`}>
      <div className="story-progress" aria-hidden="true">
        {story.steps.map((candidate, index) => (
          <span
            key={candidate.id}
            className={index <= stepIndex ? "active" : ""}
          />
        ))}
      </div>
      <header>
        <div>
          <p className="eyebrow">
            Story {story.number} · {stepIndex + 1} of {story.steps.length}
          </p>
          <strong>{story.title}</strong>
        </div>
        <div className="story-header-actions">
          <button type="button" onClick={onShare}>Share</button>
          <button type="button" onClick={onExit} aria-label="Exit story">×</button>
        </div>
      </header>

      <div className="story-copy" key={step.id} aria-live="polite">
        <h2>{step.title}</h2>
        <p>{step.caption}</p>
        <small>{step.sourceNote}</small>
      </div>

      <nav aria-label="Story steps">
        <button
          type="button"
          onClick={() => onStepChange(stepIndex - 1)}
          disabled={isFirst}
        >
          ← Previous
        </button>
        {isLast ? (
          <button className="story-primary-action" type="button" onClick={onExit}>
            Explore freely
          </button>
        ) : (
          <button
            className="story-primary-action"
            type="button"
            onClick={() => onStepChange(stepIndex + 1)}
          >
            Next stop →
          </button>
        )}
      </nav>
    </aside>
  );
}

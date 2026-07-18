import { useEffect, useRef, useState } from "react";
import type { ShareDescriptor } from "../../lib/share";

interface ShareSheetProps {
  open: boolean;
  descriptor: ShareDescriptor;
  onClose: () => void;
}

export default function ShareSheet({
  open,
  descriptor,
  onClose,
}: ShareSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!open) return;
    setStatus("");
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const backdrop = dialog?.parentElement;
    const background = backdrop?.parentElement
      ? [...backdrop.parentElement.children].filter(
          (element): element is HTMLElement =>
            element instanceof HTMLElement && element !== backdrop,
        )
      : [];
    background.forEach((element) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    dialog?.querySelector<HTMLElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>("button, a[href]")];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      background.forEach((element) => {
        element.inert = false;
        element.removeAttribute("aria-hidden");
      });
      previousFocus?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(descriptor.shareUrl);
      setStatus("Designed link copied");
    } catch {
      setStatus("Copy was blocked — open the card and copy its address.");
    }
  }

  async function nativeShare() {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({
        title: descriptor.title,
        text: descriptor.description,
        url: descriptor.shareUrl,
      });
      setStatus("Shared");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setStatus("Sharing was unavailable");
      }
    }
  }

  return (
    <div className="share-backdrop" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="share-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">Designed to travel</p>
            <h2 id="share-sheet-title">Share this view</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close sharing">
            ×
          </button>
        </header>

        <div className="share-card-preview" data-has-visual={Boolean(descriptor.visual)}>
          <div className="share-card-map" aria-hidden="true">
            <span />
            <i />
          </div>
          <div className="share-card-copy">
            <p>{descriptor.eyebrow}</p>
            <h3>{descriptor.title}</h3>
            <dl>
              <div><dt>Survey</dt><dd>{descriptor.layer}</dd></div>
              <div><dt>Compare</dt><dd>{descriptor.mode}</dd></div>
            </dl>
            <footer>
              <strong>Historic Map Viewer</strong>
              <span>IRELAND · 1829—1942</span>
            </footer>
          </div>
          <img
            className="share-card-rendered"
            src={descriptor.imageUrl}
            alt={`Generated share card preview for ${descriptor.title}`}
            decoding="async"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        </div>

        <p className="share-note">
          The link preserves this place, survey, comparison mode, and enabled
          evidence layers. Its preview is rendered without loading the live map.
        </p>
        <div className="share-actions">
          <button type="button" className="share-primary" onClick={() => void copyLink()}>
            Copy designed link
          </button>
          <button type="button" onClick={() => void nativeShare()}>
            Share…
          </button>
          <a href={descriptor.imageUrl} target="_blank" rel="noreferrer">
            Open card
          </a>
        </div>
        <div className="share-status" role="status" aria-live="polite">
          {status}
        </div>
      </div>
    </div>
  );
}

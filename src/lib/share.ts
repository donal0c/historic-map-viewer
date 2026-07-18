import { viewModes } from "../config/modes";
import { findLayer, historicalLayers } from "../config/layers";
import type { AtlasStory } from "../data/stories";
import type { HeritageLayerId, MapState } from "../types";
import { encodeHash } from "./hash";

export interface ShareDescriptor {
  eyebrow: string;
  title: string;
  place: string;
  layer: string;
  mode: string;
  description: string;
  target: string;
  shareUrl: string;
  imageUrl: string;
  visual?: string;
}

export function buildShareDescriptor({
  state,
  enabledSources,
  story,
  stepIndex,
  origin,
  pathname,
}: {
  state: MapState;
  enabledSources: HeritageLayerId[];
  story?: AtlasStory;
  stepIndex?: number;
  origin: string;
  pathname: string;
}): ShareDescriptor {
  const layer =
    findLayer(state.activeLayerId, historicalLayers)?.name ?? "Historical map";
  const mode =
    viewModes.find((candidate) => candidate.id === state.mode)?.label ??
    "Comparison";
  const place =
    story?.place ??
    state.placeLabel ??
    `${state.center[0].toFixed(3)}, ${state.center[1].toFixed(3)}`;
  const title = story?.title ?? `Explore ${place} through time`;
  const eyebrow = story
    ? `Atlas story ${story.number} · Step ${(stepIndex ?? 0) + 1}`
    : "A shared view from the Irish historical atlas";
  const description = story?.summary
    ?? `${place} shown with ${layer} in ${mode.toLocaleLowerCase("en")} mode.`;
  const search = story
    ? `?story=${encodeURIComponent(story.id)}&step=${(stepIndex ?? 0) + 1}`
    : "";
  const target = `${pathname}${search}${encodeHash(state, enabledSources)}`;
  const query = new URLSearchParams({
    title,
    place,
    layer,
    mode,
    eyebrow,
    description,
    target,
  });
  if (story) query.set("visual", story.id);
  const shareUrl = `${origin}/share?${encodeQuery(query)}`;
  const imageQuery = new URLSearchParams(query);
  imageQuery.delete("target");
  return {
    eyebrow,
    title,
    place,
    layer,
    mode,
    description,
    target,
    shareUrl,
    imageUrl: `${origin}/api/og?${encodeQuery(imageQuery)}`,
    visual: story?.id,
  };
}

function encodeQuery(query: URLSearchParams): string {
  return query.toString().replace(/\+/g, "%20");
}

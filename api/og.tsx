import { ImageResponse } from "@vercel/og";
import React from "react";
import { atlasStories } from "../src/data/stories.js";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const title = param(url, "title", "Explore Ireland through time", 100);
  const eyebrow = param(
    url,
    "eyebrow",
    "A shared view from the Irish historical atlas",
    100,
  );
  const layer = param(url, "layer", "Historical survey", 90);
  const mode = param(url, "mode", "Overlay", 30);
  const visual = url.searchParams.get("visual");
  const story = atlasStories.find((candidate) => candidate.id === visual);
  const storyImage = story ? await imageDataUrl(story.previewUrl) : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          color: "#1c211c",
          background: "#f4efe3",
        }}
      >
        <div
          style={{
            width: 470,
            height: "100%",
            display: "flex",
            position: "relative",
            overflow: "hidden",
            borderRight: "2px solid rgba(43,47,38,.2)",
            background: "#d5cfbe",
          }}
        >
          {storyImage ? (
            <img
              src={storyImage}
              width={470}
              height={630}
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                background:
                  "radial-gradient(circle at 68% 35%, transparent 0 84px, rgba(166,77,50,.55) 85px 88px, transparent 89px), repeating-linear-gradient(25deg, transparent 0 38px, rgba(40,70,56,.16) 39px 41px), linear-gradient(135deg,#e8e0cc,#b9c1ad)",
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              inset: 28,
              display: "flex",
              border: "1px solid rgba(28,33,28,.42)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 48,
              bottom: 44,
              display: "flex",
              padding: "8px 12px",
              color: "#f8f2e4",
              background: "#1c211c",
              fontSize: 15,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            {story ? "Historical map crop · NLS" : "Cartographic study"}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "52px 62px 46px" }}>
          <div style={{ display: "flex", color: "#1e715e", fontSize: 16, fontWeight: 700, letterSpacing: 3.5, textTransform: "uppercase" }}>
            {eyebrow}
          </div>
          <div style={{ display: "flex", width: 84, height: 5, marginTop: 25, background: "#a64d32" }} />
          <div style={{ display: "flex", marginTop: 34, fontFamily: "serif", fontSize: title.length > 54 ? 50 : 62, lineHeight: 1.02, letterSpacing: -2.2 }}>
            {title}
          </div>
          <div style={{ display: "flex", gap: 42, marginTop: "auto", paddingTop: 28, borderTop: "1px solid rgba(43,47,38,.2)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span style={{ color: "#797b70", fontSize: 13, letterSpacing: 2.5, textTransform: "uppercase" }}>Survey</span>
              <strong style={{ fontSize: 19, fontWeight: 600 }}>{layer}</strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span style={{ color: "#797b70", fontSize: 13, letterSpacing: 2.5, textTransform: "uppercase" }}>Compare</span>
              <strong style={{ fontSize: 19, fontWeight: 600 }}>{mode}</strong>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 35 }}>
            <strong style={{ fontFamily: "serif", fontSize: 23 }}>Historic Map Viewer</strong>
            <span style={{ color: "#74786d", fontSize: 13, letterSpacing: 2.5 }}>IRELAND · 1829—1942</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}

function param(url: URL, key: string, fallback: string, max: number) {
  return (
    url.searchParams.get(key)?.replace(/\+/g, " ").trim() || fallback
  ).slice(0, max);
}

async function imageDataUrl(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    if (!response.ok) return undefined;
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:${response.headers.get("content-type") ?? "image/png"};base64,${btoa(binary)}`;
  } catch (error) {
    console.error("Share-card map crop unavailable", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return undefined;
  }
}

/// <reference lib="webworker" />

import { clearBlackNodataPixels } from "./nodataPixels";

interface NodataWorkerRequest {
  id: number;
  bitmap: ImageBitmap;
  size: number;
}

interface NodataWorkerResponse {
  id: number;
  blob?: Blob;
  error?: string;
}

self.onmessage = async (event: MessageEvent<NodataWorkerRequest>) => {
  const { id, bitmap, size } = event.data;

  try {
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas processing is unavailable");

    context.drawImage(bitmap, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size);
    clearBlackNodataPixels(pixels.data);
    context.putImageData(pixels, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const response: NodataWorkerResponse = { id, blob };
    self.postMessage(response);
  } catch (error) {
    const response: NodataWorkerResponse = {
      id,
      error: error instanceof Error ? error.message : "Image processing failed",
    };
    self.postMessage(response);
  } finally {
    bitmap.close();
  }
};

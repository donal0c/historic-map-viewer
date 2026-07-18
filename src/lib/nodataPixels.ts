export function clearBlackNodataPixels(pixels: Uint8ClampedArray) {
  for (let index = 0; index < pixels.length; index += 4) {
    if (
      pixels[index] === 0 &&
      pixels[index + 1] === 0 &&
      pixels[index + 2] === 0
    ) {
      pixels[index + 3] = 0;
    }
  }
}

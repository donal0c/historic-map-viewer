import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const JS_GZIP_BUDGET_BYTES = 180 * 1024;
const assetsDirectory = join(process.cwd(), "dist", "assets");
const files = await readdir(assetsDirectory);
const javascriptFiles = files.filter((file) => file.endsWith(".js"));

if (javascriptFiles.length === 0) {
  throw new Error("Bundle budget could not find a built JavaScript asset.");
}

const assets = await Promise.all(
  javascriptFiles.map(async (file) => {
    const bytes = await readFile(join(assetsDirectory, file));
    return {
      file,
      rawBytes: bytes.byteLength,
      gzipBytes: gzipSync(bytes).byteLength,
    };
  }),
);
const totalGzipBytes = assets.reduce((total, asset) => total + asset.gzipBytes, 0);
const result = {
  budgetBytes: JS_GZIP_BUDGET_BYTES,
  totalGzipBytes,
  headroomBytes: JS_GZIP_BUDGET_BYTES - totalGzipBytes,
  assets,
};

console.log(JSON.stringify(result, null, 2));
if (totalGzipBytes > JS_GZIP_BUDGET_BYTES) {
  throw new Error(
    `Initial JavaScript is ${Math.ceil(totalGzipBytes / 1024)} KB gzip; budget is 180 KB.`,
  );
}

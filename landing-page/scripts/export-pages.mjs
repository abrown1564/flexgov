/**
 * Refresh the checked-in GitHub Pages artifact from vinext's static client.
 *
 * GitHub Pages serves ../docs, while ordinary development builds write to
 * dist/client. Keeping this explicit prevents a successful Pages deployment
 * from silently serving stale source. The separately generated Markdown viewer
 * under docs/review is preserved until its source is consolidated here.
 */

import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const landingDirectory = resolve(scriptDirectory, "..");
const exportDirectory = join(landingDirectory, "dist", "client");
const pagesDirectory = resolve(landingDirectory, "..", "docs");
const preservedEntries = new Set(["review"]);

await mkdir(pagesDirectory, { recursive: true });

// Refuse to touch the deployed artifact when prerendering did not produce the
// required entry point. This guard prevents an asset-only build from deleting a
// previously working Pages site.
const exportEntries = await readdir(exportDirectory);
if (!exportEntries.includes("index.html")) {
  throw new Error(
    `Static export is incomplete: ${exportDirectory}/index.html is missing.`,
  );
}

// Remove only generated Pages-root entries. The explicit preserve set prevents
// this landing-page export from deleting the independent whitepaper viewer.
for (const entry of await readdir(pagesDirectory)) {
  if (!preservedEntries.has(entry)) {
    await rm(join(pagesDirectory, entry), { recursive: true, force: true });
  }
}

for (const entry of exportEntries) {
  await cp(join(exportDirectory, entry), join(pagesDirectory, entry), {
    recursive: true,
  });
}

// Pages must serve underscore-prefixed vinext assets without Jekyll filtering.
await writeFile(join(pagesDirectory, ".nojekyll"), "");

console.log(
  `GitHub Pages artifact refreshed from ${exportDirectory}; preserved docs/review.`,
);

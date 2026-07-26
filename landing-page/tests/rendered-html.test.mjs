import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the FlexGov public shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>FlexGov — Governance Observability<\/title>/i);
  assert.match(html, /See who really/);
  assert.match(html, /Governance observability/);
  assert.match(html, /Whitepaper/);
});

test("includes the pinned Compound Graph entry without a browser-side key", async () => {
  const html = await (await render()).text();

  assert.match(html, />Compound<\/button>/);
  assert.match(html, /The Graph/);
  assert.doesNotMatch(html, /THE_GRAPH_API_KEY|gateway\.thegraph\.com\/api\//);
});

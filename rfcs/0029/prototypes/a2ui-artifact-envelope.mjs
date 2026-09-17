import assert from "node:assert/strict";

const A2UI_V08_CORE_V1_URI = "openclaw-renderer://a2ui/v0.8/core-v1";
const ACTION_KEYS = new Set([
  "beginRendering",
  "surfaceUpdate",
  "dataModelUpdate",
  "deleteSurface",
  "createSurface",
]);
const MAX_MESSAGES = 32;
const MAX_BYTES = 64 * 1024;

function selectView(artifact, capability) {
  return (
    artifact.views.find(
      (view) =>
        view.templateUri === capability.templateUri &&
        view.dataVersion === capability.dataVersion,
    ) ?? null
  );
}

function validateA2uiMessages(messages) {
  assert.ok(
    Array.isArray(messages) && messages.length > 0 && messages.length <= MAX_MESSAGES,
    "A2UI message count is outside the accepted bounds",
  );
  assert.ok(
    Buffer.byteLength(JSON.stringify(messages), "utf8") <= MAX_BYTES,
    "A2UI messages exceed the accepted byte budget",
  );
  for (const message of messages) {
    assert.ok(message && typeof message === "object" && !Array.isArray(message));
    const keys = Object.keys(message).filter((key) => ACTION_KEYS.has(key));
    assert.equal(keys.length, 1);
    assert.equal(message.version, undefined, "A2UI v0.8 messages are unversioned");
    assert.notEqual(keys[0], "createSurface", "createSurface requires unsupported A2UI v0.9");
  }
}

function fallbackFor(artifact, capability) {
  const declared = artifact.views.flatMap((view) => (view.fallback ? [view.fallback] : []));
  const accepted = declared.find((fallback) =>
    capability.sandboxFallbacks?.includes(fallback.kind),
  );
  return accepted
    ? { kind: accepted.kind, fallback: accepted }
    : { kind: "structured", data: artifact.structuredContent };
}

function renderArtifact(artifact, capability) {
  const view = selectView(artifact, capability);
  if (!view) {
    return fallbackFor(artifact, capability);
  }
  try {
    validateA2uiMessages(view.data.messages);
  } catch (error) {
    return {
      ...fallbackFor(artifact, capability),
      reason: error instanceof Error ? error.message : String(error),
    };
  }
  return { kind: "a2ui", messages: view.data.messages };
}

const artifact = {
  version: 1,
  id: "artifact-summary-1",
  revision: 0,
  structuredContent: { title: "Deployment status", status: "Ready" },
  views: [
    {
      id: "a2ui",
      templateUri: A2UI_V08_CORE_V1_URI,
      dataVersion: 1,
      availability: "inline",
      fallback: {
        kind: "mcp-app",
        viewId: "mcp-app-summary-1",
        uiResourceUri: "ui://example/summary",
      },
      data: {
        messages: [
          {
            surfaceUpdate: {
              surfaceId: "main",
              components: [
                {
                  id: "root",
                  component: {
                    Column: { children: { explicitList: ["title", "status"] } },
                  },
                },
                {
                  id: "title",
                  component: {
                    Text: { text: { literalString: "Deployment status" } },
                  },
                },
                {
                  id: "status",
                  component: { Text: { text: { literalString: "Ready" } } },
                },
              ],
            },
          },
          { beginRendering: { surfaceId: "main", root: "root" } },
        ],
      },
    },
  ],
  state: "ready",
  source: { sessionKey: "session-1", toolCallId: "tool-1" },
};

const supported = renderArtifact(artifact, {
  templateUri: A2UI_V08_CORE_V1_URI,
  dataVersion: 1,
});
assert.equal(supported.kind, "a2ui");
assert.equal(supported.messages[0].surfaceUpdate.components.length, 3);

const sandboxFallback = renderArtifact(artifact, {
  templateUri: "openclaw-renderer://a2ui/v0.9/core-v1",
  dataVersion: 1,
  sandboxFallbacks: ["mcp-app"],
});
assert.equal(sandboxFallback.kind, "mcp-app");
assert.equal(sandboxFallback.fallback.uiResourceUri, "ui://example/summary");

const structuredFallback = renderArtifact(artifact, {
  templateUri: "openclaw-renderer://a2ui/v0.9/core-v1",
  dataVersion: 1,
  sandboxFallbacks: [],
});
assert.deepEqual(structuredFallback, {
  kind: "structured",
  data: artifact.structuredContent,
});

const wrongDataVersion = renderArtifact(artifact, {
  templateUri: A2UI_V08_CORE_V1_URI,
  dataVersion: 2,
  sandboxFallbacks: [],
});
assert.equal(wrongDataVersion.kind, "structured");

const invalidDialectArtifact = structuredClone(artifact);
invalidDialectArtifact.views[0].data.messages[0].version = "v0.9";
const invalidDialect = renderArtifact(invalidDialectArtifact, {
  templateUri: A2UI_V08_CORE_V1_URI,
  dataVersion: 1,
  sandboxFallbacks: [],
});
assert.equal(invalidDialect.kind, "structured");
assert.match(invalidDialect.reason, /unversioned/);

console.log("PASS supported A2UI v0.8 composition selected");
console.log("PASS unsupported dialect used explicit MCP App fallback");
console.log("PASS unsupported catalog/data version used structured fallback");
console.log("PASS invalid A2UI version failed closed to structured fallback");

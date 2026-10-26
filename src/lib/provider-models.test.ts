import assert from "node:assert/strict";
import { test } from "node:test";
import { anthropicIds, familyOf, googleIds, openaiIds, similarIds } from "./provider-models";

test("lê a lista de cada provedor no formato da respectiva API", () => {
  assert.deepEqual(
    anthropicIds({ data: [{ type: "model", id: "claude-sonnet-5-5" }, { id: "claude-opus-5-5" }], has_more: false }),
    ["claude-sonnet-5-5", "claude-opus-5-5"],
  );
  assert.deepEqual(openaiIds({ object: "list", data: [{ id: "gpt-6.1-sol", object: "model" }] }), ["gpt-6.1-sol"]);
  assert.deepEqual(
    googleIds({ models: [{ name: "models/gemini-3.8-flash" }, { name: "models/gemini-3.6-flash" }], nextPageToken: "x" }),
    ["gemini-3.8-flash", "gemini-3.6-flash"],
  );
});

test("respostas vazias, de erro ou malformadas viram lista vazia (nunca estouram)", () => {
  for (const bad of [null, undefined, {}, { error: { message: "invalid key" } }, { data: "x" }, { data: [null, {}, { id: 3 }] }, "texto"]) {
    assert.deepEqual(anthropicIds(bad), []);
    assert.deepEqual(openaiIds(bad), []);
    assert.deepEqual(googleIds(bad), []);
  }
});

test("sugestão de parecidos quando o ID não existe", () => {
  assert.equal(familyOf("claude-sonnet-5-5"), "claude-sonnet");
  const all = ["claude-sonnet-5", "claude-sonnet-5-5", "claude-opus-5-5", "gemini-3.8-flash"];
  assert.deepEqual(similarIds(all, "claude-sonnet-9"), ["claude-sonnet-5", "claude-sonnet-5-5"]);
  assert.deepEqual(similarIds(all, "gpt-6.1-sol"), []);
});

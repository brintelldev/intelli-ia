import { test } from "node:test";
import assert from "node:assert/strict";
import { cacheKey } from "./cache";

test("cacheKey: determinística, hex de 64 caracteres, sensível à ordem e à fronteira entre partes", () => {
  assert.equal(cacheKey(["a", "b"]), cacheKey(["a", "b"]));
  assert.match(cacheKey(["a"]), /^[0-9a-f]{64}$/);
  assert.notEqual(cacheKey(["a", "b"]), cacheKey(["b", "a"]));
  assert.notEqual(cacheKey(["a", "bc"]), cacheKey(["ab", "c"]));
  assert.notEqual(cacheKey(["a", ""]), cacheKey(["a"]));
});

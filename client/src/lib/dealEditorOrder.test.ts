import assert from "node:assert/strict";
import { test } from "node:test";
import { moveDealIndex, moveDealState } from "./dealEditorOrder";

test("all card-associated editor state follows moves in both directions", () => {
  assert.deepEqual([0, 1, 2, 3].map(i => moveDealIndex(i, 0, 2)), [2, 0, 1, 3]);
  assert.deepEqual([0, 1, 2, 3].map(i => moveDealIndex(i, 2, 0)), [1, 2, 0, 3]);
  const errors = { 0: ["Alpha"], 2: ["Charlie"] };
  assert.deepEqual(moveDealState(errors, 0, 2), { 1: ["Charlie"], 2: ["Alpha"] });
  assert.deepEqual(moveDealState(moveDealState(errors, 0, 2), 2, 0), errors);
});

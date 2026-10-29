import assert from "node:assert/strict";
import test from "node:test";
import { mapDealBranchSelections } from "./dealBranchSelection";

const branches = [
  { id: "stable-a", name: "Al Sadd" },
  { id: "stable-b", name: "West Bay" },
];
const error = "Choose a branch";

test("selected IDs become current branch names without dropping deal fields", () => {
  const deals = [
    { title: "First", branches: ["stable-b"], price: "30" },
    { title: "Second", branches: ["stable-b", "stable-a", "stable-b"], price: "20" },
  ];
  const mapped = mapDealBranchSelections(deals, branches, error);
  assert.deepEqual(mapped, [
    { title: "First", branches: ["West Bay"], price: "30" },
    { title: "Second", branches: ["Al Sadd", "West Bay"], price: "20" },
  ]);
  assert.deepEqual(deals[0].branches, ["stable-b"], "Original draft remains unchanged");
  assert.deepEqual(mapDealBranchSelections(deals, [{ ...branches[0], name: "Renamed" }, branches[1]], error)[1].branches,
    ["Renamed", "West Bay"], "Latest branch name is used at submission");
});

test("a single branch is assigned automatically, even with no explicit selection", () => {
  assert.deepEqual(mapDealBranchSelections([{ branches: [], title: "One" }], [branches[0]], error),
    [{ branches: ["Al Sadd"], title: "One" }]);
});

test("multiple branches require a real selection; removed or unknown IDs are rejected", () => {
  assert.throws(() => mapDealBranchSelections([{ branches: [], title: "None" }], branches, error), /Choose a branch/);
  assert.throws(() => mapDealBranchSelections([{ branches: ["removed"], title: "Old" }], branches, error), /Choose a branch/);
  assert.throws(() => mapDealBranchSelections([{ branches: ["stable-b", "removed"] }], branches, error), /Choose a branch/);
});

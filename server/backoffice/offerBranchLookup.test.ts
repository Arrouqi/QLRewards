import assert from "node:assert/strict";
import test from "node:test";
import { createOfferOptionsLoader } from "./offerOptions";
import { offerOptionIssues } from "./offerDetails";
import { syntheticOfferDetails, syntheticOfferOptions } from "./offerTestHelpers";

const tokenProvider = { getToken: async () => "synthetic", invalidate: () => {} };
const filters = () => {
  const { merchantProfileId, branches, branchIssue, ...body } = syntheticOfferOptions();
  return body;
};
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

test("a profile-local City Center branch is reported as pending, never accepted as an offer branch", async () => {
  const loader = createOfferOptionsLoader(tokenProvider, async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === "/filters") return Response.json(filters());
    if (path === "/admin/merchant-profiles/1001") return Response.json({
      merchantProfileId: 1001, agencyId: 2001,
      branches: [{ id: 401, merchantBranchId: null, name: "City Center" }],
    });
    assert.equal(path, "/admin/2001/branches");
    return Response.json([]);
  });
  const result = await loader("1001");
  assert.deepEqual(result.branches, []);
  assert.match(result.branchIssue!, /City Center exists.*no usable offer-branch ID/);
  assert.ok(offerOptionIssues(syntheticOfferDetails({ branchIds: [401] }), result).length);
});

test("a verified profile merchantBranchId can supply a real branch when the agency list is empty", async () => {
  const loader = createOfferOptionsLoader(tokenProvider, async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === "/filters") return Response.json(filters());
    if (path === "/admin/merchant-profiles/1001") return Response.json({
      merchantProfileId: 1001, agencyId: 2001,
      branches: [{ id: 401, merchantBranchId: 5261, name: "City Center" }],
    });
    return Response.json([]);
  });
  const result = await loader("1001");
  assert.deepEqual(result.branches, [{ id: 5261, name: "City Center" }]);
  assert.equal(result.branchIssue, null);
  assert.ok(offerOptionIssues(syntheticOfferDetails({ branchIds: [401] }), result).length);
});

for (const [label, profile, reason] of [
  ["missing agency", { merchantProfileId: 1001 }, /no valid QA agency association/],
  ["zero agency", { merchantProfileId: 1001, agencyId: 0 }, /no valid QA agency association/],
  ["negative agency", { merchantProfileId: 1001, agencyId: -1 }, /no valid QA agency association/],
  ["string agency", { merchantProfileId: 1001, agencyId: "3001" }, /no valid QA agency association/],
  ["fractional agency", { merchantProfileId: 1001, agencyId: 3.5 }, /no valid QA agency association/],
  ["unsafe agency", { merchantProfileId: 1001, agencyId: Number.MAX_SAFE_INTEGER + 1 }, /no valid QA agency association/],
  ["wrong profile", { merchantProfileId: 1002, agencyId: 3001 }, /identity could not be confirmed/],
  ["moderation ID only", { merchantModerationProfileId: 1001, agencyId: 3001 }, /identity could not be confirmed/],
  ["missing profile", { agencyId: 3001 }, /identity could not be confirmed/],
  ["malformed profile", null, /identity could not be confirmed/],
] as const) test(`branch lookup fails closed for ${label} without requesting branches`, async () => {
  const paths: string[] = [];
  const load = createOfferOptionsLoader(tokenProvider, async (url) => {
    const path = new URL(String(url)).pathname;
    paths.push(path);
    return Response.json(path === "/filters" ? filters() : profile);
  });
  const result = await load("1001");
  assert.deepEqual(result.branches, []);
  assert.match(result.branchIssue!, reason);
  assert.deepEqual(paths, ["/filters", "/admin/merchant-profiles/1001"]);
  assert.ok(offerOptionIssues(syntheticOfferDetails(), result).some((issue) => issue.startsWith("branchIds")));
});

test("profile and branch failures are distinct from a confirmed empty list and never echo upstream content", async () => {
  for (const failure of ["profile", "branches", "malformed branches", "empty"] as const) {
    const load = createOfferOptionsLoader(tokenProvider, async (url) => {
      const path = new URL(String(url)).pathname;
      if (path === "/filters") return Response.json(filters());
      if (path.includes("/merchant-profiles/")) return failure === "profile"
        ? new Response("PRIVATE", { status: 404 })
        : Response.json({ merchantProfileId: 1001, agencyId: 3001 });
      if (failure === "branches") return new Response("PRIVATE", { status: 503 });
      return Response.json(failure === "malformed branches" ? { private: "PRIVATE" } : []);
    });
    const result = await load("1001");
    assert.match(result.branchIssue!, failure === "profile" ? /Unable to verify.*profile/
      : failure === "empty" ? /no selectable branches/ : /Unable to verify.*branches/);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE|synthetic/);
  }
});

test("a failed refresh discards previously verified branches and a normal retry resolves the agency again", async () => {
  let agency: number | null = 3001;
  const load = createOfferOptionsLoader(tokenProvider, async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === "/filters") return Response.json(filters());
    if (path.includes("/merchant-profiles/")) return Response.json({ merchantProfileId: 1001, agencyId: agency });
    return Response.json([{ id: agency, name: "Synthetic branch" }]);
  });
  assert.equal((await load("1001")).branches[0].id, 3001);
  agency = null;
  assert.deepEqual((await load("1001", true)).branches, []);
  agency = 3002;
  assert.equal((await load("1001")).branches[0].id, 3002);
});

test("refresh supersedes old profile and branch requests without old completions overwriting its cache", async () => {
  for (const delayedStage of ["profile", "branches"] as const) {
    const started = deferred<void>();
    const old = deferred<Response>();
    let profileReads = 0;
    const paths: string[] = [];
    const load = createOfferOptionsLoader(tokenProvider, async (url) => {
      const path = new URL(String(url)).pathname;
      paths.push(path);
      if (path === "/filters") return Response.json(filters());
      if (path.includes("/merchant-profiles/")) {
        profileReads++;
        if (profileReads === 1 && delayedStage === "profile") { started.resolve(); return old.promise; }
        return Response.json({ merchantProfileId: 1001, agencyId: profileReads === 1 ? 3001 : 3002 });
      }
      if (path === "/admin/3001/branches" && delayedStage === "branches") { started.resolve(); return old.promise; }
      return Response.json([{ id: path.includes("3001") ? 501 : 502, name: "Synthetic branch" }]);
    });
    const original = load("1001");
    await started.promise;
    const [fresh, concurrent] = await Promise.all([load("1001", true), load("1001", true)]);
    assert.deepEqual(fresh, concurrent);
    assert.equal(fresh.branches[0].id, 502);
    old.resolve(Response.json(delayedStage === "profile"
      ? { merchantProfileId: 1001, agencyId: 3001 } : [{ id: 501, name: "Old branch" }]));
    await original;
    const callCount = paths.length;
    assert.equal((await load("1001")).branches[0].id, 502);
    assert.equal(paths.length, callCount, "The fresh cache remains usable");
    assert.equal(profileReads, 2, "Concurrent reloads deduplicate");
  }
});

test("a taxonomy refresh supersedes an older pending read", async () => {
  const started = deferred<void>();
  const old = deferred<Response>();
  let reads = 0;
  const load = createOfferOptionsLoader(tokenProvider, async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === "/filters") {
      reads++;
      if (reads === 1) { started.resolve(); return old.promise; }
      return Response.json(filters());
    }
    if (path.includes("/merchant-profiles/")) return Response.json({ merchantProfileId: 1001, agencyId: 3001 });
    return Response.json([{ id: 501, name: "Synthetic branch" }]);
  });
  const original = load("1001");
  await started.promise;
  await load("1001", true);
  old.resolve(Response.json({ ...filters(), offerTypes: [{ id: 999, name: "Old type" }] }));
  await original;
  assert.equal((await load("1001")).offerTypes[0].id, filters().offerTypes[0].id);
  assert.equal(reads, 2);
});

test("branch association cache is bounded across profiles", async () => {
  const reads: string[] = [];
  const load = createOfferOptionsLoader(tokenProvider, async (url) => {
    const path = new URL(String(url)).pathname;
    reads.push(path);
    if (path === "/filters") return Response.json(filters());
    if (path.includes("/merchant-profiles/")) {
      const id = Number(path.split("/").at(-1));
      return Response.json({ merchantProfileId: id, agencyId: id + 2000 });
    }
    return Response.json([{ id: 501, name: "Synthetic branch" }]);
  });
  for (let id = 1001; id <= 1101; id++) await load(String(id));
  await load("1001");
  assert.equal(reads.filter((path) => path === "/admin/merchant-profiles/1001").length, 2);
});

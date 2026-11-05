import assert from "node:assert/strict";
import test from "node:test";
import { backofficeCredentials, backofficeTargets, getBackofficeTarget } from "./environment";

test("only explicit known targets are accepted and QA stays the default", () => {
  assert.equal(getBackofficeTarget({}).environment, "qa");
  assert.equal(getBackofficeTarget({ BACKOFFICE_TARGET: "production" }).apiOrigin, "https://qlr-bo-prod.qatarliving.com");
  assert.throws(() => getBackofficeTarget({ BACKOFFICE_TARGET: "prod" }), /Invalid/);
  assert.throws(() => getBackofficeTarget({ BACKOFFICE_TARGET: "https://other.invalid" }), /Invalid/);
});
test("production never falls back to QA credentials", () => {
  assert.deepEqual(backofficeCredentials({
    BACKOFFICE_USER: "qa-synthetic", BACKOFFICE_PW: "qa-synthetic", BACKOFFICE_API_TOKEN: "qa-synthetic",
  }, backofficeTargets.production), { username: undefined, password: undefined, apiToken: undefined });
  assert.equal(backofficeCredentials({ BACKOFFICE_PROD_USER: "prod-synthetic" }, backofficeTargets.qa).username, undefined);
});

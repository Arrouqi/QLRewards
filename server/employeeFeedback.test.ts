import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import { registerRoutes } from "./routes";
import { storage } from "./storage";

test("employee feedback API saves new fields, rejects invalid submissions, and supports legacy types", async (t) => {
  // Isolate storage and notifications: no database writes or real emails.
  t.mock.method(console, "error", () => {});
  t.mock.method(storage, "getAdminUser", async () => ({ role: "admin" }));
  t.mock.method(storage, "getActiveEmailRecipientsByType", async () => []);
  const saved: any[] = [];
  t.mock.method(storage, "createFeedback", async (data: any) => {
    saved.push(data);
    return { ...data, id: "test-feedback", createdAt: new Date() };
  });
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    let requestNumber = 0;
    const post = (data: unknown, path = "/api/feedbacks") => fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: "POST",
      // Separate test clients keep schema cases independent of the five-request limiter.
      headers: { "Content-Type": "application/json", "X-Forwarded-For": `192.0.2.${++requestNumber}` },
      body: JSON.stringify(data),
    });
    const input = {
      feedbackType: "employee_referral",
      shopperName: " Test Employee ",
      totalBudgetQar: "0",
      merchantName: "Custom Test Merchant",
      merchantLocation: "Test Branch",
      visitDate: "2026-10-07",
      visitTime: "14:30",
      staffAwareOfQld: "yes",
      staffFamiliarWithOffers: "no",
      staffKnowsRedeem: "yes",
      rewardApprovedImmediately: "no",
      merchantComments: "Test comment",
      merchantCommentFiles: ["/test-evidence.pdf"],
    };
    const response = await post(input);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, id: "test-feedback" });
    assert.equal(saved.length, 1);
    assert.equal(saved[0].shopperName, "Test Employee");
    assert.equal(saved[0].feedbackType, "employee_referral");
    assert.equal(saved[0].totalBudgetQar, "0");
    assert.equal(saved[0].staffFamiliarWithOffers, "no");
    assert.deepEqual(saved[0].merchantCommentFiles, ["/test-evidence.pdf"]);

    for (const invalid of [
      { feedbackType: "employee_referral" },
      { ...input, totalBudgetQar: "-1" },
      { ...input, staffAwareOfQld: undefined },
      { ...input, merchantCommentFiles: Array(7).fill("/test-evidence.pdf") },
    ]) {
      assert.equal((await post(invalid)).status, 400);
    }
    assert.equal(saved.length, 1, "invalid submissions must not reach storage");
    for (const feedbackType of ["mystery_shopper", "merchant_referral"]) {
      assert.equal((await post({ feedbackType, shopperName: "Legacy Test" })).status, 200);
    }
    assert.equal(saved.length, 3);
    assert.equal((await post({ files: Array(7).fill("unused") }, "/api/feedbacks/upload")).status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server.closeAllConnections();
  }
});

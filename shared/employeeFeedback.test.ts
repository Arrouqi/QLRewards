import assert from "node:assert/strict";
import test from "node:test";
import { employeeFeedbackSchema } from "./employeeFeedback";

const valid = {
  feedbackType: "employee_referral",
  shopperName: "Test Employee",
  totalBudgetQar: "250.50",
  merchantName: "Test Merchant",
  merchantLocation: "Test Branch",
  visitDate: "2026-10-07",
  visitTime: "14:30",
  staffAwareOfQld: "yes",
  staffFamiliarWithOffers: "no",
  staffKnowsRedeem: "yes",
  rewardApprovedImmediately: "no",
};

test("accepts a complete submission, decimals, zero and optional comments/files", () => {
  assert.equal(employeeFeedbackSchema.parse(valid).totalBudgetQar, "250.50");
  assert.equal(employeeFeedbackSchema.parse({ ...valid, totalBudgetQar: "0" }).totalBudgetQar, "0");
  assert.equal(employeeFeedbackSchema.parse({
    ...valid, merchantComments: "A short comment", merchantCommentFiles: Array(6).fill("/evidence/test.pdf"),
  }).merchantCommentFiles?.length, 6);
});

test("requires identity, visit details, budget and all four yes/no answers", () => {
  for (const key of Object.keys(valid)) {
    const missing: Record<string, unknown> = { ...valid };
    delete missing[key];
    assert.equal(employeeFeedbackSchema.safeParse(missing).success, false, key);
  }
  for (const key of ["shopperName", "merchantName", "merchantLocation"]) {
    assert.equal(employeeFeedbackSchema.safeParse({ ...valid, [key]: "   " }).success, false, key);
  }
});

test("rejects negative, nonnumeric and nonfinite budgets", () => {
  for (const totalBudgetQar of ["-1", "NaN", "Infinity", "abc", "", "1e309", "1".repeat(400)]) {
    assert.equal(employeeFeedbackSchema.safeParse({ ...valid, totalBudgetQar }).success, false, totalBudgetQar);
  }
});

test("rejects invalid dates, times, answers and more than six attachments", () => {
  for (const visitDate of ["2026-02-30", "2026-13-01", "not-a-date"]) {
    assert.equal(employeeFeedbackSchema.safeParse({ ...valid, visitDate }).success, false);
  }
  for (const visitTime of ["24:00", "12:60", "noon"]) {
    assert.equal(employeeFeedbackSchema.safeParse({ ...valid, visitTime }).success, false);
  }
  assert.equal(employeeFeedbackSchema.safeParse({ ...valid, staffAwareOfQld: "maybe" }).success, false);
  assert.equal(employeeFeedbackSchema.safeParse({
    ...valid, merchantCommentFiles: Array(7).fill("/evidence/test.pdf"),
  }).success, false);
});

test("trims required text and ignores removed legacy fields", () => {
  const parsed = employeeFeedbackSchema.parse({
    ...valid, shopperName: " Employee ", referralIntroducedDeals: "yes", staffKnowsRedeemComment: "old",
  });
  assert.equal(parsed.shopperName, "Employee");
  assert.equal("referralIntroducedDeals" in parsed, false);
  assert.equal("staffKnowsRedeemComment" in parsed, false);
});

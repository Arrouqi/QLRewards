import assert from "node:assert/strict";
import test from "node:test";
import { createQaTokenProvider, QA_LOGIN_URL } from "./auth";

const credentials = { username: "synthetic@example.invalid", password: "synthetic-password", apiToken: "manual-placeholder" };
const jwt = (exp: number) => `synthetic.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.signature`;

test("QA login uses the fixed endpoint and caches tokens with concurrent sign-in deduplication", async () => {
  let calls = 0;
  let time = 1_000_000;
  const provider = createQaTokenProvider(() => credentials, async (url, init) => {
    calls++;
    assert.equal(url, QA_LOGIN_URL);
    assert.equal(init?.redirect, "error");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), { username: credentials.username, password: credentials.password });
    return new Response(JSON.stringify({ token: jwt(10_000), refresh_token: "never-used" }), { status: 201 });
  }, () => time);
  const tokens = await Promise.all([provider.getToken(), provider.getToken()]);
  assert.equal(tokens[0], tokens[1]);
  assert.equal(calls, 1);
  await provider.getToken();
  assert.equal(calls, 1);
  time += 300_001;
  await provider.getToken();
  assert.equal(calls, 2);
  provider.invalidate(tokens[0]);
  await provider.getToken();
  assert.equal(calls, 3);
});

test("JWT expiry renews before expiration; expired login responses fail closed", async () => {
  let time = 1_000_000;
  let calls = 0;
  const provider = createQaTokenProvider(() => credentials, async () => {
    calls++;
    return Response.json({ token: jwt((time + 120_000) / 1000) });
  }, () => time);
  await provider.getToken();
  time += 60_001;
  await provider.getToken();
  assert.equal(calls, 2);
  const expired = createQaTokenProvider(() => credentials, async () => Response.json({ token: jwt(1) }), () => time);
  await assert.rejects(expired.getToken(), /QA sign-in failed/);
});

test("secret rotation obtains a new token, manual mode is only used without either login secret", async () => {
  let config: { username?: string; password?: string; apiToken?: string } = { ...credentials };
  let calls = 0;
  const provider = createQaTokenProvider(() => config, async () => {
    calls++;
    return Response.json({ token: "synthetic-opaque-token" });
  });
  await provider.getToken();
  config.password = "rotated-synthetic";
  await provider.getToken();
  assert.equal(calls, 2);
  config = { apiToken: "manual-placeholder" };
  assert.equal(await provider.getToken(), "manual-placeholder");
  config.username = "synthetic";
  await assert.rejects(provider.getToken(), /Both BACKOFFICE_USER and BACKOFFICE_PW/);
  assert.equal(calls, 2);
});

test("login failures, malformed/oversized responses and invalid tokens do not leak data or retry", async () => {
  for (const response of [
    () => new Response("PRIVATE-RESPONSE", { status: 401 }),
    () => new Response("PRIVATE-RESPONSE", { status: 500 }),
    () => new Response("not-json"),
    () => Response.json({ accessToken: "unconfirmed-field" }),
    () => Response.json({ token: "bad\r\nPRIVATE-RESPONSE" }),
    () => Response.json({ token: " " }),
    () => new Response("x".repeat(131073)),
    () => { throw new Error("PRIVATE-RESPONSE"); },
  ]) {
    let calls = 0;
    const provider = createQaTokenProvider(() => credentials, async () => { calls++; return response(); });
    await assert.rejects(provider.getToken(), (error: Error) => {
      assert.match(error.message, /QA sign-in failed/);
      assert.doesNotMatch(error.message, /PRIVATE-RESPONSE|synthetic-password/);
      return true;
    });
    assert.equal(calls, 1);
  }
});

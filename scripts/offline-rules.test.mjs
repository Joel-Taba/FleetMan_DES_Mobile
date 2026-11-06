// Unit tests of the offline queue rules (src/features/offline/rules.ts), no test runner needed:
//   node --test scripts/offline-rules.test.mjs
// The TypeScript module is transpiled in memory with the project's `typescript` package.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/features/offline/rules.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const rules = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

test("allow-list: driver actions only, by method and path", () => {
  const m = rules.matchOfflineAction;
  assert.equal(m("POST", "/api/v1/operations/fuel-recharges"), "fuel");
  assert.equal(m("post", "http://10.0.0.2:8081/api/v1/messages/mine"), "message");
  assert.equal(m("POST", "/api/v1/trips/t1/stops/s1/arrive"), "stopArrive");
  assert.equal(m("POST", "/api/v1/trips/t1/stops/s1/complete"), "stopComplete");
  assert.equal(m("POST", "/api/v1/trips/t1/stops/s1/fail"), "stopFail");
  assert.equal(m("POST", "/api/v1/assignments/a1/acknowledge"), "acknowledge");
  assert.equal(m("PATCH", "/api/v1/vehicles/v1/operational"), "vehicleOperational");
  assert.equal(m("POST", "/api/v1/operations/incidents/i1/comments"), "incidentComment");
  assert.equal(m("POST", "/api/v1/budget/expenses"), "expense");
  assert.equal(m("GET", "/api/v1/messages/mine"), null);
  assert.equal(m("POST", "/api/v1/operations/incidents/i1/attachments"), null);
  assert.equal(m("POST", "/api/v1/files/upload?category=document"), null);
  assert.equal(m("PUT", "/api/v1/account/password"), null);
});

test("classification: network, session, temporary server error, business refusal", () => {
  const c = rules.classifyFailure;
  assert.equal(c(0), "network");
  assert.equal(c(undefined), "network");
  assert.equal(c(401), "auth");
  assert.equal(c(403, "AUTH_005"), "auth");
  assert.equal(c(500), "server");
  assert.equal(c(503), "server");
  assert.equal(c(429), "server");
  assert.equal(c(400), "refused");
  assert.equal(c(409), "refused");
  assert.equal(c(422), "refused");
});

test("backoff grows then is capped", () => {
  assert.equal(rules.backoffMs(0), 0);
  assert.equal(rules.backoffMs(1), 5_000);
  assert.ok(rules.backoffMs(3) > rules.backoffMs(2));
  assert.equal(rules.backoffMs(50), rules.backoffMs(6));
});

const item = (over) => ({
  id: over.id,
  userId: "u1",
  kind: "message",
  method: "POST",
  path: "/api/v1/messages/mine",
  createdAt: 1000,
  seq: 1,
  attempts: 0,
  nextAttemptAt: 0,
  state: "pending",
  ...over,
});

test("replay order: oldest pending of the current user first, backoff respected unless forced", () => {
  const items = [
    item({ id: "c", createdAt: 3000, seq: 3 }),
    item({ id: "b", createdAt: 1000, seq: 2 }),
    item({ id: "a", createdAt: 1000, seq: 1, nextAttemptAt: 9000 }),
    item({ id: "x", createdAt: 1, seq: 0, userId: "u2" }),
    item({ id: "f", createdAt: 0, seq: 0, state: "failed" }),
  ];
  assert.deepEqual(rules.pendingOf(items, "u1").map((i) => i.id), ["a", "b", "c"]);
  assert.equal(rules.nextToReplay(items, "u1", 5000), null, "head still waiting: order is kept");
  assert.equal(rules.nextToReplay(items, "u1", 5000, true).id, "a");
  assert.equal(rules.nextToReplay(items, "u1", 9000).id, "a");
  assert.equal(rules.nextToReplay(items, null, 9000), null);
  assert.deepEqual(rules.failedOf(items, "u1").map((i) => i.id), ["f"]);
});

test("after a failure: refusal goes to failed, network keeps it with backoff, server gives up after max", () => {
  const base = item({ id: "a" });
  const refused = rules.afterFailure(base, "refused", "Véhicule indisponible", 409, 100);
  assert.equal(refused.state, "failed");
  assert.equal(refused.lastError, "Véhicule indisponible");
  const network = rules.afterFailure(base, "network", "Connexion impossible", null, 100);
  assert.equal(network.state, "pending");
  assert.equal(network.nextAttemptAt, 100 + rules.backoffMs(1));
  const auth = rules.afterFailure(base, "auth", "Session expirée", 401, 100);
  assert.equal(auth.state, "pending");
  assert.equal(auth.attempts, 0);
  let s = base;
  for (let i = 0; i < rules.MAX_SERVER_ATTEMPTS; i++) s = rules.afterFailure(s, "server", "Erreur 503", 503, 100);
  assert.equal(s.state, "failed");
});

test("client id is a UUID v4 (Idempotency-Key format expected by the backend)", () => {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  assert.match(rules.createClientId(), re);
  let n = 0;
  assert.match(rules.createClientId(() => ((n += 0.37) % 1)), re);
});

test("queued result is recognisable", () => {
  assert.equal(rules.isQueued({ queued: true, clientId: "x", kind: "message" }), true);
  assert.equal(rules.isQueued({ id: "x" }), false);
  assert.equal(rules.isQueued(undefined), false);
});

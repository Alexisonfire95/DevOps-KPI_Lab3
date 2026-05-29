import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createRouter } from "../../src/lib/router.js";

describe("router", () => {
	test("matches exact routes", async () => {
		const router = createRouter();
		let called = false;

		router.add("GET", "/tasks", async (_req, _res, _params) => {
			called = true;
		});

		const matched = await router.handle({ url: "/tasks", method: "GET" }, {});
		assert.equal(matched, true);
		assert.equal(called, true);
	});

	test("ignores route with different method", async () => {
		const router = createRouter();
		let called = false;

		router.add("POST", "/tasks", async (_req, _res, _params) => {
			called = true;
		});

		const matched = await router.handle({ url: "/tasks", method: "GET" }, {});
		assert.equal(matched, false);
		assert.equal(called, false);
	});

	test("parses url parameters correctly", async () => {
		const router = createRouter();
		let capturedParams = null;

		router.add("GET", "/tasks/:id/done", async (_req, _res, params) => {
			capturedParams = params;
		});

		const matched = await router.handle({ url: "/tasks/123-abc/done", method: "GET" }, {});
		assert.equal(matched, true);
		assert.deepEqual({ ...capturedParams }, { id: "123-abc" });
	});

	test("returns false when no match", async () => {
		const router = createRouter();
		const matched = await router.handle({ url: "/unknown", method: "GET" }, {});
		assert.equal(matched, false);
	});
});

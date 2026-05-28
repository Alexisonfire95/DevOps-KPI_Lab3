import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	escapeHtml,
	readJsonBody,
	wantsHtml,
	wantsJson,
	sendNegotiated
} from "../../src/lib/http-utils.js";

describe("http-utils", () => {
	describe("escapeHtml", () => {
		test("escapes special characters", () => {
			assert.equal(escapeHtml('<script>alert("hello") & bye</script>'), "&lt;script&gt;alert(&quot;hello&quot;) &amp; bye&lt;/script&gt;");
		});
	});

	describe("wantsHtml", () => {
		test("returns true when accept header contains text/html", () => {
			assert.equal(wantsHtml({ headers: { accept: "text/html,application/xhtml+xml" } }), true);
		});

		test("returns false when accept header lacks text/html", () => {
			assert.equal(wantsHtml({ headers: { accept: "application/json" } }), false);
			assert.equal(wantsHtml({ headers: {} }), false);
		});
	});

	describe("wantsJson", () => {
		test("returns true when accept header contains application/json", () => {
			assert.equal(wantsJson({ headers: { accept: "application/json, text/plain" } }), true);
		});

		test("returns false when accept header lacks application/json", () => {
			assert.equal(wantsJson({ headers: { accept: "text/html" } }), false);
			assert.equal(wantsJson({ headers: {} }), false);
		});
	});

	describe("readJsonBody", () => {
		test("parses valid JSON stream", async () => {
			const mockReq = [Buffer.from('{"title":"test task"}')];
			const body = await readJsonBody(mockReq);
			assert.deepEqual(body, { title: "test task" });
		});

		test("returns empty object on empty stream", async () => {
			const mockReq = [];
			const body = await readJsonBody(mockReq);
			assert.deepEqual(body, {});
		});

		test("throws on invalid JSON", async () => {
			const mockReq = [Buffer.from('{"invalid":}')];
			await assert.rejects(readJsonBody(mockReq), /Invalid JSON body/);
		});
	});

	describe("sendNegotiated", () => {
		test("sends HTML if requested", () => {
			const req = { headers: { accept: "text/html" } };
			let contentType = "";
			let statusCode = 0;
			let endedBody = "";

			const res = {
				set statusCode(val) {
					statusCode = val;
				},
				setHeader(name, value) {
					if (name.toLowerCase() === "content-type") {
						contentType = value;
					}
				},
				end(body) {
					endedBody = body;
				}
			};

			sendNegotiated(res, req, {
				statusCode: 201,
				html: "<h1>hello</h1>",
				json: { message: "hello" }
			});

			assert.equal(statusCode, 201);
			assert.ok(contentType.includes("text/html"));
			assert.equal(endedBody, "<h1>hello</h1>");
		});

		test("sends JSON if requested", () => {
			const req = { headers: { accept: "application/json" } };
			let contentType = "";
			let statusCode = 0;
			let endedBody = "";

			const res = {
				set statusCode(val) {
					statusCode = val;
				},
				setHeader(name, value) {
					if (name.toLowerCase() === "content-type") {
						contentType = value;
					}
				},
				end(body) {
					endedBody = body;
				}
			};

			sendNegotiated(res, req, {
				statusCode: 200,
				html: "<h1>hello</h1>",
				json: { message: "hello" }
			});

			assert.equal(statusCode, 200);
			assert.ok(contentType.includes("application/json"));
			assert.deepEqual(JSON.parse(endedBody), { message: "hello" });
		});
	});
});

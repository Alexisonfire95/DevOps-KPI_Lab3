import assert from "node:assert/strict";
import { before, beforeEach, describe, test } from "node:test";
import { getGlobalTestContext } from "./helpers/setup.js";

describe("Tasks API (integration)", () => {
	let ctx;

	before(async () => {
		ctx = await getGlobalTestContext();
	});

	beforeEach(async () => {
		await ctx.clearDatabase();
	});

	test("GET / returns html list of endpoints", async () => {
		const res = await fetch(`${ctx.baseUrl}/`, {
			headers: { accept: "text/html" }
		});
		assert.equal(res.status, 200);
		assert.ok((await res.text()).includes("Business endpoints"));
	});

	test("GET / with invalid accept returns 406", async () => {
		const res = await fetch(`${ctx.baseUrl}/`, {
			headers: { accept: "application/json" }
		});
		assert.equal(res.status, 406);
	});

	test("GET /health/alive returns 200 OK", async () => {
		const res = await fetch(`${ctx.baseUrl}/health/alive`);
		assert.equal(res.status, 200);
		assert.equal(await res.text(), "OK");
	});

	test("GET /health/ready returns 200 OK when database is online", async () => {
		const res = await fetch(`${ctx.baseUrl}/health/ready`);
		assert.equal(res.status, 200);
		assert.equal(await res.text(), "OK");
	});

	test("GET /tasks returns empty list initially", async () => {
		const res = await fetch(`${ctx.baseUrl}/tasks`, {
			headers: { accept: "application/json" }
		});
		assert.equal(res.status, 200);
		const body = await res.json();
		assert.ok(Array.isArray(body));
		assert.equal(body.length, 0);
	});

	test("POST /tasks creates task and GET lists it", async () => {
		const title = `Task ${Date.now()}`;

		const create = await fetch(`${ctx.baseUrl}/tasks`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"accept": "application/json"
			},
			body: JSON.stringify({ title })
		});
		assert.equal(create.status, 200);
		const created = await create.json();
		assert.ok(created.id);
		assert.equal(typeof created.id, "number");

		const list = await fetch(`${ctx.baseUrl}/tasks`, {
			headers: { accept: "application/json" }
		});
		assert.equal(list.status, 200);
		const tasks = await list.json();
		assert.equal(tasks.length, 1);
		assert.equal(tasks[0].title, title);
		assert.equal(tasks[0].id, created.id);
		assert.equal(tasks[0].status, "pending");
	});

	test("POST /tasks without title returns 400", async () => {
		const res = await fetch(`${ctx.baseUrl}/tasks`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({})
		});
		assert.equal(res.status, 400);
	});

	test("POST /tasks/:id/done marks task done", async () => {
		const title = `Done ${Date.now()}`;

		const create = await fetch(`${ctx.baseUrl}/tasks`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"accept": "application/json"
			},
			body: JSON.stringify({ title })
		});
		const { id } = await create.json();

		const done = await fetch(`${ctx.baseUrl}/tasks/${id}/done`, {
			method: "POST",
			headers: { accept: "application/json" }
		});
		assert.equal(done.status, 200);
		const body = await done.json();
		assert.equal(body.id, id);

		const list = await fetch(`${ctx.baseUrl}/tasks`, {
			headers: { accept: "application/json" }
		});
		const tasks = await list.json();
		assert.equal(tasks[0].status, "done");
	});

	test("POST /tasks/:id/done with invalid id returns 400", async () => {
		const res = await fetch(`${ctx.baseUrl}/tasks/-5/done`, {
			method: "POST",
			headers: { accept: "application/json" }
		});
		assert.equal(res.status, 400);
	});

	test("POST /tasks/:id/done for missing id returns 404", async () => {
		const res = await fetch(`${ctx.baseUrl}/tasks/9999/done`, {
			method: "POST",
			headers: { accept: "application/json" }
		});
		assert.equal(res.status, 404);
	});
});

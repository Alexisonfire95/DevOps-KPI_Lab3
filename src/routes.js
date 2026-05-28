import {
	escapeHtml,
	readJsonBody,
	sendNegotiated,
	wantsHtml
} from "./lib/http-utils.js"

const BUSINESS_ENDPOINTS = [
	"GET /tasks — list all tasks",
	"POST /tasks (body: { title }) — create task",
	"POST /tasks/:id/done — mark task as done"
]

function formatTaskRow(task) {
	return {
		id: task.id,
		title: task.title,
		status: task.status,
		created_at:
			task.created_at instanceof Date
				? task.created_at.toISOString()
				: String(task.created_at)
	}
}

function renderTasksTable(tasks) {
	const rows = tasks
		.map((task) => {
			const row = formatTaskRow(task)
			return `<tr>
<td>${escapeHtml(row.id)}</td>
<td>${escapeHtml(row.title)}</td>
<td>${escapeHtml(row.status)}</td>
<td>${escapeHtml(row.created_at)}</td>
</tr>`
		})
		.join("")

	return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tasks</title></head><body><h1>Tasks</h1><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>id</th><th>title</th><th>status</th><th>created_at</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
}

export function registerRoutes(router, pool) {
	router.add("GET", "/", async (req, res) => {
		if (!wantsHtml(req)) {
			res.statusCode = 406
			res.setHeader("Content-Type", "text/plain; charset=utf-8")
			res.end("Expect text/html")
			return
		}

		const items = BUSINESS_ENDPOINTS.map((item) => `<li>${escapeHtml(item)}</li>`).join(
			""
		)
		res.statusCode = 200
		res.setHeader("Content-Type", "text/html; charset=utf-8")
		res.end(
			`<!DOCTYPE html><html><head><meta charset="utf-8"><title>mywebapp</title></head><body><h1>Business endpoints</h1><ul>${items}</ul></body></html>`
		)
	})

	router.add("GET", "/health/alive", async (_req, res) => {
		res.statusCode = 200
		res.setHeader("Content-Type", "text/plain; charset=utf-8")
		res.end("OK")
	})

	router.add("GET", "/health/ready", async (_req, res) => {
		try {
			const client = await pool.connect()
			try {
				await client.query("SELECT 1")
			} finally {
				client.release()
			}
			res.statusCode = 200
			res.setHeader("Content-Type", "text/plain; charset=utf-8")
			res.end("OK")
		} catch {
			res.statusCode = 500
			res.setHeader("Content-Type", "text/plain; charset=utf-8")
			res.end("Database unavailable")
		}
	})

	router.add("GET", "/tasks", async (req, res) => {
		const { rows } = await pool.query(
			"SELECT id, title, status, created_at FROM tasks ORDER BY id"
		)
		const payload = rows.map(formatTaskRow)
		sendNegotiated(res, req, {
			json: payload,
			html: renderTasksTable(rows)
		})
	})

	router.add("POST", "/tasks", async (req, res) => {
		let body
		try {
			body = await readJsonBody(req)
		} catch (error) {
			res.statusCode = 400
			res.setHeader("Content-Type", "application/json; charset=utf-8")
			res.end(JSON.stringify({ error: error.message }))
			return
		}

		const title = typeof body.title === "string" ? body.title.trim() : ""
		if (!title) {
			res.statusCode = 400
			res.setHeader("Content-Type", "application/json; charset=utf-8")
			res.end(JSON.stringify({ error: "title is required" }))
			return
		}

		const { rows } = await pool.query(
			"INSERT INTO tasks (title) VALUES ($1) RETURNING id",
			[title]
		)
		const id = rows[0].id

		sendNegotiated(res, req, {
			json: { id },
			html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Task created</title></head><body><h1>Task created</h1><p>id: ${escapeHtml(id)}</p></body></html>`
		})
	})

	router.add("POST", "/tasks/:id/done", async (req, res, params) => {
		const id = Number(params.id)
		if (!Number.isInteger(id) || id < 1) {
			res.statusCode = 400
			res.setHeader("Content-Type", "application/json; charset=utf-8")
			res.end(JSON.stringify({ error: "invalid task id" }))
			return
		}

		const { rowCount } = await pool.query(
			"UPDATE tasks SET status = 'done' WHERE id = $1",
			[id]
		)

		if (rowCount === 0) {
			res.statusCode = 404
			res.setHeader("Content-Type", "application/json; charset=utf-8")
			res.end(JSON.stringify({ error: "task not found" }))
			return
		}

		sendNegotiated(res, req, {
			json: { id },
			html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Task updated</title></head><body><h1>Task marked as done</h1><p>id: ${escapeHtml(id)}</p></body></html>`
		})
	})
}

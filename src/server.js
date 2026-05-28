import http from "node:http"
import { createRouter } from "./lib/router.js"
import { registerRoutes } from "./routes.js"

export function createApp(pool) {
	const router = createRouter()
	registerRoutes(router, pool)

	const server = http.createServer(async (req, res) => {
		try {
			const handled = await router.handle(req, res)
			if (!handled) {
				res.statusCode = 404
				res.setHeader("Content-Type", "application/json; charset=utf-8")
				res.end(JSON.stringify({ error: "Not found" }))
			}
		} catch (error) {
			console.error(JSON.stringify({ level: "error", message: error.message }))
			if (!res.headersSent) {
				res.statusCode = 500
				res.setHeader("Content-Type", "application/json; charset=utf-8")
				res.end(JSON.stringify({ error: "Internal Server Error" }))
			}
		}
	})

	return {
		start(target) {
			return new Promise((resolve, reject) => {
				if (typeof target === "object" && target !== null && "fd" in target) {
					server.listen({ fd: target.fd }, () => resolve())
					return
				}

				server.listen(target.port, target.host, () => resolve())
			})
		},
		stop() {
			return new Promise((resolve, reject) => {
				server.close((error) => (error ? reject(error) : resolve()))
			})
		}
	}
}

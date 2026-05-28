import { loadConfig } from "./config.js"
import { createPool } from "./db.js"
import { createApp } from "./server.js"

let config
try {
	config = loadConfig()
} catch (error) {
	console.error(JSON.stringify({ level: "error", message: error.message }))
	process.exit(1)
}

const pool = createPool(config)
const app = createApp(pool)

const listenFds = Number(process.env.LISTEN_FDS ?? 0)
const listenTarget =
	listenFds >= 1 ? { fd: 3 } : { host: config.host, port: config.port }

app.start(listenTarget)
	.then(() => {
		console.log(
			JSON.stringify({
				level: "info",
				message: "Server is running",
				config: config.configPath,
				host: config.host,
				port: config.port,
				socketActivation: listenFds >= 1
			})
		)
	})
	.catch((error) => {
		console.error(JSON.stringify({ level: "error", message: error.message }))
		process.exit(1)
	})

async function shutdown(signal) {
	console.log(JSON.stringify({ level: "info", message: `Received ${signal}` }))
	try {
		await app.stop()
		await pool.end()
		process.exit(0)
	} catch (error) {
		console.error(JSON.stringify({ level: "error", message: error.message }))
		process.exit(1)
	}
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))

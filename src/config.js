import fs from "node:fs"
import path from "node:path"
import { parseArgs } from "node:util"
import { parse as parseYaml } from "yaml"

const DEFAULT_CONFIG_PATH = "/etc/mywebapp/config.yaml"

function resolveConfigPath() {
	const { values } = parseArgs({
		options: { config: { type: "string" } },
		strict: false
	})
	return (
		values.config ??
		process.env.CONFIG_PATH ??
		process.env.MYWEBAPP_CONFIG ??
		DEFAULT_CONFIG_PATH
	)
}

function requireString(value, name) {
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error(`Invalid configuration: ${name} is required`)
	}
	return value.trim()
}

function requirePort(value, name) {
	const port = Number(value)
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`Invalid configuration: ${name} must be a valid port`)
	}
	return port
}

export function loadConfig(configPath = resolveConfigPath()) {
	const resolved = path.resolve(configPath)
	if (!fs.existsSync(resolved)) {
		throw new Error(`Configuration file not found: ${resolved}`)
	}

	const raw = parseYaml(fs.readFileSync(resolved, "utf8"))
	if (!raw || typeof raw !== "object") {
		throw new Error(`Invalid configuration file: ${resolved}`)
	}

	const server = raw.server ?? {}
	const database = raw.database ?? {}

	return {
		configPath: resolved,
		host: server.host ?? "127.0.0.1",
		port: requirePort(server.port ?? 5200, "server.port"),
		dbHost: requireString(database.host ?? "127.0.0.1", "database.host"),
		dbPort: requirePort(database.port ?? 5432, "database.port"),
		dbUser: requireString(database.user, "database.user"),
		dbPassword: requireString(database.password, "database.password"),
		dbName: requireString(database.name, "database.name")
	}
}

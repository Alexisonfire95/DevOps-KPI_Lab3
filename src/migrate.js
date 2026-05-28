#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { loadConfig } from "./config.js"
import { createPool } from "./db.js"

const MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS migrations (
	id SERIAL PRIMARY KEY,
	name VARCHAR(255) NOT NULL UNIQUE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
`

async function main() {
	let config
	try {
		config = loadConfig()
	} catch (error) {
		console.error(error.message)
		process.exit(1)
	}

	const pool = createPool(config)
	const migrationsDir = path.join(
		path.dirname(fileURLToPath(import.meta.url)),
		"migrations"
	)

	try {
		await pool.query(MIGRATIONS_TABLE)
		const { rows: appliedRows } = await pool.query(
			"SELECT name FROM migrations ORDER BY id"
		)
		const applied = new Set(appliedRows.map((row) => row.name))

		const files = (await fs.readdir(migrationsDir))
			.filter((file) => file.endsWith(".js"))
			.sort()

		for (const file of files) {
			if (applied.has(file)) {
				console.log(`skip ${file}`)
				continue
			}

			const moduleUrl = pathToFileURL(path.join(migrationsDir, file)).href
			const migration = await import(moduleUrl)
			if (typeof migration.up !== "function") {
				throw new Error(`Migration ${file} must export up(pool)`)
			}

			await migration.up(pool)
			await pool.query("INSERT INTO migrations (name) VALUES ($1)", [file])
			console.log(`applied ${file}`)
		}

		console.log("migrations finished")
	} catch (error) {
		console.error("migration failed:", error.message)
		process.exit(1)
	} finally {
		await pool.end()
	}
}

main()

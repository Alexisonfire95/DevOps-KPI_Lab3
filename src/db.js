import pg from "pg"

const { Pool } = pg

export function createPool(config) {
	return new Pool({
		host: config.dbHost,
		port: config.dbPort,
		user: config.dbUser,
		password: config.dbPassword,
		database: config.dbName,
		max: 10,
		connectionTimeoutMillis: 5000
	})
}

export async function checkDatabase(pool) {
	const client = await pool.connect()
	try {
		await client.query("SELECT 1")
	} finally {
		client.release()
	}
}

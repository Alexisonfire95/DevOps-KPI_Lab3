import pg from "pg";
import { loadConfig } from "../src/config.js";

async function wait() {
	let config;
	try {
		config = loadConfig();
	} catch (error) {
		console.error("Failed to load config for DB check:", error.message);
		process.exit(1);
	}

	const pool = new pg.Pool({
		host: config.dbHost,
		port: config.dbPort,
		user: config.dbUser,
		password: config.dbPassword,
		database: config.dbName,
		connectionTimeoutMillis: 2000
	});

	for (let i = 0; i < 30; i++) {
		try {
			const client = await pool.connect();
			client.release();
			console.log("Database is ready!");
			await pool.end();
			process.exit(0);
		} catch (e) {
			console.log("Database not ready yet, retrying in 1s...");
			await new Promise(r => setTimeout(r, 1000));
		}
	}
	console.error("Database connection timeout");
	await pool.end();
	process.exit(1);
}

wait();

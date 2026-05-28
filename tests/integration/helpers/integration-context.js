import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { GenericContainer, Wait } from "testcontainers";
import { getFreePort } from "./get-free-port.js";
import { repoRoot } from "./repo-root.js";

const { Pool } = pg;
const POSTGRES_IMAGE = "postgres:16-alpine";

export class IntegrationContext {
	pgContainer = null;
	appProcess = null;
	apiPort = 0;
	baseUrl = "";
	dbHost = "";
	dbPort = 0;
	dbUser = "mywebapp";
	dbPassword = "testsecret";
	dbName = "mywebapp";
	configPath = "";

	async setup() {
		// Start Postgres container
		this.pgContainer = await new GenericContainer(POSTGRES_IMAGE)
			.withEnvironment({
				POSTGRES_DB: this.dbName,
				POSTGRES_USER: this.dbUser,
				POSTGRES_PASSWORD: this.dbPassword
			})
			.withExposedPorts(5432)
			.withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/i))
			.start();

		this.dbHost = this.pgContainer.getHost();
		this.dbPort = this.pgContainer.getMappedPort(5432);
		this.apiPort = await getFreePort();
		this.baseUrl = `http://127.0.0.1:${this.apiPort}`;

		// Create a temporary YAML config file for this test run
		this.configPath = path.join(repoRoot, `temp-config-${this.apiPort}.yaml`);
		const yamlConfig = `
server:
  host: "127.0.0.1"
  port: ${this.apiPort}
database:
  host: "${this.dbHost}"
  port: ${this.dbPort}
  user: "${this.dbUser}"
  password: "${this.dbPassword}"
  name: "${this.dbName}"
`;
		fs.writeFileSync(this.configPath, yamlConfig, "utf8");

		// Run migrations using the temp config path
		const migrateResult = spawnSync(
			process.execPath,
			["src/migrate.js"],
			{
				cwd: repoRoot,
				encoding: "utf8",
				env: { ...process.env, NODE_ENV: "test", CONFIG_PATH: this.configPath }
			}
		);

		if (migrateResult.status !== 0) {
			const err = migrateResult.stderr || migrateResult.stdout || "";
			await this.cleanup().catch(() => {});
			throw new Error(`migrate failed (exit ${migrateResult.status}): ${err}`);
		}

		// Spawn the app server using the temp config path
		this.appProcess = spawn(
			process.execPath,
			["src/index.js"],
			{
				cwd: repoRoot,
				env: { ...process.env, NODE_ENV: "test", CONFIG_PATH: this.configPath },
				stdio: ["ignore", "pipe", "pipe"]
			}
		);

		let stderrBuf = "";
		this.appProcess.stderr?.on("data", (chunk) => {
			stderrBuf += String(chunk);
			if (stderrBuf.length > 8000) {
				stderrBuf = stderrBuf.slice(-4000);
			}
		});

		this.appProcess.on("exit", (code) => {
			if (code !== 0 && code !== null) {
				console.error(`App exited with code ${code}\n${stderrBuf}`);
			}
		});

		await this.waitForReady();
	}

	async waitForReady() {
		const proc = this.appProcess;
		if (!proc) throw new Error("App process not started");

		for (let i = 0; i < 120; i++) {
			if (proc.exitCode !== null && proc.exitCode !== undefined) {
				throw new Error(
					`Server exited with code ${proc.exitCode} before becoming ready`
				);
			}
			try {
				const res = await fetch(`${this.baseUrl}/health/alive`);
				if (res.ok) return;
			} catch {
				// still starting
			}
			await delay(250);
		}
		throw new Error("Server startup timeout (health/alive)");
	}

	async clearDatabase() {
		const pool = new Pool({
			host: this.dbHost,
			port: this.dbPort,
			user: this.dbUser,
			password: this.dbPassword,
			database: this.dbName
		});
		try {
			await pool.query("TRUNCATE TABLE tasks RESTART IDENTITY CASCADE");
		} finally {
			await pool.end();
		}
	}

	async cleanup() {
		if (this.appProcess && !this.appProcess.killed) {
			this.appProcess.kill("SIGTERM");
			await delay(500).catch(() => {});
			if (this.appProcess.exitCode === null) {
				this.appProcess.kill("SIGKILL");
			}
		}

		if (this.pgContainer) {
			await this.pgContainer.stop().catch(() => {});
		}

		if (this.configPath && fs.existsSync(this.configPath)) {
			try {
				fs.unlinkSync(this.configPath);
			} catch {
				// ignore
			}
		}
	}
}

export async function up(pool) {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS tasks (
			id SERIAL PRIMARY KEY,
			title VARCHAR(1024) NOT NULL,
			status VARCHAR(64) NOT NULL DEFAULT 'pending',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	await pool.query(
		"CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status)"
	)
	await pool.query(
		"CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at)"
	)
}

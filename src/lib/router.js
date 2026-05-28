export function createRouter() {
	const routes = []

	return {
		add(method, pattern, handler) {
			routes.push({ method, pattern, handler, regex: toRegex(pattern) })
		},
		async handle(req, res) {
			const url = new URL(req.url ?? "/", "http://localhost")
			const pathname = url.pathname
			const method = req.method ?? "GET"

			for (const route of routes) {
				if (route.method !== method) continue
				const match = pathname.match(route.regex)
				if (!match) continue
				await route.handler(req, res, match.groups ?? {})
				return true
			}

			return false
		}
	}
}

function toRegex(pattern) {
	const parts = pattern.split("/").map((part) => {
		if (part.startsWith(":")) {
			return `(?<${part.slice(1)}>[^/]+)`
		}
		return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	})

	return new RegExp(`^${parts.join("/")}$`)
}

export function escapeHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
}

export async function readJsonBody(req) {
	const chunks = []
	for await (const chunk of req) {
		chunks.push(chunk)
	}
	if (chunks.length === 0) {
		return {}
	}
	const text = Buffer.concat(chunks).toString("utf8").trim()
	if (!text) {
		return {}
	}
	try {
		return JSON.parse(text)
	} catch {
		throw new Error("Invalid JSON body")
	}
}

export function wantsHtml(req) {
	const accept = req.headers.accept ?? ""
	return accept.includes("text/html")
}

export function wantsJson(req) {
	const accept = req.headers.accept ?? ""
	return accept.includes("application/json")
}

export function sendNegotiated(res, req, representations) {
	if (wantsHtml(req) && representations.html != null) {
		res.statusCode = representations.statusCode ?? 200
		res.setHeader("Content-Type", "text/html; charset=utf-8")
		res.end(representations.html)
		return
	}

	if (wantsJson(req) && representations.json != null) {
		res.statusCode = representations.statusCode ?? 200
		res.setHeader("Content-Type", "application/json; charset=utf-8")
		res.end(JSON.stringify(representations.json))
		return
	}

	if (representations.json != null) {
		res.statusCode = representations.statusCode ?? 200
		res.setHeader("Content-Type", "application/json; charset=utf-8")
		res.end(JSON.stringify(representations.json))
		return
	}

	if (representations.html != null) {
		res.statusCode = representations.statusCode ?? 200
		res.setHeader("Content-Type", "text/html; charset=utf-8")
		res.end(representations.html)
	}
}

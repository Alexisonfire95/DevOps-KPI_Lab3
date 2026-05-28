import net from "node:net";

export function getFreePort() {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.unref();
		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const addr = server.address();
			const port = addr && typeof addr === "object" ? addr.port : null;
			server.close((err) => {
				if (err) reject(err);
				else if (port) resolve(port);
				else reject(new Error("Could not resolve free port"));
			});
		});
	});
}

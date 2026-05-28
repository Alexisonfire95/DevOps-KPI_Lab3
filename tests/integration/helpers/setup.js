import { IntegrationContext } from "./integration-context.js";

let globalContext = null;

export function getGlobalTestContext() {
	if (!globalContext) {
		throw new Error(
			"IntegrationContext not initialized — call setupGlobalTestContext() in describe before()"
		);
	}
	return globalContext;
}

export async function setupGlobalTestContext() {
	if (globalContext) {
		return globalContext;
	}
	globalContext = new IntegrationContext();
	await globalContext.setup();
	return globalContext;
}

export async function cleanupGlobalTestContext() {
	if (globalContext) {
		await globalContext.cleanup();
		globalContext = null;
	}
}

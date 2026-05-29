import { after, before } from "node:test";
import {
	cleanupGlobalTestContext,
	setupGlobalTestContext
} from "./helpers/setup.js";
import "./tasks.test.js";

before(async () => {
	await setupGlobalTestContext();
});

after(async () => {
	await cleanupGlobalTestContext();
});

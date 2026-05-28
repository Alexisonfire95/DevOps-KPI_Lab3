import js from "@eslint/js";

export default [
	js.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 2024,
			sourceType: "module",
			globals: {
				// Define standard Node.js globals manually to avoid dependency on 'globals' package if possible
				process: "readonly",
				console: "readonly",
				setTimeout: "readonly",
				clearTimeout: "readonly",
				setInterval: "readonly",
				clearInterval: "readonly",
				Buffer: "readonly",
				URL: "readonly",
				fetch: "readonly",
				AbortController: "readonly"
			}
		},
		rules: {
			"no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
			"no-console": "off"
		}
	}
];

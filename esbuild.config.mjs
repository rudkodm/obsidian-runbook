import esbuild from "esbuild";
import process from "process";
import fs from "fs";

const prod = process.argv[2] === "production";

// Sync version from manifest.json (single source of truth) to other files
function syncVersions() {
	const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
	const version = manifest.version;
	const minAppVersion = manifest.minAppVersion;

	// Sync to package.json
	const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
	if (pkg.version !== version) {
		pkg.version = version;
		fs.writeFileSync("package.json", JSON.stringify(pkg, null, "\t") + "\n");
		console.log(`📦 Synced package.json version to ${version}`);
	}

	// Sync to versions.json
	const versions = JSON.parse(fs.readFileSync("versions.json", "utf8"));
	if (!versions[version]) {
		versions[version] = minAppVersion;
		fs.writeFileSync("versions.json", JSON.stringify(versions, null, "\t") + "\n");
		console.log(`📋 Added ${version} to versions.json`);
	}
}

// Sync versions before build
syncVersions();

const context = await esbuild.context({
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
	],
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: "main.js",
	platform: "node",
});

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}

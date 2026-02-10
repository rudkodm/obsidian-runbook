import esbuild from "esbuild";
import process from "process";
import fs from "fs";

const prod = process.argv[2] === "production";

// Read version from manifest.json (single source of truth)
// and update versions.json when minAppVersion changes
function syncVersions() {
	const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
	const version = manifest.version;
	const minAppVersion = manifest.minAppVersion;

	// Sync to versions.json - only when minAppVersion changes
	// See: https://docs.obsidian.md/Reference/Versions
	const versions = JSON.parse(fs.readFileSync("versions.json", "utf8"));
	const existingMinVersions = Object.values(versions);
	const latestMinVersion = existingMinVersions[existingMinVersions.length - 1];
	
	if (minAppVersion !== latestMinVersion) {
		versions[version] = minAppVersion;
		fs.writeFileSync("versions.json", JSON.stringify(versions, null, "\t") + "\n");
		console.log(`📋 Updated versions.json: ${version} requires Obsidian ${minAppVersion}`);
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

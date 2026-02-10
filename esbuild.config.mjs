import esbuild from "esbuild";
import process from "process";
import fs from "fs";

const prod = process.argv[2] === "production";

// Sync version from VERSION file (single source of truth) to all other files
function syncVersions() {
	const version = fs.readFileSync("VERSION", "utf8").trim();
	
	// Sync to manifest.json
	const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
	if (manifest.version !== version) {
		manifest.version = version;
		fs.writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t") + "\n");
		console.log(`📦 Synced manifest.json to ${version}`);
	}

	// Sync to package.json
	const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
	if (pkg.version !== version) {
		pkg.version = version;
		fs.writeFileSync("package.json", JSON.stringify(pkg, null, "\t") + "\n");
		console.log(`📦 Synced package.json to ${version}`);
	}

	// Sync to versions.json - only when minAppVersion changes
	// See: https://docs.obsidian.md/Reference/Versions
	const versions = JSON.parse(fs.readFileSync("versions.json", "utf8"));
	const existingMinVersions = Object.values(versions);
	const latestMinVersion = existingMinVersions[existingMinVersions.length - 1];
	const minAppVersion = manifest.minAppVersion;
	
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

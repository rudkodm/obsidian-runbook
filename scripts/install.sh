#!/bin/bash

# Install plugin to Obsidian vault
# Set OBSIDIAN_PLUGINS_HOME in your shell profile, e.g.:
#   export OBSIDIAN_PLUGINS_HOME="/Users/you/Documents/Obsidian/MyVault/.obsidian/plugins"

if [ -z "$OBSIDIAN_PLUGINS_HOME" ]; then
	echo "Error: OBSIDIAN_PLUGINS_HOME is not set"
	echo ""
	echo "Set it in your shell profile (~/.zshrc or ~/.bashrc):"
	echo "  export OBSIDIAN_PLUGINS_HOME=\"/path/to/vault/.obsidian/plugins\""
	exit 1
fi

PLUGIN_DIR="$OBSIDIAN_PLUGINS_HOME/runbook"

# Create plugin directory
mkdir -p "$PLUGIN_DIR"

# Copy plugin files
cp manifest.json "$PLUGIN_DIR/"
cp main.js "$PLUGIN_DIR/"
cp styles.css "$PLUGIN_DIR/"

# Create .hotreload file for hot-reload plugin
touch "$PLUGIN_DIR/.hotreload"

echo "Plugin installed to: $PLUGIN_DIR"
echo ""
echo "Next steps:"
echo "1. Restart Obsidian (or reload plugins)"
echo "2. Go to Settings → Community plugins"
echo "3. Enable 'Runbook'"
echo "4. Open Command Palette (Cmd+P) and search for 'Test:'"

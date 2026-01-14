#!/bin/bash

# Install plugin to Obsidian vault
PLUGIN_DIR="/Users/drudko/Documents/Obsedian/IAS/.obsidian/plugins/obsidian-runbook"

# Create plugin directory
mkdir -p "$PLUGIN_DIR"

# Copy plugin files
cp manifest.json "$PLUGIN_DIR/"
cp main.js "$PLUGIN_DIR/"

echo "Plugin installed to: $PLUGIN_DIR"
echo ""
echo "Next steps:"
echo "1. Restart Obsidian (or reload plugins)"
echo "2. Go to Settings → Community plugins"
echo "3. Enable 'Runbook'"
echo "4. Open Command Palette (Cmd+P) and search for 'Test:'"

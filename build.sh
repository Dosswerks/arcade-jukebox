#!/bin/bash
# Dosswerks Arcade Jukebox - Build Script
# Concatenates modular source files into a single deployable index.html
#
# Usage: bash build.sh
# Output: index.html (standalone, no external dependencies except tracks.js)

set -e

OUTPUT="index.html"
SRC_DIR="src"

echo "Building Dosswerks Arcade Jukebox..."

# Start HTML document
cat > "$OUTPUT" << 'HTMLHEAD'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>Dosswerks Arcade Jukebox</title>
    <style>
HTMLHEAD

# Inline CSS
if [ -f "$SRC_DIR/styles.css" ]; then
    cat "$SRC_DIR/styles.css" >> "$OUTPUT"
fi

echo "    </style>" >> "$OUTPUT"
echo "</head>" >> "$OUTPUT"

# HTML body from template
if [ -f "$SRC_DIR/index.html" ]; then
    cat "$SRC_DIR/index.html" >> "$OUTPUT"
fi

# Start inline script block
cat >> "$OUTPUT" << 'SCRIPTOPEN'
    <script>
    (function() {
    'use strict';
SCRIPTOPEN

# Concatenate JS modules in dependency order
# Strip 'export ' and 'import ...' lines for concatenated build
JS_MODULES=(
    "title-deriver.js"
    "natural-sort.js"
    "url-parser.js"
    "dom-sanitization.js"
    "time-formatter.js"
    "game-filter.js"
    "persistence-manager.js"
    "playback-state-machine.js"
    "shuffle-engine.js"
    "audio-pipeline.js"
    "id3-parser.js"
    "manifest-processor.js"
    "player-engine.js"
    "song-list-renderer.js"
    "ui-controller.js"
    "animation-controller.js"
    "visibility-controller.js"
    "keyboard-navigation.js"
    "touch-handler.js"
    "app-initializer.js"
)

for module in "${JS_MODULES[@]}"; do
    if [ -f "$SRC_DIR/$module" ]; then
        echo "" >> "$OUTPUT"
        echo "    // === $(echo "$module" | sed 's/\.js$//' | tr '-' ' ' | tr '[:lower:]' '[:upper:]') ===" >> "$OUTPUT"
        # Strip import/export statements for concatenated build
        sed -e '/^import /d' -e 's/^export //g' "$SRC_DIR/$module" >> "$OUTPUT"
    fi
done

# Close script and HTML
cat >> "$OUTPUT" << 'HTMLEND'

    })();
    </script>
</body>
</html>
HTMLEND

echo "Build complete: $OUTPUT ($(wc -c < "$OUTPUT" | tr -d ' ') bytes)"

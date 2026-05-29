#!/bin/bash
set -e

echo "📦 Starting Native macOS App Bundle Packaging..."

APP_NAME="Cameleer Engine"
APP_DIR="Cameleer Engine.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

# 1. Create directory structures
echo "📁 Generating bundle directory trees..."
rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"

# 2. Write Info.plist
echo "📋 Generating Info.plist..."
cat << 'EOF' > "$CONTENTS_DIR/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>com.cameleer.engine</string>
    <key>CFBundleName</key>
    <string>Cameleer Engine</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.12</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

# 3. Write PkgInfo
echo "APPL????" > "$CONTENTS_DIR/PkgInfo"

# 4. Compile Cocoa Objective-C app launcher
echo "🚀 Compiling macOS Cocoa Objective-C app launcher..."
clang -O3 -framework Cocoa -framework WebKit main.m -o "$MACOS_DIR/launcher"

# 5. Compile multi-resolution Dock AppIcon.icns
echo "🎨 Converting and processing custom app icon using sips and iconutil..."
ICON_PNG="/Users/timtoole/.gemini/antigravity/brain/8cbee403-b081-408f-9913-f6604ac52203/cameleer_icon_1780001756226.png"
if [ -f "$ICON_PNG" ]; then
    rm -rf AppIcon.iconset
    mkdir -p AppIcon.iconset
    
    # Convert source image to genuine PNG first to clear format warnings
    sips -s format png "$ICON_PNG" --out icon_converted.png > /dev/null 2>&1
    
    # Resize multi-resolution sizes for macOS Dock standard
    sips -z 16 16     icon_converted.png --out AppIcon.iconset/icon_16x16.png > /dev/null 2>&1
    sips -z 32 32     icon_converted.png --out AppIcon.iconset/icon_16x16@2x.png > /dev/null 2>&1
    sips -z 32 32     icon_converted.png --out AppIcon.iconset/icon_32x32.png > /dev/null 2>&1
    sips -z 64 64     icon_converted.png --out AppIcon.iconset/icon_32x32@2x.png > /dev/null 2>&1
    sips -z 128 128   icon_converted.png --out AppIcon.iconset/icon_128x128.png > /dev/null 2>&1
    sips -z 256 256   icon_converted.png --out AppIcon.iconset/icon_128x128@2x.png > /dev/null 2>&1
    sips -z 256 256   icon_converted.png --out AppIcon.iconset/icon_256x256.png > /dev/null 2>&1
    sips -z 512 512   icon_converted.png --out AppIcon.iconset/icon_256x256@2x.png > /dev/null 2>&1
    sips -z 512 512   icon_converted.png --out AppIcon.iconset/icon_512x512.png > /dev/null 2>&1
    sips -z 1024 1024 icon_converted.png --out AppIcon.iconset/icon_512x512@2x.png > /dev/null 2>&1
    
    # Compile using built-in iconutil tool
    iconutil -c icns AppIcon.iconset
    mv AppIcon.icns "$RESOURCES_DIR/"
    rm -rf AppIcon.iconset
    rm -f icon_converted.png
    echo "✅ AppIcon.icns compiled successfully!"
else
    echo "⚠️  App icon PNG not found at $ICON_PNG, using default system icon."
fi

# 6. Copy compiled release binaries
echo "🦀 Copying compiled Rust binaries to application bundle..."
RELEASE_BIN="target/release/cameleer"
GLOBAL_BIN="/Volumes/SSK Drive/Cameleer/cargo-targets/global/release/cameleer"

if [ -f "$GLOBAL_BIN" ]; then
    cp "$GLOBAL_BIN" "$MACOS_DIR/cameleer"
    chmod +x "$MACOS_DIR/cameleer"
    echo "✅ Production master binary installed from global target cache!"
elif [ -f "$RELEASE_BIN" ]; then
    cp "$RELEASE_BIN" "$MACOS_DIR/cameleer"
    chmod +x "$MACOS_DIR/cameleer"
    echo "✅ Production master binary installed from local target!"
else
    echo "❌ Release master binary not found. Please compile first using 'cargo build --release'."
    exit 1
fi

CAMELID_BIN="target/release/camelid"
GLOBAL_CAMELID_BIN="/Volumes/SSK Drive/Cameleer/cargo-targets/global/release/camelid"
ALT_CAMELID_BIN="camelid/target/release/camelid"

if [ -f "$GLOBAL_CAMELID_BIN" ]; then
    cp "$GLOBAL_CAMELID_BIN" "$MACOS_DIR/camelid"
    chmod +x "$MACOS_DIR/camelid"
    echo "✅ Camelid local inference binary installed from global target cache!"
elif [ -f "$CAMELID_BIN" ]; then
    cp "$CAMELID_BIN" "$MACOS_DIR/camelid"
    chmod +x "$MACOS_DIR/camelid"
    echo "✅ Camelid local inference binary installed from local target!"
elif [ -f "$ALT_CAMELID_BIN" ]; then
    cp "$ALT_CAMELID_BIN" "$MACOS_DIR/camelid"
    chmod +x "$MACOS_DIR/camelid"
    echo "✅ Camelid local inference binary installed from workspace path!"
else
    echo "❌ Camelid binary not found. Please compile first using 'cargo build --release'."
    exit 1
fi

# 7. Copy App bundle to Desktop
echo "🚚 Copying finished app bundle to Desktop..."
rm -rf "/Users/timtoole/Desktop/Cameleer Engine.app"
cp -R "Cameleer Engine.app" "/Users/timtoole/Desktop/"
echo "✨ Native macOS app deployed to '/Users/timtoole/Desktop/Cameleer Engine.app'!"

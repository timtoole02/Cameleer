#!/bin/bash
set -e
export COPYFILE_DISABLE=1

echo "📦 Starting Cameleer Production Build..."

echo "🦀 Running Cargo Check..."
cd control-center/src-tauri
cargo check
cd ../..

echo "🌐 Building Frontend..."
cd control-center
npm install
npm run build
cd ..

echo "🖥️ Packaging Mac App Bundle..."
cd control-center
npm run tauri build

echo "✅ Build Complete! App bundle is located in control-center/src-tauri/target/release/bundle/mac/"

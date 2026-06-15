/**
 * webOS packaging script
 * Copies appinfo.json into dist/webos and packages as .ipk
 *
 * Prerequisites:
 *   npm install -g @webos-tools/cli
 *
 * Usage:
 *   npm run build:webos
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const distDir = path.resolve(__dirname, '../../dist/webos')
const appInfoSrc = path.resolve(__dirname, 'appinfo.json')

fs.copyFileSync(appInfoSrc, path.join(distDir, 'appinfo.json'))

const iconSrc = path.resolve(__dirname, '../../public/icon.png')
if (fs.existsSync(iconSrc)) {
  fs.copyFileSync(iconSrc, path.join(distDir, 'icon.png'))
}

try {
  execSync(`ares-package "${distDir}" -o "${path.resolve(__dirname, '../../dist')}"`, { stdio: 'inherit' })
  console.log('webOS .ipk package created successfully')
} catch {
  console.log('webOS CLI not found. Files are ready in dist/webos — package manually using webOS CLI (ares-package).')
}

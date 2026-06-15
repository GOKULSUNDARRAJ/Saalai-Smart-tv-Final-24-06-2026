/**
 * Tizen packaging script
 * Copies config.xml and icon into dist/tizen, then invokes tizen CLI to create .wgt
 *
 * Prerequisites:
 *   npm install -g @tizen/tizen-studio-cli  (or use Tizen Studio IDE)
 *
 * Usage:
 *   npm run build:tizen
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const distDir = path.resolve(__dirname, '../../dist/tizen')
const configSrc = path.resolve(__dirname, 'config.xml')

fs.copyFileSync(configSrc, path.join(distDir, 'config.xml'))

const iconSrc = path.resolve(__dirname, '../../public/icon.png')
if (fs.existsSync(iconSrc)) {
  fs.copyFileSync(iconSrc, path.join(distDir, 'icon.png'))
}

try {
  execSync(`C:\\tizen-studio\\tools\\ide\\bin\\tizen.bat package -t wgt -s SaalaiTV2 -- "${distDir}"`, { stdio: 'inherit' })
  console.log('Tizen .wgt package created successfully')
} catch {
  console.log('Tizen CLI not found. Files are ready in dist/tizen — package manually using Tizen Studio.')
}

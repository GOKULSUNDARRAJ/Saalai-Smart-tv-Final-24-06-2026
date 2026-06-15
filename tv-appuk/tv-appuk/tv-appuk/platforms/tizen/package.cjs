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

const indexPath = path.join(distDir, 'index.html')
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8')
  html = html.replace(
    /content="width=[^"]*"/,
    'content="width=960, initial-scale=2.0, maximum-scale=2.0, user-scalable=no"'
  )
  html = html.replace(/<script type="module" crossorigin/g, '<script defer')
  html = html.replace(/<script type="module"/g, '<script defer')
  html = html.replace(/ crossorigin/g, '')
  html = html.replace(/<link rel="modulepreload"[^>]*>/g, '')
  fs.writeFileSync(indexPath, html)
}

const iconSrc = path.resolve(__dirname, 'icon.png')
if (fs.existsSync(iconSrc)) {
  fs.copyFileSync(iconSrc, path.join(distDir, 'icon.png'))
}

const tizenCli =
  fs.existsSync('C:\\tizen-studio\\tools\\ide\\bin\\tizen.bat')
    ? 'C:\\tizen-studio\\tools\\ide\\bin\\tizen.bat'
    : 'tizen'

const outDir = path.resolve(__dirname, '../../dist/tizen-pkg')
fs.mkdirSync(outDir, { recursive: true })

try {
  execSync(`"${tizenCli}" package -t wgt -s SaalaiTV2 -o "${outDir}" -- "${distDir}"`, { stdio: 'inherit' })
  const wgtSpaced = path.join(outDir, 'Saalai TV.wgt')
  const wgtFinal = path.join(outDir, 'SaalaiTV.wgt')
  if (fs.existsSync(wgtSpaced)) fs.copyFileSync(wgtSpaced, wgtFinal)
  console.log('Tizen .wgt package created: ' + wgtFinal)
} catch {
  console.log('Tizen CLI not found. Files are ready in dist/tizen — package manually using Tizen Studio.')
}

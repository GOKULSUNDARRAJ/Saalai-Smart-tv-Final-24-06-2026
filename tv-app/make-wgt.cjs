const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const distTizen = path.resolve(__dirname, 'dist/tizen')
const outWgt = path.resolve(__dirname, 'dist/TVApp.wgt')
const outZip = path.resolve(__dirname, 'dist/TVApp.zip')

if (!fs.existsSync(distTizen)) {
  console.error('dist/tizen not found. Run npm run build:tizen first.')
  process.exit(1)
}

if (fs.existsSync(outWgt)) fs.unlinkSync(outWgt)
if (fs.existsSync(outZip)) fs.unlinkSync(outZip)

function addToZip(zipPath, sourceDir) {
  const files = getAllFiles(sourceDir)
  let created = false
  for (const file of files) {
    const rel = path.relative(sourceDir, file).replace(/\\/g, '/')
    if (!created) {
      execSync(`powershell -NoProfile -Command "Add-Type -A 'System.IO.Compression.FileSystem'; $zip = [System.IO.Compression.ZipFile]::Open('${zipPath}', 'Create'); $zip.Dispose()"`)
      created = true
    }
  }
  execSync(
    `powershell -NoProfile -Command "` +
    `Add-Type -A 'System.IO.Compression.FileSystem'; ` +
    `[System.IO.Compression.ZipFile]::CreateFromDirectory('${sourceDir.replace(/\\/g, '\\\\')}', '${zipPath.replace(/\\/g, '\\\\')}')` +
    `"`
  )
}

function getAllFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) files.push(...getAllFiles(full))
    else files.push(full)
  }
  return files
}

try {
  execSync(
    `powershell -NoProfile -Command "Add-Type -A 'System.IO.Compression.FileSystem'; [System.IO.Compression.ZipFile]::CreateFromDirectory('${distTizen.replace(/\\/g, '\\\\')}', '${outZip.replace(/\\/g, '\\\\')}')"`,
    { stdio: 'inherit' }
  )
  fs.renameSync(outZip, outWgt)
  const size = Math.round(fs.statSync(outWgt).size / 1024)
  console.log('TVApp.wgt created: dist/TVApp.wgt (' + size + ' KB)')
} catch (e) {
  console.error('Failed:', e.message)
  process.exit(1)
}

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const tvIp = process.argv[2] || '192.168.0.252'
const appId = 'SaalaiTV01.SaalaiTV'
const profile = 'SaalaiTV2'

const TIZEN_CLI_CANDIDATES = [
  'C:\\tizen-studio\\tools\\ide\\bin\\tizen.bat',
  process.env.TIZEN_STUDIO && path.join(process.env.TIZEN_STUDIO, 'tools', 'ide', 'bin', 'tizen.bat'),
].filter(Boolean)

const SDB_CANDIDATES = [
  'C:\\tizen-studio\\tools\\sdb.exe',
  process.env.TIZEN_STUDIO && path.join(process.env.TIZEN_STUDIO, 'tools', 'sdb.exe'),
].filter(Boolean)

const tizenCli = TIZEN_CLI_CANDIDATES.find(p => fs.existsSync(p))
const sdbExe = SDB_CANDIDATES.find(p => fs.existsSync(p))

if (!tizenCli || !sdbExe) {
  console.error('Tizen Studio not found. Set TIZEN_STUDIO env var or install to C:\\tizen-studio')
  process.exit(1)
}

const distDir = path.resolve(__dirname, '../../dist/tizen')
const pkgDir = path.resolve(__dirname, '../../dist/tizen-pkg')
fs.mkdirSync(pkgDir, { recursive: true })

console.log('Packaging with profile:', profile)
execSync(`"${tizenCli}" package -t wgt -s ${profile} -o "${pkgDir}" -- "${distDir}"`, { stdio: 'inherit' })

const wgtSpaced = path.join(pkgDir, 'Saalai TV.wgt')
const wgtFinal = path.join(pkgDir, 'SaalaiTV.wgt')
if (fs.existsSync(wgtSpaced)) fs.copyFileSync(wgtSpaced, wgtFinal)

if (!fs.existsSync(wgtFinal)) {
  console.error('Package not found:', wgtFinal)
  process.exit(1)
}

console.log('Connecting to TV at', tvIp)
execSync(`"${sdbExe}" connect ${tvIp}`, { stdio: 'inherit' })

const devicesOut = execSync(`"${sdbExe}" devices`, { encoding: 'utf8' })
const deviceLine = devicesOut.split('\n').find(l => l.includes(tvIp))
if (!deviceLine) {
  console.error('TV not found after connect. Is Developer Mode enabled?')
  process.exit(1)
}
const serial = deviceLine.split(/\s+/)[0]
console.log('Device:', serial)

console.log('Installing...')
execSync(`"${tizenCli}" install -n SaalaiTV.wgt -s ${serial} -- "${pkgDir}"`, { stdio: 'inherit' })

console.log('Launching...')
execSync(`"${tizenCli}" run -p ${appId} -s ${serial}`, { stdio: 'inherit' })

console.log('\nApp deployed and launched on Samsung TV.')

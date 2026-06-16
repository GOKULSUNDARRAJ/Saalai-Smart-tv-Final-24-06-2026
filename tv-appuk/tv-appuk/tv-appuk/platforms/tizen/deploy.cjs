const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const appId = 'SaalaiTV01.SaalaiTV'

const TV_LIST = [
  { ip: '192.168.0.202', profile: 'SaalaiTV2' },
  { ip: '192.168.0.203', profile: 'SaalaiTV3' },
  { ip: '192.168.0.204', profile: 'SaalaiTV3' },
]

const targetIps = process.argv.slice(2)
const tvs = targetIps.length > 0
  ? targetIps.map(ip => {
      const found = TV_LIST.find(t => t.ip === ip)
      return found || { ip, profile: 'SaalaiTV2' }
    })
  : TV_LIST

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

function buildWgt(profile) {
  console.log(`\nPackaging with profile: ${profile}`)
  const wgtSpaced = path.join(pkgDir, 'Saalai TV.wgt')
  const wgtFinal = path.join(pkgDir, 'SaalaiTV.wgt')
  if (fs.existsSync(wgtSpaced)) fs.rmSync(wgtSpaced)
  if (fs.existsSync(wgtFinal)) fs.rmSync(wgtFinal)
  execSync(`"${tizenCli}" package -t wgt -s ${profile} -o "${pkgDir}" -- "${distDir}"`, { stdio: 'inherit' })
  if (fs.existsSync(wgtSpaced)) fs.copyFileSync(wgtSpaced, wgtFinal)
  if (!fs.existsSync(wgtFinal)) {
    throw new Error(`Package not created for profile ${profile}`)
  }
  return wgtFinal
}

function deployToTv(ip, profile) {
  console.log(`\n${'='.repeat(50)}`)
  console.log(`Deploying to TV: ${ip}  (profile: ${profile})`)
  console.log('='.repeat(50))

  buildWgt(profile)

  console.log(`Connecting to ${ip}...`)
  execSync(`"${sdbExe}" connect ${ip}`, { stdio: 'inherit' })

  const devicesOut = execSync(`"${sdbExe}" devices`, { encoding: 'utf8' })
  const deviceLine = devicesOut.split('\n').find(l => l.includes(ip))
  if (!deviceLine) {
    throw new Error(`TV at ${ip} not found. Is Developer Mode enabled?`)
  }
  const serial = deviceLine.split(/\s+/)[0]
  console.log(`Device serial: ${serial}`)

  console.log('Installing...')
  execSync(`"${tizenCli}" install -n SaalaiTV.wgt -s ${serial} -- "${pkgDir}"`, { stdio: 'inherit' })

  console.log('Launching...')
  execSync(`"${tizenCli}" run -p ${appId} -s ${serial}`, { stdio: 'inherit' })

  console.log(`\nApp deployed and launched on ${ip}`)
}

const results = []
for (const tv of tvs) {
  try {
    deployToTv(tv.ip, tv.profile)
    results.push({ ip: tv.ip, status: 'SUCCESS' })
  } catch (err) {
    console.error(`\nFailed to deploy to ${tv.ip}: ${err.message}`)
    results.push({ ip: tv.ip, status: 'FAILED', error: err.message })
  }
}

console.log('\n' + '='.repeat(50))
console.log('DEPLOYMENT SUMMARY')
console.log('='.repeat(50))
for (const r of results) {
  console.log(`  ${r.ip}: ${r.status}${r.error ? ' - ' + r.error : ''}`)
}
const failed = results.filter(r => r.status === 'FAILED')
if (failed.length > 0) process.exit(1)

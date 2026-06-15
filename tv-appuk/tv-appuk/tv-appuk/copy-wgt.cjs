const fs = require('fs')
const src = __dirname + '/dist/tizen/Saalai TV.wgt'
const dst = __dirname + '/dist/SaalaiTV.wgt'
if (!fs.existsSync(src)) { console.error('Source not found:', src); process.exit(1) }
fs.copyFileSync(src, dst)
const size = Math.round(fs.statSync(dst).size / 1024)
console.log('Copied to dist/SaalaiTV.wgt (' + size + ' KB)')

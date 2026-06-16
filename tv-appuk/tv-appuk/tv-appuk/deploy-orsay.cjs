const fs = require('fs');
const http = require('http');
const path = require('path');

const hostIp = '192.168.0.188'; // My host IP
const port = 80;

const distDir = path.resolve(__dirname, 'dist');
const zipFile = path.resolve(distDir, 'SaalaiTV.zip');
const tizenPkgDir = path.resolve(__dirname, 'dist/tizen');

// We need to create a zip file for Orsay
const { execSync } = require('child_process');

if (fs.existsSync(zipFile)) {
    fs.unlinkSync(zipFile);
}

console.log('Creating ZIP package for Orsay...');
execSync(`powershell -NoProfile -Command "Add-Type -A 'System.IO.Compression.FileSystem'; [System.IO.Compression.ZipFile]::CreateFromDirectory('${tizenPkgDir.replace(/\\/g, '\\\\')}', '${zipFile.replace(/\\/g, '\\\\')}')"`);
const stat = fs.statSync(zipFile);
console.log(`Created ${zipFile} (${stat.size} bytes)`);

const widgetlist = `<?xml version="1.0" encoding="UTF-8"?>
<rsp stat="ok">
    <list>
        <widget id="SaalaiTV">
            <title>Saalai TV</title>
            <compression size="${stat.size}" type="zip"/>
            <description>Saalai TV App</description>
            <download>http://${hostIp}:${port}/SaalaiTV.zip</download>
        </widget>
    </list>
</rsp>`;

fs.writeFileSync(path.resolve(distDir, 'widgetlist.xml'), widgetlist);
console.log('Created widgetlist.xml');

const server = http.createServer((req, res) => {
    console.log(`Request: ${req.url}`);
    if (req.url === '/widgetlist.xml') {
        res.writeHead(200, { 'Content-Type': 'application/xml' });
        res.end(widgetlist);
    } else if (req.url === '/SaalaiTV.zip') {
        res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': stat.size });
        const stream = fs.createReadStream(zipFile);
        stream.pipe(res);
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(port, '0.0.0.0', () => {
    console.log(`\n===============================================================`);
    console.log(`Orsay TV Sync Server running at http://${hostIp}:${port}/`);
    console.log(`\nTo install on your TV (Model UA32H4570FUXXL):`);
    console.log(`1. Press Menu/Smart Hub on remote`);
    console.log(`2. Log in with username 'develop' (leave password blank)`);
    console.log(`3. Go to More Apps -> Options -> IP Setting`);
    console.log(`4. Enter ${hostIp}`);
    console.log(`5. Click 'Start App Sync'`);
    console.log(`===============================================================\n`);
});

const fs = require('fs');
const glob = require('glob');

glob.sync('src/**/*.{ts,tsx}').forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  if (c.includes('https://thirai.net/smartapi_v1') && !f.includes('apiUtils')) {
    // Replace API endpoints
    c = c.replace(/'https:\/\/thirai\.net\/smartapi_v1/g, 'BASE_URL + \'');
    c = c.replace(/`https:\/\/thirai\.net\/smartapi_v1/g, '`${BASE_URL}');
    
    if (!c.includes('BASE_URL')) {
      const depth = f.split('/').length - 2;
      const up = depth > 0 ? '../'.repeat(depth) : './';
      c = `import { BASE_URL } from '${up}apiUtils';\n` + c;
    }
    fs.writeFileSync(f, c);
  }
});

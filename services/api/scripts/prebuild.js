const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Find monorepo root directory containing root package.json with workspaces
let dir = __dirname;
while (dir !== path.dirname(dir)) {
  const p = path.join(dir, 'package.json');
  if (fs.existsSync(p)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (pkg.workspaces) break;
    } catch {}
  }
  dir = path.dirname(dir);
}

console.log('[prebuild] Building shared workspace packages from monorepo root:', dir);
execSync('npm run build:packages', { cwd: dir, stdio: 'inherit' });

const fs = require('fs');
const path = require('path');

const now = Date.now();
function findRecentFiles(dir, depth = 0) {
  if (depth > 6) return [];
  let files = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      if (file === 'node_modules' || file === '.git' || file === 'proc' || file === 'sys' || file === 'dev' || file === 'boot') continue;
      const fullPath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
         files = files.concat(findRecentFiles(fullPath, depth + 1));
      } else {
         const age = now - stat.mtimeMs;
         if (age < 20 * 60 * 1000) { // 20 minutes
           files.push(`${fullPath} (${stat.size} bytes, modified ${Math.round(age/1000)}s ago)`);
         }
      }
    }
  } catch {
    // ignore
  }
  return files;
}

console.log("=== ALL RECENT FILES SYSTEM-WIDE ===");
console.log(findRecentFiles('/').join('\n'));

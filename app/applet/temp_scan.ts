import fs from 'fs';
import path from 'path';

const now = Date.now();
function findRecent(dir: string, depth = 0) {
  if (depth > 5) return [];
  let files: string[] = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      if (['node_modules', '.git', 'proc', 'sys', 'dev', 'boot', 'dist'].includes(file)) continue;
      const fullPath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
         files = files.concat(findRecent(fullPath, depth + 1));
      } else {
         const age = now - stat.mtimeMs;
         if (age < 30 * 60 * 1000) { // 30 minutes
           files.push(`${fullPath} (${stat.size} bytes, modified ${Math.round(age/1000)}s ago)`);
         }
      }
    }
  } catch {
    // ignore
  }
  return files;
}

console.log("=== NEWLY MODIFIED FILES ===");
console.log(findRecent('/').join('\n'));

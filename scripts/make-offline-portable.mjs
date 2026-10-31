import fs from 'node:fs';
import path from 'node:path';

const OFFLINE_DIR = path.resolve('mubattu_offline');

function getAllHtmlFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllHtmlFiles(fullPath));
    } else if (file.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

const htmlFiles = getAllHtmlFiles(OFFLINE_DIR);
console.log(`Đang chuẩn hóa đường dẫn tương đối cho ${htmlFiles.length} file HTML...`);

for (const filePath of htmlFiles) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Calculate relative prefix back to OFFLINE_DIR root
  const relDir = path.relative(path.dirname(filePath), OFFLINE_DIR).replace(/\\/g, '/');
  const prefix = relDir ? `${relDir}/` : './';

  // Fix /ss6-assets/
  content = content.replace(/([\"'\(])\/ss6-assets\//g, `$1${prefix}ss6-assets/`);
  
  // Fix /favicon.ico and /apple-touch-icon.png
  content = content.replace(/([\"'])\/favicon\.ico/g, `$1${prefix}favicon.ico`);
  content = content.replace(/([\"'])\/apple-touch-icon\.png/g, `$1${prefix}apple-touch-icon.png`);

  // Fix internal links like href="/tin-tuc/" -> href="prefix + tin-tuc/index.html"
  content = content.replace(/href=["']\/([a-zA-Z0-9_\-]+)\/["']/g, (m, slug) => {
    return `href="${prefix}${slug}/index.html"`;
  });
  content = content.replace(/href=["']\/["']/g, `href="${prefix}index.html"`);

  fs.writeFileSync(filePath, content, 'utf-8');
}

console.log('✓ Đã chuẩn hóa toàn bộ file HTML để có thể mở trực tiếp (double-click) trong trình duyệt!');

import fs from 'node:fs';
import path from 'node:path';

const dataBuffer = fs.readFileSync('MuGame.data');
const jsCode = fs.readFileSync('MuGame.js', 'utf-8');

const match = jsCode.match(/loadPackage\(\{files:(\[.*?\]),remote_package_size:/);
if (!match) {
  console.error('Không tìm thấy danh sách tệp trong MuGame.js');
  process.exit(1);
}

const files = eval(match[1]);
const outDir = path.resolve('MuGame_extracted');
fs.mkdirSync(outDir, { recursive: true });

console.log(`Bắt đầu trích xuất ${files.length} tệp từ MuGame.data sang ${outDir}...`);

for (const file of files) {
  const relPath = file.filename.replace(/^\/+/, '');
  const destPath = path.join(outDir, relPath);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  
  const chunk = dataBuffer.subarray(file.start, file.end);
  fs.writeFileSync(destPath, chunk);
  console.log(`  [✓] Trích xuất: ${relPath} (${chunk.length} bytes)`);
}

console.log('🎉 Trích xuất hoàn tất!');

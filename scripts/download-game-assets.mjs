import fs from 'node:fs';
import path from 'node:path';

const CDN_BASE = 'https://elfcheat.com/ss4/Mobile/';
const TARGET_DIR = path.resolve('mubattu_offline/game/Mobile');

fs.mkdirSync(TARGET_DIR, { recursive: true });

async function downloadFile(relPath, expectedSize) {
  const destPath = path.join(TARGET_DIR, relPath);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  if (fs.existsSync(destPath)) {
    const stat = fs.statSync(destPath);
    if (stat.size === expectedSize || (!expectedSize && stat.size > 0)) {
      console.log(`  [✓] Đã có sẵn: ${relPath} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
      return;
    }
  }

  const url = CDN_BASE + relPath;
  console.log(`  [↓] Đang tải: ${relPath} (${(expectedSize / (1024 * 1024)).toFixed(2)} MB)...`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(destPath, buf);
      console.log(`  [✓] Hoàn tất: ${relPath} (${(buf.length / (1024 * 1024)).toFixed(2)} MB)`);
      return;
    } catch (err) {
      console.warn(`  [!] Thử lại lần ${attempt} cho ${relPath}: ${err.message}`);
      if (attempt === 3) throw err;
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
}

async function main() {
  console.log('=== BẮT ĐẦU TẢI TRỌN BỘ 400MB DỮ LIỆU GAME (ASSETS .YAN) ===');
  console.log(`Thư mục lưu trữ: ${TARGET_DIR}\n`);

  // 1. Download mobile.manifest
  console.log('[*] Tải mobile.manifest...');
  const res = await fetch(CDN_BASE + 'mobile.manifest', { cache: 'no-store' });
  if (!res.ok) throw new Error('Không thể tải mobile.manifest: ' + res.status);
  const manifestText = await res.text();
  fs.writeFileSync(path.join(TARGET_DIR, 'mobile.manifest'), manifestText);
  console.log('[✓] Đã lưu mobile.manifest\n');

  // 2. Parse lines
  const lines = manifestText.split(/\r?\n/);
  const files = [];
  for (const line of lines) {
    if (!line || line.startsWith('#') || !line.includes('|')) continue;
    const parts = line.split('|');
    if (parts.length >= 3) {
      files.push({
        path: parts[0].trim(),
        crc: parts[1].trim(),
        size: parseInt(parts[2].trim(), 10)
      });
    }
  }

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  console.log(`Tìm thấy ${files.length} gói dữ liệu, tổng dung lượng: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB\n`);

  // 3. Download files sequentially
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    console.log(`[${i + 1}/${files.length}] Xử lý: ${f.path}`);
    await downloadFile(f.path, f.size);
  }

  console.log('\n==================================================');
  console.log('🎉 TẢI THÀNH CÔNG TRỌN BỘ 425MB DỮ LIỆU GAME!');
  console.log(`Vị trí: ${TARGET_DIR}`);
  console.log('==================================================');
}

main().catch(err => {
  console.error('Lỗi khi tải dữ liệu game:', err);
  process.exit(1);
});

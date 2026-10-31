import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = 'https://mubattu.info';
const OUTPUT_DIR = path.resolve('mubattu_offline');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const downloadedAssets = new Set();

async function fetchWithRetry(url, isBinary = false, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return isBinary ? Buffer.from(await res.arrayBuffer()) : await res.text();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

async function getSitemapUrls() {
  console.log('[*] Đang đọc sitemap.xml...');
  try {
    const xml = await fetchWithRetry(`${BASE_URL}/sitemap.xml`);
    const locMatches = [...xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)];
    const urls = locMatches.map(m => m[1].trim());
    console.log(`[✓] Đã tìm thấy ${urls.length} trang từ sitemap.`);
    return urls;
  } catch (e) {
    console.warn('[!] Không thể tải sitemap.xml, sử dụng trang chủ mặc định.', e.message);
    return [`${BASE_URL}/`];
  }
}

function extractAssets(html, pageUrl) {
  const assets = new Set();
  
  const patterns = [
    /(?:src|href)=["']([^"']+\.(?:png|jpg|jpeg|webp|gif|svg|ico|css|js|woff2|woff|ttf|json|mp3|ogg|wav))(?:\?[^"']*)?["']/gi,
    /url\(['"]?([^'"()]+\.(?:png|jpg|jpeg|webp|gif|svg|ico|woff2|woff|ttf))(?:\?[^'")]*)?['"]?\)/gi,
    /(?:data-src|srcset)=["']([^"']+)["']/gi
  ];

  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(html)) !== null) {
      const val = match[1];
      if (val.includes(',')) {
        const parts = val.split(',').map(p => p.trim().split(/\s+/)[0]);
        for (const p of parts) if (p) assets.add(p);
      } else {
        assets.add(val);
      }
    }
  }

  return [...assets];
}

async function downloadAsset(assetPath, referrer = '') {
  if (downloadedAssets.has(assetPath)) return;
  downloadedAssets.add(assetPath);

  let fullUrl = assetPath;
  if (assetPath.startsWith('//')) {
    fullUrl = 'https:' + assetPath;
  } else if (assetPath.startsWith('/')) {
    fullUrl = BASE_URL + assetPath;
  } else if (!assetPath.startsWith('http')) {
    if (referrer && referrer.includes('/game/')) {
      fullUrl = `${BASE_URL}/game/${assetPath}`;
    } else {
      fullUrl = `${BASE_URL}/${assetPath}`;
    }
  }

  try {
    const parsed = new URL(fullUrl);
    if (parsed.hostname !== 'mubattu.info' && !parsed.hostname.includes('mubattu')) {
      return;
    }

    const cleanPath = parsed.pathname.replace(/^\/+/, '');
    const localFilePath = path.join(OUTPUT_DIR, cleanPath);
    const localFileDir = path.dirname(localFilePath);

    if (!fs.existsSync(localFileDir)) {
      fs.mkdirSync(localFileDir, { recursive: true });
    }

    if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).size > 0) {
      return;
    }

    console.log(`  [↓] Tải asset: ${parsed.pathname}`);
    const data = await fetchWithRetry(fullUrl, true);
    fs.writeFileSync(localFilePath, data);
  } catch (err) {
    console.warn(`  [!] Lỗi khi tải asset ${assetPath}:`, err.message);
  }
}

async function main() {
  const includeGame = process.argv.includes('--include-game');
  console.log('=== BẮT ĐẦU TẢI TÀI NGUYÊN MUBATTU.INFO ===');
  console.log(`Thư mục lưu trữ: ${OUTPUT_DIR}`);
  console.log(`Tùy chọn tải Game Client (WASM/Data): ${includeGame ? 'BẬT' : 'TẮT'}`);

  const pageUrls = await getSitemapUrls();
  if (!pageUrls.includes(`${BASE_URL}/play/`)) pageUrls.push(`${BASE_URL}/play/`);
  if (!pageUrls.includes(`${BASE_URL}/game/`)) pageUrls.push(`${BASE_URL}/game/`);

  for (const pageUrl of pageUrls) {
    try {
      const parsed = new URL(pageUrl);
      let pagePath = parsed.pathname;
      if (pagePath.endsWith('/')) {
        pagePath += 'index.html';
      } else if (!path.extname(pagePath)) {
        pagePath += '/index.html';
      }
      pagePath = pagePath.replace(/^\/+/, '');

      const localHtmlPath = path.join(OUTPUT_DIR, pagePath);
      const localHtmlDir = path.dirname(localHtmlPath);
      if (!fs.existsSync(localHtmlDir)) {
        fs.mkdirSync(localHtmlDir, { recursive: true });
      }

      let html;
      if (fs.existsSync(localHtmlPath) && fs.statSync(localHtmlPath).size > 0) {
        html = fs.readFileSync(localHtmlPath, 'utf-8');
      } else {
        console.log(`\n[*] Đang tải trang: ${pageUrl}`);
        html = await fetchWithRetry(pageUrl);
        fs.writeFileSync(localHtmlPath, html, 'utf-8');
        console.log(`    [✓] Đã lưu: ${pagePath}`);
      }

      // Extract and download assets
      const assets = extractAssets(html, pageUrl);
      for (const asset of assets) {
        await downloadAsset(asset, pageUrl);
      }
    } catch (err) {
      console.error(`[!] Lỗi xử lý ${pageUrl}:`, err.message);
    }
  }

  if (includeGame) {
    console.log('\n[*] Bắt đầu tải các tệp Game WebAssembly & Client Data...');
    const gameFiles = [
      'https://mubattu.info/game/MuGame.js?v=15e1e87a',
      'https://mubattu.info/game/MuGame.wasm?v=d47c719a',
      'https://mubattu.info/game/MuGame.data?v=9f84630d',
      'https://mubattu.info/game/ns/MuGame.js?v=d29f5715',
      'https://mubattu.info/game/ns/MuGame.wasm?v=be66e469',
      'https://mubattu.info/game/boot_bg.jpg',
      'https://mubattu.info/game/manifest.webmanifest'
    ];

    for (const gf of gameFiles) {
      try {
        const u = new URL(gf);
        const relPath = path.join('game', u.pathname.replace(/^\/game\//, ''));
        const targetPath = path.join(OUTPUT_DIR, relPath);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });

        if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) {
          console.log(`  [✓] Đã có sẵn: ${relPath} (${(fs.statSync(targetPath).size / (1024 * 1024)).toFixed(2)} MB)`);
          continue;
        }

        console.log(`  [↓] Đang tải tệp game: ${u.pathname}...`);
        const buf = await fetchWithRetry(gf, true);
        fs.writeFileSync(targetPath, buf);
        console.log(`  [✓] Hoàn tất: ${relPath} (${(buf.length / (1024 * 1024)).toFixed(2)} MB)`);
      } catch (err) {
        console.warn(`  [!] Lỗi khi tải tệp game ${gf}:`, err.message);
      }
    }
  }

  console.log('\n==================================================');
  console.log('🎉 TẢI HOÀN TẤT!');
  console.log(`Toàn bộ tài nguyên đã được lưu tại: ${OUTPUT_DIR}`);
  console.log('==================================================');
}

main().catch(err => {
  console.error('Lỗi nghiêm trọng:', err);
  process.exit(1);
});

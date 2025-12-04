/**
 * 下载 Noto Sans SC 字体文件
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const FONT_URL = 'https://fonts.gstatic.com/s/notosanssc/v37/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYlNbPzS5HE.woff2';
const FONT_PATH = path.join(__dirname, 'fonts', 'NotoSansSC-Regular.woff2');

// 确保 fonts 目录存在
const fontsDir = path.join(__dirname, 'fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

console.log('正在下载 Noto Sans SC 字体...');

const file = fs.createWriteStream(FONT_PATH);
https.get(FONT_URL, (response) => {
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('✅ 字体下载完成:', FONT_PATH);
  });
}).on('error', (err) => {
  fs.unlink(FONT_PATH, () => {});
  console.error('❌ 下载失败:', err.message);
});




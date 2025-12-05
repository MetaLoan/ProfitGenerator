const express = require('express');
const { chromium } = require('playwright');
const axios = require('axios');
const https = require('https');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 80;

// ============ 并发控制配置 ============
const MAX_CONCURRENT = process.env.MAX_CONCURRENT || 3;  // 最大并发数
const QUEUE_TIMEOUT = process.env.QUEUE_TIMEOUT || 30000; // 排队超时 30 秒

// 并发控制 - 信号量模式
class ConcurrencyLimiter {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.currentCount = 0;
    this.queue = [];
    this.stats = {
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      queueTimeouts: 0,
      maxQueueLength: 0
    };
  }
  
  async acquire(timeout = QUEUE_TIMEOUT) {
    this.stats.totalRequests++;
    this.stats.maxQueueLength = Math.max(this.stats.maxQueueLength, this.queue.length);
    
    return new Promise((resolve, reject) => {
      const tryAcquire = () => {
        if (this.currentCount < this.maxConcurrent) {
          this.currentCount++;
          resolve();
          return true;
        }
        return false;
      };
      
      if (tryAcquire()) return;
      
      // 加入队列等待
      const queueItem = { resolve, reject, tryAcquire };
      this.queue.push(queueItem);
      
      // 超时处理
      const timeoutId = setTimeout(() => {
        const index = this.queue.indexOf(queueItem);
        if (index > -1) {
          this.queue.splice(index, 1);
          this.stats.queueTimeouts++;
          reject(new Error(`请求排队超时（${timeout/1000}秒），当前队列长度: ${this.queue.length}`));
        }
      }, timeout);
      
      queueItem.timeoutId = timeoutId;
    });
  }
  
  release() {
    this.currentCount--;
    this.stats.completedRequests++;
    
    // 处理队列中的下一个请求
    while (this.queue.length > 0 && this.currentCount < this.maxConcurrent) {
      const next = this.queue.shift();
      if (next.timeoutId) {
        clearTimeout(next.timeoutId);
      }
      if (next.tryAcquire()) {
        next.resolve();
      }
    }
  }
  
  getStats() {
    return {
      ...this.stats,
      currentConcurrent: this.currentCount,
      queueLength: this.queue.length,
      maxConcurrent: this.maxConcurrent
    };
  }
}

const limiter = new ConcurrencyLimiter(MAX_CONCURRENT);
console.log(`🔄 并发控制已启用: 最大 ${MAX_CONCURRENT} 个并发请求`);

// 静态文件服务 - 字体文件
app.use('/fonts', express.static(path.join(__dirname, 'fonts')));

// 字体目录
const FONTS_DIR = path.join(__dirname, 'fonts');

// 生成 base64 字体 CSS（用于 Playwright 渲染）
// 注意：只加载常用字重以节省内存
function generateBase64FontCSS() {
  const fontWeights = [
    { weight: 400, file: 'HarmonyOS_SansSC_Regular.ttf' },
    { weight: 700, file: 'HarmonyOS_SansSC_Bold.ttf' },
  ];
  
  let css = '/* HarmonyOS Sans SC - Base64 Embedded */\n';
  
  for (const { weight, file } of fontWeights) {
    const fontPath = path.join(FONTS_DIR, file);
    if (fs.existsSync(fontPath)) {
      try {
        const fontBuffer = fs.readFileSync(fontPath);
        const base64 = fontBuffer.toString('base64');
        css += `@font-face { font-family: 'HarmonyOS Sans SC'; src: url(data:font/truetype;base64,${base64}) format('truetype'); font-weight: ${weight}; font-style: normal; }\n`;
      } catch (e) {
        console.warn(`警告: 无法读取字体文件 ${file}`);
      }
    }
  }
  
  return css;
}

// 缓存 base64 字体 CSS
let cachedFontCSS = null;
function getBase64FontCSS() {
  if (!cachedFontCSS) {
    console.log('📝 正在生成 base64 字体 CSS...');
    cachedFontCSS = generateBase64FontCSS();
    console.log('✅ Base64 字体 CSS 生成完成');
  }
  return cachedFontCSS;
}

// 交易所配置目录
const EXCHANGES_DIR = path.join(__dirname, 'exchanges');

// 默认交易所
const DEFAULT_EXCHANGE = 'easicoin';

// 允许跨域请求 (CORS)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 创建忽略 SSL 证书的 axios 实例
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

// 交易所配置缓存
const exchangeConfigCache = {};

/**
 * 获取交易所配置
 * @param {string} exchangeId - 交易所 ID，如 'easicoin'
 * @returns {Object} 交易所配置对象
 */
function getExchangeConfig(exchangeId) {
  const exId = exchangeId.toLowerCase();
  
  // 检查缓存
  if (exchangeConfigCache[exId]) {
    return exchangeConfigCache[exId];
  }
  
  const exchangeDir = path.join(EXCHANGES_DIR, exId);
  
  // 检查交易所目录是否存在
  if (!fs.existsSync(exchangeDir)) {
    throw new Error(`交易所 "${exId}" 不存在，请检查 exchanges/${exId} 目录`);
  }
  
  // 加载配置文件
  const configPath = path.join(exchangeDir, 'config.json');
  const modelPath = path.join(exchangeDir, 'model.json');
  
  if (!fs.existsSync(configPath)) {
    throw new Error(`交易所配置文件不存在: exchanges/${exId}/config.json`);
  }
  
  if (!fs.existsSync(modelPath)) {
    throw new Error(`交易所模板文件不存在: exchanges/${exId}/model.json`);
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const model = JSON.parse(fs.readFileSync(modelPath, 'utf-8'));
  
  // 组合配置
  const exchangeConfig = {
    id: exId,
    dir: exchangeDir,
    config,
    model
  };
  
  // 缓存配置
  exchangeConfigCache[exId] = exchangeConfig;
  
  console.log(`✅ 已加载交易所配置: ${config.displayName || exId}`);
  
  return exchangeConfig;
}

/**
 * 获取所有可用的交易所
 * @returns {Array} 交易所列表
 */
function getAvailableExchanges() {
  const exchanges = [];
  
  if (!fs.existsSync(EXCHANGES_DIR)) {
    return exchanges;
  }
  
  const dirs = fs.readdirSync(EXCHANGES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  for (const dir of dirs) {
    try {
      const config = getExchangeConfig(dir);
      exchanges.push({
        id: dir,
        name: config.config.name,
        displayName: config.config.displayName,
        supportedPairs: config.config.supportedPairs
      });
    } catch (e) {
      console.warn(`⚠️ 加载交易所 ${dir} 失败:`, e.message);
    }
  }
  
  return exchanges;
}

// 全局 browser 实例
let browser = null;
let browserInitializing = false;

async function ensureBrowser() {
  // 如果正在初始化，等待完成
  while (browserInitializing) {
    await new Promise(r => setTimeout(r, 100));
  }
  
  // 检查浏览器是否可用
  if (browser) {
    try {
      // 尝试创建一个测试 context 来验证浏览器是否可用
      const testContext = await browser.newContext();
      await testContext.close();
      return browser;
    } catch (e) {
      console.log('⚠️  浏览器不可用，重新启动...', e.message);
      try {
        await browser.close().catch(() => {});
      } catch (e2) {}
      browser = null;
    }
  }
  
  // 初始化新浏览器
  if (!browser) {
    browserInitializing = true;
    try {
      console.log('🚀 正在启动 Playwright 浏览器...');
      
      const os = require('os');
      const arch = os.arch();  // arm64 或 x64
      const platform = os.platform();  // darwin
      
      // 确定正确的可执行文件路径
      let executablePath = null;
      if (platform === 'darwin') {
        const homeDir = os.homedir();
        // 尝试 arm64 版本（Apple Silicon）
        const arm64Path = path.join(homeDir, 'Library/Caches/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-mac-arm64/chrome-headless-shell');
        const x64Path = path.join(homeDir, 'Library/Caches/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-mac-x64/chrome-headless-shell');
        
        if (fs.existsSync(arm64Path)) {
          executablePath = arm64Path;
          console.log('   使用 arm64 版本浏览器');
        } else if (fs.existsSync(x64Path)) {
          executablePath = x64Path;
          console.log('   使用 x64 版本浏览器');
        }
      }
      
      let launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-crashpad'
        ]
      };
      
      if (executablePath) {
        launchOptions.executablePath = executablePath;
      }
      
      browser = await chromium.launch(launchOptions);
      
      // 验证浏览器确实启动成功
      const testContext = await browser.newContext();
      await testContext.close();
      
      console.log('✅ Playwright 浏览器已启动');
    } catch (error) {
      console.error('❌ 浏览器启动失败:', error.message);
      browser = null;
      throw error;
    } finally {
      browserInitializing = false;
    }
  }
  
  return browser;
}

// 兼容旧函数名
async function getBrowser() {
  return await ensureBrowser();
}

/**
 * 根据交易所和交易对生成底图路径
 * @param {Object} exchangeConfig - 交易所配置
 * @param {string} tradePair - 交易对，如 ETHUSDT
 * @returns {string} 底图文件路径
 */
function getBackgroundImagePath(exchangeConfig, tradePair) {
  // 获取底图文件名模式
  const pattern = exchangeConfig.config.template?.backgroundPattern || '{pair}-background.jpg';
  const fileName = pattern.replace('{pair}', tradePair.toLowerCase());
  const imagePath = path.join(exchangeConfig.dir, fileName);
  
  // 检查文件是否存在
  if (!fs.existsSync(imagePath)) {
    throw new Error(`底图文件不存在: exchanges/${exchangeConfig.id}/${fileName}，请确保文件已上传`);
  }
  
  return imagePath;
}

/**
 * 获取指定交易对的历史 K线数据
 * @param {string} tradePair - 交易对，如 ETHUSDT
 * @param {string} datetime - 历史时间 (格式: YYYY-MM-DD HH:mm)
 * @returns {Promise<{openPrice: number, closePrice: number}>}
 */
async function getHistoricalPrice(tradePair, datetime) {
  try {
    const targetDate = new Date(datetime);
    const timestamp = targetDate.getTime();
    
    const url = 'https://api.binance.com/api/v3/klines';
    const params = {
      symbol: tradePair.toUpperCase(),  // 确保大写
      interval: '1m',
      startTime: timestamp,
      limit: 1
    };
    
    const response = await axiosInstance.get(url, { params });
    
    if (response.data && response.data.length > 0) {
      const kline = response.data[0];
      return {
        openPrice: parseFloat(kline[1]),
        closePrice: parseFloat(kline[4])
      };
    }
    throw new Error(`无法获取 ${tradePair} 的历史价格数据`);
  } catch (error) {
    console.error(`获取 ${tradePair} 价格失败:`, error.message);
    throw error;
  }
}

/**
 * 获取当前价格
 * @param {string} tradePair - 交易对
 */
async function getCurrentPrice(tradePair) {
  try {
    const url = 'https://api.binance.com/api/v3/ticker/price';
    const response = await axiosInstance.get(url, { params: { symbol: tradePair.toUpperCase() } });
    return parseFloat(response.data.price);
  } catch (error) {
    console.error('获取当前价格失败:', error.message);
    throw error;
  }
}

/**
 * 计算收益率
 */
function calculateROE(entryPrice, exitPrice, direction, leverage) {
  const dir = direction === 'long' ? 1 : -1;
  const priceChange = (exitPrice - entryPrice) / entryPrice;
  return priceChange * dir * leverage * 100;
}

/**
 * 格式化数字
 */
function formatNumber(num, decimals = 2) {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * 获取动态方向颜色
 * @param {Object} exchangeConfig - 交易所配置
 * @param {string} directionKey - 方向键名（如 'long', 'short', 'open_long', 'close_short' 等）
 * @returns {string|null} 颜色值或 null
 */
function getDynamicDirectionColor(exchangeConfig, directionKey) {
  const dynamicColors = exchangeConfig.config.dynamicColors?.direction || {};
  return dynamicColors[directionKey] || null;
}

/**
 * 获取交易所显示文本
 * @param {Object} exchangeConfig - 交易所配置
 * @param {string} direction - 方向（'long' 或 'short'）
 * @param {string} action - 动作（null, 'open', 'close'）
 * @returns {string} 显示文本
 */
function getDirectionDisplayText(exchangeConfig, direction, action = null) {
  const displayTexts = exchangeConfig.config.displayTexts?.direction || {};
  
  // 如果有动作（open/close），组合键名
  if (action) {
    const key = `${action}_${direction}`;
    if (displayTexts[key]) return displayTexts[key];
  }
  
  // 返回基本方向文本或默认值
  return displayTexts[direction] || (direction === 'long' ? '做多' : '做空');
}

/**
 * 解析时区偏移字符串
 * @param {string} tzStr - 时区字符串，如 "+8", "-5", "+5.5"
 * @returns {number} 小时偏移量
 */
function parseTimezoneOffset(tzStr) {
  if (!tzStr) return 8; // 默认 +8
  const str = String(tzStr).trim();
  const match = str.match(/^([+-])?(\d+(?:\.\d+)?)$/);
  if (match) {
    const sign = match[1] === '-' ? -1 : 1;
    return sign * parseFloat(match[2]);
  }
  return 8; // 解析失败，默认 +8
}

/**
 * 将日期时间按时区偏移进行转换
 * @param {string} dateStr - 原始日期字符串 (YYYY-MM-DD HH:mm)，假设为 UTC+8
 * @param {string} targetTz - 目标时区，如 "+8", "-5"
 * @returns {string} 转换后的日期字符串 (YYYY-MM-DD HH:mm)
 */
function convertTimezone(dateStr, targetTz) {
  const sourceTzOffset = 8; // 输入时间假设为 UTC+8
  const targetTzOffset = parseTimezoneOffset(targetTz);
  
  // 如果时区相同，直接返回
  if (sourceTzOffset === targetTzOffset) return dateStr;
  
  try {
    // 解析输入日期
    const [datePart, timePart] = dateStr.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    
    // 创建 Date 对象（作为 UTC+8 时间）
    const date = new Date(year, month - 1, day, hour, minute);
    
    // 计算时区差异（小时）
    const hourDiff = targetTzOffset - sourceTzOffset;
    
    // 调整时间
    date.setTime(date.getTime() + hourDiff * 60 * 60 * 1000);
    
    // 格式化输出
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    
    return `${y}-${m}-${d} ${h}:${min}`;
  } catch (e) {
    return dateStr;
  }
}

/**
 * 格式化日期显示 - 根据交易所配置的格式
 * @param {Object} exchangeConfig - 交易所配置
 * @param {string} dateStr - 原始日期字符串 (YYYY-MM-DD HH:mm)
 * @param {string} timezone - 目标时区，如 "+8", "-5"
 * @returns {string} 格式化后的日期字符串
 */
function formatDateDisplay(exchangeConfig, dateStr, timezone = '+8') {
  // 先进行时区转换
  const convertedDate = convertTimezone(dateStr, timezone);
  
  const dateFormat = exchangeConfig.config.displayTexts?.dateFormat;
  
  // 如果没有配置日期格式，直接返回转换后的字符串
  if (!dateFormat) return convertedDate;
  
  try {
    // 解析转换后的日期 (格式: YYYY-MM-DD HH:mm)
    const [datePart, timePart] = convertedDate.split(' ');
    const [year, month, day] = datePart.split('-');
    const [hour, minute] = timePart.split(':');
    
    // 根据格式模板替换
    let result = dateFormat;
    result = result.replace('YYYY', year);
    result = result.replace('MM', month);
    result = result.replace('DD', day);
    result = result.replace('HH', hour);
    result = result.replace('mm', minute);
    
    // 如果格式包含秒，添加随机秒数（因为输入没有秒）
    if (result.includes('ss')) {
      const randomSeconds = String(Math.floor(Math.random() * 60)).padStart(2, '0');
      result = result.replace('ss', randomSeconds);
    }
    
    return result;
  } catch (e) {
    // 解析失败，返回转换后的字符串
    return convertedDate;
  }
}

/**
 * 生成渲染 HTML - 与 test.html 预览时完全一致的结构和样式
 * @param {Object} exchangeConfig - 交易所配置
 * @param {Object} data - 数据对象
 * @param {boolean} isProfit - 是否盈利
 * @param {string} backgroundImagePath - 底图文件路径
 * @param {Object} options - 额外选项（如 dynamic_direction_color, timezone）
 */
function generateRenderHTML(exchangeConfig, data, isProfit, backgroundImagePath, options = {}) {
  const { date, yieldValue, entPrice, lastPrice, leverage, direction, directionAction, tradePair, ref, qrcodeUrl } = data;
  const modelConfig = exchangeConfig.model;
  const stylingConfig = exchangeConfig.config.styling || {};
  const dynamicDirectionColor = options.dynamic_direction_color || false;
  const timezone = options.timezone || '+8';
  
  // 读取底图并转为 base64
  const imageBuffer = fs.readFileSync(backgroundImagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = 'image/jpeg';
  
  // 方向文字映射 - 使用交易所配置
  const directionText = getDirectionDisplayText(exchangeConfig, direction, directionAction);
  
  // 确定方向键名（用于动态变色）
  const directionKey = directionAction ? `${directionAction}_${direction}` : direction;
  
  // 格式化日期显示 - 使用交易所配置的格式和时区
  const formattedDate = formatDateDisplay(exchangeConfig, date, timezone);
  
  const variables = {
    'date': formattedDate,
    'yield': yieldValue,
    'entprice': entPrice,
    'lastprice': lastPrice,
    'ent.price': entPrice,   // 兼容旧格式
    'last.price': lastPrice, // 兼容旧格式
    'lev': leverage,
    'direction': directionText,
    'tradepair': tradePair || '',  // 交易对
    'ref': ref || ''  // 邀请码
  };
  
  // 二维码 URL（用于二维码图层）
  const qrCodeUrlForRender = qrcodeUrl || '';
  
  // 生成自定义字体的 CSS @import
  const customFontUrls = modelConfig.customFontUrls || [];
  const fontImports = customFontUrls.map(url => `@import url('${url}');`).join('\n');
  
  // 获取颜色配置
  const profitColor = stylingConfig.profitColor || '#21C07C';
  const lossColor = stylingConfig.lossColor || '#F6465D';
  const textShadow = stylingConfig.textShadow || '0 0 1px rgba(0,0,0,.8)';
  
  // 生成文字图层的 HTML - 支持子层级和二维码
  let layersHTML = '';
  let qrcodeLayerData = null;  // 保存二维码图层数据，稍后处理
  
  for (const layer of modelConfig.layers) {
    // 如果是二维码图层，保存数据稍后处理
    if (layer.type === 'qrcode') {
      qrcodeLayerData = layer;
      continue;  // 跳过，稍后处理
    }
    
    // 替换变量
    let text = layer.text || '';
    for (const [key, value] of Object.entries(variables)) {
      text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    
    // 处理负收益时的 + 号
    if (layer.text && layer.text.includes('+{{yield}}') && !isProfit) {
      text = text.replace(/^\+/, '');
    }
    
    // 确定颜色
    let color = layer.color;
    if (layer.text && layer.text.includes('yield')) {
      color = isProfit ? profitColor : lossColor;
    }
    
    // 如果是方向层且启用了动态变色
    if (layer.text && layer.text.includes('direction') && dynamicDirectionColor) {
      const dynamicColor = getDynamicDirectionColor(exchangeConfig, directionKey);
      if (dynamicColor) color = dynamicColor;
    }
    
    const baseStyle = `
      position: absolute;
      left: ${layer.x}px;
      top: ${layer.y}px;
      font-family: ${layer.fontFamily};
      font-size: ${layer.fontSize}px;
      font-weight: ${layer.fontWeight};
      color: ${color};
      letter-spacing: ${layer.letterSpacing || 0}px;
      line-height: ${layer.lineHeight || 1.2};
      white-space: pre;
      user-select: none;
      text-shadow: ${textShadow};
    `;
    
    // 检查是否有子层级
    if (layer.children && layer.children.length > 0) {
      // 渲染子层级 - 父级只设置位置，不设置 font-size/line-height 避免影响子元素布局
      const childContainerStyle = `
        left: ${layer.x}px;
        top: ${layer.y}px;
        font-family: ${layer.fontFamily};
        color: ${color};
        letter-spacing: ${layer.letterSpacing || 0}px;
        text-shadow: ${textShadow};
      `;
      
      let childrenHTML = '';
      layer.children.forEach((child, idx) => {
        // 替换子元素中的变量
        let childText = child.text || '';
        for (const [key, value] of Object.entries(variables)) {
          childText = childText.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }
        
        // 子层级样式
        let childStyle = '';
        
        // 动态方向变色（子层级）
        let childColor = child.color || null;
        if (child.dynamicColor && dynamicDirectionColor) {
          const dynamicColor = getDynamicDirectionColor(exchangeConfig, directionKey);
          if (dynamicColor) childColor = dynamicColor;
        }
        
        if (childColor) childStyle += `color: ${childColor};`;
        if (child.fontSize) childStyle += `font-size: ${child.fontSize}px;`;
        if (child.fontWeight) childStyle += `font-weight: ${child.fontWeight};`;
        if (child.gap && idx > 0) childStyle += `margin-left: ${child.gap}px;`;
        
        childrenHTML += `<span class="text-layer-child" style="${childStyle}">${escapeHtml(childText)}</span>`;
      });
      
      layersHTML += `
        <div class="text-layer" style="${childContainerStyle}">
          <div class="text-layer-children">
            ${childrenHTML}
          </div>
        </div>
      `;
    } else {
      // 无子层级，直接渲染文本
      layersHTML += `
        <div class="text-layer" style="${baseStyle}">${escapeHtml(text)}</div>
      `;
    }
  }
  
  // 二维码图层占位符 - 将在 generateImage 中替换
  let qrcodeHTML = '';
  if (qrcodeLayerData && qrCodeUrlForRender) {
    qrcodeHTML = `<!-- QRCODE_PLACEHOLDER:${JSON.stringify({
      x: qrcodeLayerData.x,
      y: qrcodeLayerData.y,
      width: qrcodeLayerData.width || 100,
      height: qrcodeLayerData.height || 100,
      url: qrCodeUrlForRender
    })} -->`;
  }
  
  // 获取 base64 字体 CSS
  const base64FontCSS = getBase64FontCSS();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    /* HarmonyOS Sans SC - Base64 嵌入字体 */
    ${base64FontCSS}
    
    ${fontImports}
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      width: ${modelConfig.width}px;
      height: ${modelConfig.height}px;
      overflow: hidden;
      background: #000;
    }
    
    .editor-inner {
      position: relative;
      width: ${modelConfig.width}px;
      height: ${modelConfig.height}px;
    }
    
    #referenceImage {
      position: absolute;
      left: 0;
      top: 0;
      width: ${modelConfig.width}px;
      height: ${modelConfig.height}px;
      max-width: none;
      image-rendering: auto;
    }
    
    #overlay {
      position: absolute;
      left: 0;
      top: 0;
      width: ${modelConfig.width}px;
      height: ${modelConfig.height}px;
    }
    
    .text-layer {
      position: absolute;
      white-space: pre;
      user-select: none;
      text-shadow: 0 0 1px rgba(0,0,0,.8);
    }
    
    .text-layer-children {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      line-height: 1;
    }
    
    .text-layer-child {
      white-space: pre;
      line-height: 1;
      vertical-align: top;
    }
    
    .qrcode-layer {
      position: absolute;
    }
    
    .qrcode-layer img {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div class="editor-inner">
    <img id="referenceImage" src="data:${mimeType};base64,${base64Image}" />
    <div id="overlay">
      ${layersHTML}
    </div>
    ${qrcodeHTML}
  </div>
</body>
</html>
  `;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 使用 Playwright 生成图片
 * @param {Object} exchangeConfig - 交易所配置
 * @param {Object} data - 数据对象
 * @param {boolean} isProfit - 是否盈利
 * @param {string} backgroundImagePath - 底图文件路径
 * @param {Object} options - 额外选项（如 dynamic_direction_color）
 */
async function generateImage(exchangeConfig, data, isProfit, backgroundImagePath, options = {}) {
  let html = generateRenderHTML(exchangeConfig, data, isProfit, backgroundImagePath, options);
  const modelConfig = exchangeConfig.model;
  
  // 检查是否有二维码占位符
  const qrcodeMatch = html.match(/<!-- QRCODE_PLACEHOLDER:(.*?) -->/);
  let qrcodeDataUrl = null;
  
  if (qrcodeMatch) {
    try {
      const qrcodeData = JSON.parse(qrcodeMatch[1]);
      if (qrcodeData.url) {
        // 生成二维码 base64
        qrcodeDataUrl = await QRCode.toDataURL(qrcodeData.url, {
          width: qrcodeData.width || 100,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
        
        // 替换占位符为实际的二维码图片
        const qrcodeImgHtml = `
          <div class="qrcode-layer" style="left: ${qrcodeData.x}px; top: ${qrcodeData.y}px; width: ${qrcodeData.width}px; height: ${qrcodeData.height}px;">
            <img src="${qrcodeDataUrl}" />
          </div>
        `;
        html = html.replace(qrcodeMatch[0], qrcodeImgHtml);
      }
    } catch (qrErr) {
      console.error('生成二维码失败:', qrErr.message);
      // 移除占位符
      html = html.replace(qrcodeMatch[0], '');
    }
  }
  
  // 获取并发许可（等待队列）
  await limiter.acquire();
  
  let retries = 2;
  let lastError = null;
  
  try {
    while (retries >= 0) {
      let browser, context, page;
      
      try {
        // 确保浏览器可用（如果已关闭会自动重启）
        browser = await ensureBrowser();
      
      // 创建新的 context 和 page
      try {
        context = await browser.newContext({
          viewport: {
            width: modelConfig.width,
            height: modelConfig.height
          }
        });
      } catch (contextError) {
        console.error('❌ 创建 context 失败:', contextError.message);
        // 如果创建 context 失败，说明浏览器可能有问题，重置它
        if (browser) {
          try {
            await browser.close().catch(() => {});
          } catch (e) {}
          browser = null;
        }
        throw new Error(`浏览器上下文创建失败: ${contextError.message}`);
      }
      
      page = await context.newPage();
      
      // 加载 HTML
      await page.setContent(html, { waitUntil: 'networkidle' });
      
      // 等待字体加载
      await page.evaluate(() => document.fonts.ready);
      
      // 额外等待确保渲染完成
      await page.waitForTimeout(800);
      
      // 截图
      const screenshot = await page.screenshot({
        type: 'png',
        clip: {
          x: 0,
          y: 0,
          width: modelConfig.width,
          height: modelConfig.height
        }
      });
      
      // 清理资源
      await page.close().catch(() => {});
      await context.close().catch(() => {});
      
      return screenshot;
      
    } catch (error) {
      lastError = error;
      console.error(`生成图片失败 (剩余重试: ${retries}):`, error.message);
      
      // 清理资源
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
      
      // 如果浏览器相关错误，重置浏览器实例
      if (error.message.includes('browser') || error.message.includes('Target page')) {
        console.log('🔄 检测到浏览器错误，重置浏览器实例...');
        if (browser) {
          try {
            await browser.close().catch(() => {});
          } catch (e) {}
          browser = null;
        }
        // 等待一下再重试
        await new Promise(r => setTimeout(r, 500));
      }
      
      retries--;
      if (retries < 0) {
        throw new Error(`生成图片失败，已重试 2 次: ${error.message}`);
      }
    }
  }
  
  throw lastError || new Error('生成图片失败');
  } finally {
    // 释放并发许可
    limiter.release();
  }
}

// 解析 JSON body（增大限制以支持 base64 图片）
app.use(express.json({ limit: '50mb' }));

// API 端点：根据模板直接生成图片（供 test.html 使用）
app.post('/api/render', async (req, res) => {
  try {
    const { width, height, layers, customFontUrls, baseImage } = req.body;
    
    console.log('📥 收到渲染请求:');
    console.log('   尺寸:', width, 'x', height);
    console.log('   图层数:', layers?.length);
    console.log('   底图长度:', baseImage?.length, '字符');
    console.log('   底图前缀:', baseImage?.substring(0, 50));
    
    if (!width || !height || !layers || !baseImage) {
      console.log('❌ 缺少参数');
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 生成字体导入
    const fontImports = (customFontUrls || []).map(url => `@import url('${url}');`).join('\n');
    
    // 生成文字图层 HTML（支持子层级和二维码）- 与 /api/generate 完全一致
    let layersHTML = '';
    let qrcodeLayersHTML = '';  // 二维码图层单独处理
    
    for (const layer of layers) {
      // 二维码图层
      if (layer.type === 'qrcode') {
        // 生成预览用的二维码（使用示例链接）
        const previewUrl = 'https://example.com/ref/PREVIEW';
        try {
          const qrcodeDataUrl = await QRCode.toDataURL(previewUrl, {
            width: layer.width || 100,
            margin: 1,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          });
          qrcodeLayersHTML += `
            <div class="qrcode-layer" style="position: absolute; left: ${layer.x}px; top: ${layer.y}px; width: ${layer.width}px; height: ${layer.height}px;">
              <img src="${qrcodeDataUrl}" style="width: 100%; height: 100%;" />
            </div>
          `;
        } catch (qrErr) {
          console.error('生成预览二维码失败:', qrErr.message);
        }
        continue;
      }
      
      // 检查是否有子层级
      if (layer.children && layer.children.length > 0) {
        // 子层级容器样式 - 父级只设置位置，不设置 font-size/line-height
        const childContainerStyle = `
          left: ${layer.x}px;
          top: ${layer.y}px;
          font-family: ${layer.fontFamily};
          color: ${layer.color};
          letter-spacing: ${layer.letterSpacing || 0}px;
          text-shadow: 0 0 1px rgba(0,0,0,.8);
        `;
        
        // 渲染子层级
        let childrenHTML = '';
        layer.children.forEach((child, idx) => {
          let childStyle = '';
          if (child.color) childStyle += `color: ${child.color};`;
          if (child.fontSize) childStyle += `font-size: ${child.fontSize}px;`;
          if (child.fontWeight) childStyle += `font-weight: ${child.fontWeight};`;
          if (child.gap && idx > 0) childStyle += `margin-left: ${child.gap}px;`;
          
          childrenHTML += `<span class="text-layer-child" style="${childStyle}">${escapeHtml(child.text || '')}</span>`;
        });
        
        layersHTML += `
          <div class="text-layer" style="${childContainerStyle}">
            <div class="text-layer-children">
              ${childrenHTML}
            </div>
          </div>
        `;
      } else {
        // 无子层级，直接渲染文本 - 与 /api/generate 完全一致的 inline style
        const baseStyle = `
          position: absolute;
          left: ${layer.x}px;
          top: ${layer.y}px;
          font-family: ${layer.fontFamily};
          font-size: ${layer.fontSize}px;
          font-weight: ${layer.fontWeight};
          color: ${layer.color};
          letter-spacing: ${layer.letterSpacing || 0}px;
          line-height: ${layer.lineHeight || 1.2};
          white-space: pre;
          user-select: none;
          text-shadow: 0 0 1px rgba(0,0,0,.8);
        `;
        layersHTML += `<div class="text-layer" style="${baseStyle}">${escapeHtml(layer.text || '')}</div>`;
      }
    }
    
    // 获取 base64 字体 CSS
    const base64FontCSS = getBase64FontCSS();
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    /* HarmonyOS Sans SC - Base64 嵌入字体 */
    ${base64FontCSS}
    
    ${fontImports}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: ${width}px; height: ${height}px; overflow: hidden; background: #000; }
    .editor-inner { position: relative; width: ${width}px; height: ${height}px; }
    #referenceImage { position: absolute; left: 0; top: 0; width: ${width}px; height: ${height}px; }
    #overlay { position: absolute; left: 0; top: 0; width: ${width}px; height: ${height}px; }
    .text-layer { position: absolute; white-space: pre; user-select: none; text-shadow: 0 0 1px rgba(0,0,0,.8); }
    .text-layer-children { display: flex; flex-direction: row; align-items: flex-start; line-height: 1; }
    .text-layer-child { white-space: pre; line-height: 1; vertical-align: top; }
    .qrcode-layer { position: absolute; }
    .qrcode-layer img { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div class="editor-inner">
    <img id="referenceImage" src="${baseImage}" />
    <div id="overlay">${layersHTML}</div>
    ${qrcodeLayersHTML}
  </div>
</body>
</html>
    `;
    
    // 使用 Playwright 渲染（确保浏览器可用）
    const browser = await ensureBrowser();
    let context, page;
    try {
      context = await browser.newContext({ viewport: { width, height } });
      page = await context.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      
      // 等待图片加载完成
      await page.waitForFunction(() => {
        const img = document.querySelector('#referenceImage');
        return img && img.complete && img.naturalHeight !== 0;
      }, { timeout: 10000 });
      
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      
      console.log('   ✅ 页面渲染完成');
      
      const screenshot = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width, height }
      });
      
      res.set({ 'Content-Type': 'image/png' });
      res.send(screenshot);
      
    } finally {
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
    }
    
  } catch (error) {
    console.error('渲染失败:', error);
    res.status(500).json({ error: '渲染失败', message: error.message });
  }
});

// API 端点：生成晒单图片
// 参数说明：
// - ex: 交易所 ID，默认 easicoin
// - tradepair: 交易对，如 ETHUSDT（必填）
// - opendate: 开仓时间，用于获取开仓价格（不显示在图上）
// - date: 显示时间，格式 2025-11-26 23:23，也用于获取最新价格
// - lev: 杠杆比例（纯数字）
// - direction: 做多(long) 或 做空(short)
// - direction_action: 方向动作 (open/close)，可选，用于显示 "开多/平空" 等
// - dynamic_direction_color: 是否启用动态方向变色 (true/false)
// - timezone: 时区偏移，如 +8, -5, +5.5，默认 +8（北京时间）
app.get('/api/generate', async (req, res) => {
  try {
    const { 
      ex = DEFAULT_EXCHANGE, 
      tradepair, 
      opendate, 
      date, 
      direction = 'long', 
      lev = 10,
      direction_action,  // open/close
      dynamic_direction_color,
      timezone = '+8',  // 默认北京时间
      refcode  // 邀请码（用于生成二维码）
    } = req.query;
    
    // 解析布尔参数
    const enableDynamicColor = dynamic_direction_color === 'true' || dynamic_direction_color === '1';
    
    // 加载交易所配置
    let exchangeConfig;
    try {
      exchangeConfig = getExchangeConfig(ex);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: '交易所不存在',
        message: error.message,
        available_exchanges: getAvailableExchanges()
      });
    }
    
    // 参数验证
    if (!tradepair || !opendate || !date) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数',
        message: '请提供 tradepair、opendate 和 date 参数',
        exchange: {
          id: exchangeConfig.id,
          name: exchangeConfig.config.displayName,
          supportedPairs: exchangeConfig.config.supportedPairs
        },
        params: {
          ex: `交易所 ID，可选，默认 ${DEFAULT_EXCHANGE}`,
          tradepair: '交易对，如 ETHUSDT（必填，对应底图文件：ethusdt-background.jpg）',
          opendate: '开仓时间，格式: YYYY-MM-DD HH:mm（用于获取开仓价格）',
          date: '显示时间，格式: YYYY-MM-DD HH:mm（显示在图上，也用于获取最新价格）',
          lev: '杠杆比例，纯数字，默认 10',
          direction: '方向: long(做多) / short(做空)，默认 long',
          direction_action: '方向动作: open(开仓) / close(平仓)，可选',
          dynamic_direction_color: '是否启用动态方向变色: true/false，可选'
        },
        example: `/api/generate?ex=${ex}&tradepair=ETHUSDT&opendate=2025-11-20 10:00&date=2025-11-26 19:16&direction=long&lev=200&dynamic_direction_color=true`
      });
    }
    
    // 标准化交易对（统一大写）
    const tradePair = tradepair.toUpperCase();
    
    const leverage = parseInt(lev, 10);
    if (isNaN(leverage) || leverage < 1 || leverage > 500) {
      return res.status(400).json({ success: false, error: '杠杆倍数无效', message: 'lev 应在 1-500 之间' });
    }
    
    if (!['long', 'short'].includes(direction)) {
      return res.status(400).json({ success: false, error: '方向无效', message: 'direction 应为 long 或 short' });
    }
    
    console.log(`\n📊 生成晒单请求:`);
    console.log(`   交易所: ${exchangeConfig.config.displayName || ex}`);
    console.log(`   交易对: ${tradePair}`);
    console.log(`   开仓时间: ${opendate}`);
    console.log(`   显示时间: ${date}`);
    console.log(`   时区: UTC${timezone.startsWith('-') ? timezone : '+' + timezone.replace('+', '')}`);
    console.log(`   方向: ${direction === 'long' ? '做多' : '做空'}`);
    console.log(`   杠杆: ${leverage}x`);
    if (direction_action) console.log(`   方向动作: ${direction_action}`);
    if (enableDynamicColor) console.log(`   动态变色: 启用`);
    
    // 获取底图路径
    const backgroundImagePath = getBackgroundImagePath(exchangeConfig, tradePair);
    console.log(`   底图: ${path.basename(backgroundImagePath)}`);
    
    // 通过 opendate 获取开仓价格
    const openPriceData = await getHistoricalPrice(tradePair, opendate);
    const entPrice = openPriceData.openPrice;
    
    // 通过 date 获取最新价格
    const datePriceData = await getHistoricalPrice(tradePair, date);
    const lastPrice = datePriceData.openPrice;
    
    // 计算收益率
    let roe = calculateROE(entPrice, lastPrice, direction, leverage);
    let actualDirection = direction;
    
    // 如果收益率为负，自动切换多空方向确保收益为正
    if (roe < 0) {
      actualDirection = direction === 'long' ? 'short' : 'long';
      roe = calculateROE(entPrice, lastPrice, actualDirection, leverage);
      console.log(`   ⚡ 收益为负，自动切换方向: ${direction} → ${actualDirection}`);
    }
    
    const isProfit = roe >= 0;  // 现在肯定为正
    
    // 格式化收益率显示（带正号）
    const yieldStr = `+${roe.toFixed(2)}%`;
    
    console.log(`   开仓价 (entprice): ${entPrice}`);
    console.log(`   最新价 (lastprice): ${lastPrice}`);
    console.log(`   实际方向: ${actualDirection === 'long' ? '做多' : '做空'}`);
    console.log(`   收益率 (yield): ${yieldStr}`);
    
    // 获取二维码配置
    const qrcodeConfig = exchangeConfig.config.qrcode || {};
    const actualRefCode = refcode || qrcodeConfig.defaultRefCode || '';
    const qrcodeUrl = qrcodeConfig.baseUrl ? (qrcodeConfig.baseUrl + actualRefCode) : '';
    
    if (actualRefCode) {
      console.log(`   邀请码: ${actualRefCode}`);
      console.log(`   二维码链接: ${qrcodeUrl}`);
    }
    
    // 准备绘制数据
    const drawData = {
      date: date,  // 直接使用传入的 date
      yieldValue: `${roe.toFixed(2)}%`,
      entPrice: formatNumber(entPrice),
      lastPrice: formatNumber(lastPrice),
      leverage: `${leverage}`,
      direction: actualDirection,  // 实际方向（可能已自动切换）
      directionAction: direction_action || null,  // 方向动作（open/close）
      tradePair: tradePair,  // 交易对
      ref: actualRefCode,  // 邀请码
      qrcodeUrl: qrcodeUrl  // 二维码链接
    };
    
    // 生成选项
    const generateOptions = {
      dynamic_direction_color: enableDynamicColor,
      timezone: timezone  // 时区
    };
    
    // 生成图片
    const imageBuffer = await generateImage(exchangeConfig, drawData, isProfit, backgroundImagePath, generateOptions);
    
    // 转换为 base64
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;
    
    // 返回 JSON 格式
    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });
    
    // 方向文字 - 使用交易所配置
    const directionText = getDirectionDisplayText(exchangeConfig, actualDirection, direction_action);
    
    // 生成交易对信息
    const tradePairInfo = {
      symbol: tradePair,
      base: tradePair.replace('USDT', ''),  // 如 ETHUSDT -> ETH
      quote: 'USDT',
      display: tradePair.replace('USDT', '/USDT')  // 显示格式：ETH/USDT
    };
    
    res.json({
      success: true,
      message: `${tradePairInfo.display} ${directionText} ${leverage}x 杠杆，收益率 ${yieldStr}`,
      exchange: {
        id: exchangeConfig.id,
        name: exchangeConfig.config.name,
        displayName: exchangeConfig.config.displayName
      },
      tradepair: tradePairInfo,
      // 顶层交易信息字段，方便直接访问
      tradeInfo: {
        opendate: opendate,
        date: date,
        timezone: timezone,
        direction: directionText,
        direction_raw: actualDirection,
        direction_action: direction_action || null,
        leverage: leverage,
        entprice: entPrice,
        lastprice: lastPrice,
        yield: yieldStr,
        dynamic_direction_color: enableDynamicColor,
        ref: actualRefCode,  // 邀请码
        qrcode_url: qrcodeUrl  // 二维码链接
      },
      data: {
        image: dataUrl,  // base64 图片数据
        base64: base64Image,  // 纯 base64 字符串（不含前缀）
        format: 'png',
        width: exchangeConfig.model.width,
        height: exchangeConfig.model.height,
        params: {
          ex: exchangeConfig.id,
          tradepair: tradePair,
          tradepair_display: tradePairInfo.display,
          opendate,
          date,
          direction: actualDirection,
          direction_text: directionText,
          direction_action: direction_action || null,
          lev: leverage,
          entprice: entPrice,
          lastprice: lastPrice,
          yield: yieldStr,
          dynamic_direction_color: enableDynamicColor
        }
      }
    });
    
    console.log(`   ✅ 图片生成成功（base64）\n`);
    
  } catch (error) {
    console.error('生成失败:', error);
    
    // 尝试从请求中获取交易对信息
    const tradePair = req.query.tradepair ? req.query.tradepair.toUpperCase() : null;
    const ex = req.query.ex || DEFAULT_EXCHANGE;
    const errorResponse = {
      success: false,
      error: '生成失败',
      message: error.message,
      exchange: { id: ex }
    };
    
    // 如果已有交易对信息，添加到错误响应中
    if (tradePair) {
      errorResponse.tradepair = {
        symbol: tradePair,
        base: tradePair.replace('USDT', ''),
        quote: 'USDT',
        display: tradePair.replace('USDT', '/USDT')
      };
      errorResponse.message = `${tradePair.replace('USDT', '/USDT')} 图片生成失败: ${error.message}`;
    }
    
    res.status(500).json(errorResponse);
  }
});

// API: 获取可用的交易所列表
app.get('/api/exchanges', (req, res) => {
  try {
    const exchanges = getAvailableExchanges();
    res.json({
      success: true,
      count: exchanges.length,
      default: DEFAULT_EXCHANGE,
      exchanges
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: 健康检查
app.get('/api/health', async (req, res) => {
  try {
    const browser = await ensureBrowser();
    // 尝试创建测试 context
    const testContext = await browser.newContext();
    await testContext.close();
    
    const exchanges = getAvailableExchanges();
    const stats = limiter.getStats();
    
    res.json({ 
      status: 'healthy',
      browser: 'running',
      port: PORT,
      exchanges: exchanges.length,
      default_exchange: DEFAULT_EXCHANGE,
      concurrency: {
        current: stats.currentConcurrent,
        max: stats.maxConcurrent,
        queueLength: stats.queueLength
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      browser: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API: 并发统计信息
app.get('/api/stats', (req, res) => {
  const stats = limiter.getStats();
  const memUsage = process.memoryUsage();
  
  res.json({
    concurrency: stats,
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
      rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB'
    },
    uptime: Math.round(process.uptime()) + ' 秒',
    timestamp: new Date().toISOString()
  });
});

// API: 获取当前价格
app.get('/api/price', async (req, res) => {
  try {
    const { symbol = 'ETHUSDT' } = req.query;
    const price = await getCurrentPrice(symbol);
    res.json({ symbol: symbol.toUpperCase(), price, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 首页
app.get('/', (req, res) => {
  const exchanges = getAvailableExchanges();
  const exchangeListHTML = exchanges.map(ex => 
    `<li><code>${ex.id}</code> - ${ex.displayName} (支持: ${ex.supportedPairs?.join(', ') || '未知'})</li>`
  ).join('');
  
  res.send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>加密货币晒单收益模拟 API</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 40px; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { color: #21C07C; }
    h3 { color: #ffd54f; margin-top: 20px; }
    .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; margin: 24px 0; }
    code { background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 4px; color: #ffd54f; }
    pre { background: #0d1117; padding: 16px; border-radius: 8px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .tag.get { background: #21C07C; color: #000; }
    .tag.required { background: #f44336; color: #fff; font-size: 10px; margin-left: 4px; }
    .tag.optional { background: #666; color: #fff; font-size: 10px; margin-left: 4px; }
    .tag.new { background: #2196F3; color: #fff; font-size: 10px; margin-left: 4px; }
    .example-link { display: inline-block; margin-top: 16px; padding: 10px 20px; background: #21C07C; color: #000; border-radius: 8px; font-weight: 600; text-decoration: none; margin-right: 10px; }
    .note { color: #888; font-size: 13px; margin-top: 8px; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 加密货币晒单收益模拟 API</h1>
    <p>支持多交易所、多交易对（ETHUSDT、BTCUSDT等），根据历史时间自动获取价格，计算收益率，生成晒单图片</p>
    
    <div class="card">
      <h2>📦 可用交易所</h2>
      <ul>${exchangeListHTML || '<li>暂无可用交易所</li>'}</ul>
      <p class="note">默认交易所: <code>${DEFAULT_EXCHANGE}</code></p>
    </div>
    
    <div class="card">
      <h2><span class="tag get">GET</span> /api/generate</h2>
      <table>
        <tr><th>参数</th><th>类型</th><th>说明</th></tr>
        <tr>
          <td><code>ex</code> <span class="tag optional">可选</span> <span class="tag new">新增</span></td>
          <td>string</td>
          <td>交易所 ID，默认 <code>${DEFAULT_EXCHANGE}</code></td>
        </tr>
        <tr>
          <td><code>tradepair</code> <span class="tag required">必填</span></td>
          <td>string</td>
          <td>交易对，如 ETHUSDT、BTCUSDT<br>对应底图：exchanges/{ex}/ethusdt-background.jpg</td>
        </tr>
        <tr>
          <td><code>opendate</code> <span class="tag required">必填</span></td>
          <td>string</td>
          <td>开仓时间 (YYYY-MM-DD HH:mm)，用于获取开仓价格 entprice</td>
        </tr>
        <tr>
          <td><code>date</code> <span class="tag required">必填</span></td>
          <td>string</td>
          <td>显示时间 (YYYY-MM-DD HH:mm)，显示在图上，也用于获取最新价格 lastprice</td>
        </tr>
        <tr>
          <td><code>lev</code> <span class="tag optional">可选</span></td>
          <td>number</td>
          <td>杠杆比例，纯数字 1-500，默认 10</td>
        </tr>
        <tr>
          <td><code>direction</code> <span class="tag optional">可选</span></td>
          <td>string</td>
          <td>方向: long(做多) / short(做空)，默认 long</td>
        </tr>
      </table>
      
      <h3>示例</h3>
      <pre><code>GET /api/generate?ex=easicoin&tradepair=ETHUSDT&opendate=2025-11-20 10:00&date=2025-11-26 19:16&direction=long&lev=200</code></pre>
      <p class="note">↑ easicoin 交易所, ETHUSDT 交易对，2025-11-20 10:00 开仓做多 200倍</p>
      
      <a class="example-link" href="/api/generate?ex=easicoin&tradepair=ETHUSDT&opendate=2025-12-01 10:00&date=2025-12-02 18:00&direction=long&lev=100" target="_blank">🖼️ 生成示例图片</a>
      <a class="example-link" href="/api/exchanges" target="_blank" style="background:#2196F3;">📋 查看交易所列表</a>
    </div>
    
    <div class="card">
      <h2><span class="tag get">GET</span> /api/exchanges <span class="tag new">新增</span></h2>
      <p>获取所有可用的交易所列表</p>
    </div>
  </div>
</body>
</html>
  `);
});

// 启动服务器 - 监听所有网络接口
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n🚀 加密货币晒单收益模拟 API 已启动`);
  console.log(`   地址: http://0.0.0.0:${PORT}`);
  console.log(`   使用 Playwright 渲染，支持 Google Fonts`);
  console.log(`   默认交易所: ${DEFAULT_EXCHANGE}\n`);
  
  // 加载所有交易所配置
  const exchanges = getAvailableExchanges();
  console.log(`📦 已加载 ${exchanges.length} 个交易所配置:`);
  exchanges.forEach(ex => {
    console.log(`   - ${ex.id}: ${ex.displayName}`);
  });
  
  // 延迟初始化浏览器（在第一次请求时初始化）
  console.log('\n💡 浏览器将在首次生成图片时初始化');
  console.log('✅ 服务已就绪\n');
});

// 优雅退出
process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit(0);
});

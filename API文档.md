# 加密货币晒单收益模拟 API 文档

## 基础信息

| 项目 | 说明 |
|------|------|
| 基础地址 | `http://your-server:3070` |
| 请求方式 | GET |
| 返回格式 | JSON（包含 base64 图片数据） |
| 支持交易所 | easicoin（默认）、lbanken，可扩展更多 |
| 支持交易对 | ETHUSDT、BTCUSDT 等（需对应底图文件） |
| 字体支持 | HarmonyOS Sans SC（全字重）、系统字体 |

---

## 目录结构

```
project/
├── server.js                     # API 服务主文件
├── test.html                     # 模板编辑器
├── api-test.html                 # API 测试工具
├── fonts/                        # 字体文件目录
│   ├── harmonyos-sans.css        # HarmonyOS Sans 字体定义
│   └── HarmonyOS_Sans_SC_*.ttf   # 字体文件（需手动下载）
├── exchanges/
│   ├── easicoin/                 # Easicoin 交易所配置
│   │   ├── config.json           # 交易所配置文件
│   │   ├── model.json            # 模板配置（文字位置、字体等）
│   │   ├── ethusdt-background.jpg
│   │   └── btcusdt-background.jpg
│   ├── lbanken/                  # LBanken 交易所配置
│   │   ├── config.json
│   │   ├── model.json
│   │   ├── ethusdt-background.jpg
│   │   └── btcusdt-background.jpg
│   └── [其他交易所]/
│       ├── config.json
│       ├── model.json
│       └── xxx-background.jpg
```

---

## 接口 1：生成晒单图片

### 请求地址

```
GET /api/generate
```

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `ex` | string | ❌ 否 | 交易所 ID，默认 `easicoin`<br>可选：`easicoin`、`lbanken` |
| `tradepair` | string | ✅ 是 | 交易对，如 `ETHUSDT`、`BTCUSDT` |
| `opendate` | string | ✅ 是 | 开仓时间，格式：`YYYY-MM-DD HH:mm`<br>用于获取开仓价格 |
| `date` | string | ✅ 是 | 显示时间，格式：`YYYY-MM-DD HH:mm`<br>显示在图上，也用于获取最新价格 |
| `lev` | number | ❌ 否 | 杠杆倍数，范围 1-500，默认 10 |
| `direction` | string | ❌ 否 | 交易方向：`long`(做多) / `short`(做空)，默认 `long` |
| `direction_action` | string | ❌ 否 | 方向动作：`open`(开仓) / `close`(平仓) |
| `dynamic_direction_color` | string | ❌ 否 | 是否启用动态方向变色：`true`/`false` |
| `timezone` | string | ❌ 否 | 时区偏移，如 `+8`、`-5`，默认 `+8` |
| `refcode` | string | ❌ 否 | 邀请码，用于生成二维码链接<br>Easicoin 默认 `HAJIMI`，LBanken 默认 `5NCXS` |

### 时区参数说明

`timezone` 参数用于调整图片上显示的时间：

| 值 | 说明 |
|-----|------|
| `+8` | UTC+8 北京/香港（默认） |
| `+9` | UTC+9 东京/首尔 |
| `+0` | UTC+0 伦敦 |
| `-5` | UTC-5 纽约 |
| `-8` | UTC-8 洛杉矶 |

### 二维码参数说明

`refcode` 参数用于生成邀请二维码：

| 交易所 | 默认邀请码 | 生成的链接格式 |
|--------|-----------|---------------|
| Easicoin | `HAJIMI` | `https://www.easicoinx.com/account/register/?inviteCode={refcode}` |
| LBanken | `5NCXS` | `https://lbank.com/ref/{refcode}` |

### 动态方向变色规则

当 `dynamic_direction_color=true` 时，方向文字会根据以下规则自动变色：

| 方向组合 | 颜色 | 说明 |
|----------|------|------|
| `open` + `long` | 绿色 (#21C07C) | 开多 |
| `open` + `short` | 红色 (#F6465D) | 开空 |
| `close` + `long` | 红色 (#F6465D) | 平多 |
| `close` + `short` | 绿色 (#21C07C) | 平空 |
| `long` (无动作) | 绿色 (#21C07C) | 做多 |
| `short` (无动作) | 红色 (#F6465D) | 做空 |

> 颜色可在交易所配置文件 `config.json` 的 `dynamicColors.direction` 中自定义。

### 自动计算的数据

| 字段 | 说明 |
|------|------|
| `entprice` | 开仓价格，通过 `opendate` 时间自动获取 |
| `lastprice` | 最新价格，通过 `date` 时间自动获取 |
| `yield` | 收益率，根据价格差、方向、杠杆自动计算 |

### 收益率计算公式

```
做多: yield = (lastprice - entprice) / entprice × lev × 100%
做空: yield = (entprice - lastprice) / entprice × lev × 100%
```

**注意**：如果计算结果为负，API 会自动切换方向确保收益率为正。

---

## 请求示例

### 示例 1：基础用法 - ETHUSDT 做多

```bash
curl "http://localhost:3070/api/generate?tradepair=ETHUSDT&opendate=2025-12-01%2008:30&date=2025-12-03%2012:45&direction=long&lev=125"
```

### 示例 2：使用 LBanken 交易所 + 动态变色

```bash
curl "http://localhost:3070/api/generate?ex=lbanken&tradepair=ETHUSDT&opendate=2025-12-01%2008:30&date=2025-12-03%2012:45&direction=long&lev=100&direction_action=close&dynamic_direction_color=true"
```

### 示例 3：指定时区和邀请码

```bash
# 使用东京时区，自定义邀请码
curl "http://localhost:3070/api/generate?ex=easicoin&tradepair=ETHUSDT&opendate=2025-12-01%2008:30&date=2025-12-03%2012:45&direction=long&lev=50&timezone=+9&refcode=MYCODE"
```

### 示例 4：完整参数示例

```bash
curl "http://localhost:3070/api/generate?ex=lbanken&tradepair=BTCUSDT&opendate=2025-12-01%2010:00&date=2025-12-03%2018:30&direction=short&lev=150&direction_action=close&dynamic_direction_color=true&timezone=+8&refcode=5NCXS"
```

### 示例 5：保存图片到文件

```bash
curl -s "http://localhost:3070/api/generate?tradepair=ETHUSDT&opendate=2025-12-01%2008:30&date=2025-12-03%2012:45&direction=long&lev=125" | \
  python3 -c "import sys, json, base64; \
    result = json.load(sys.stdin); \
    open('output.png', 'wb').write(base64.b64decode(result['data']['base64'])) if result['success'] else print('Error:', result.get('message'))"
```

---

## 返回说明

### 成功响应

- **Content-Type**: `application/json`
- **状态码**: `200`

```json
{
  "success": true,
  "message": "ETH/USDT 做多 50x 杠杆，收益率 +454.27%",
  "exchange": {
    "id": "easicoin",
    "name": "Easicoin",
    "displayName": "Easicoin 交易所"
  },
  "tradepair": {
    "symbol": "ETHUSDT",
    "base": "ETH",
    "quote": "USDT",
    "display": "ETH/USDT"
  },
  "tradeInfo": {
    "opendate": "2025-12-02 17:20",
    "date": "2025-12-03 17:20",
    "direction": "做多",
    "leverage": 50,
    "entprice": 2798.99,
    "lastprice": 3053.29,
    "yield": "+454.27%",
    "ref": "HAJIMI",
    "qrcode_url": "https://www.easicoinx.com/account/register/?inviteCode=HAJIMI"
  },
  "data": {
    "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "base64": "iVBORw0KGgoAAAANSUhEUgAA...",
    "format": "png",
    "width": 908,
    "height": 1280,
    "params": {
      "ex": "easicoin",
      "tradepair": "ETHUSDT",
      "tradepair_display": "ETH/USDT",
      "opendate": "2025-12-02 17:20",
      "date": "2025-12-03 17:20",
      "direction": "long",
      "direction_text": "做多",
      "lev": 50,
      "entprice": 2798.99,
      "lastprice": 3053.29,
      "yield": "+454.27%",
      "timezone": "+8",
      "ref": "HAJIMI",
      "qrcode_url": "https://www.easicoinx.com/account/register/?inviteCode=HAJIMI"
    }
  }
}
```

**字段说明：**

| 字段 | 说明 |
|------|------|
| `success` | 请求是否成功 |
| `message` | 文字描述信息 |
| `exchange` | 交易所信息对象 |
| `tradepair` | 交易对详细信息对象 |
| `tradeInfo` | 交易信息汇总 |
| `tradeInfo.ref` | 使用的邀请码 |
| `tradeInfo.qrcode_url` | 二维码链接（如果模板包含二维码） |
| `data.image` | 完整的 base64 data URL |
| `data.base64` | 纯 base64 字符串（不含前缀） |
| `data.params.timezone` | 使用的时区 |

### 错误响应

```json
{
  "success": false,
  "error": "错误类型",
  "message": "错误详情",
  "exchange": { "id": "easicoin" },
  "tradepair": { "symbol": "ETHUSDT", "display": "ETH/USDT" }
}
```

### 错误码说明

| 状态码 | 错误类型 | 说明 |
|--------|----------|------|
| 400 | 交易所不存在 | `ex` 参数指定的交易所不存在 |
| 400 | 缺少必要参数 | 未提供 `tradepair`、`opendate` 或 `date` |
| 400 | 杠杆倍数无效 | `lev` 不在 1-500 范围内 |
| 400 | 方向无效 | `direction` 不是 `long` 或 `short` |
| 500 | 生成失败 | 服务器内部错误或价格获取失败 |

---

## 接口 2：获取交易所列表

### 请求地址

```
GET /api/exchanges
```

### 返回示例

```json
{
  "success": true,
  "count": 2,
  "default": "easicoin",
  "exchanges": [
    {
      "id": "easicoin",
      "name": "Easicoin",
      "displayName": "Easicoin 交易所",
      "supportedPairs": ["ETHUSDT", "BTCUSDT"]
    },
    {
      "id": "lbanken",
      "name": "LBanken",
      "displayName": "LBanken 交易所",
      "supportedPairs": ["ETHUSDT", "BTCUSDT"]
    }
  ]
}
```

---

## 接口 3：健康检查

### 请求地址

```
GET /api/health
```

### 返回示例

```json
{
  "status": "healthy",
  "browser": "running",
  "port": 3070,
  "exchanges": 2,
  "default_exchange": "easicoin",
  "timestamp": "2025-12-04T10:30:00.000Z"
}
```

---

## 接口 4：获取当前价格

### 请求地址

```
GET /api/price?symbol=ETHUSDT
```

### 返回示例

```json
{
  "symbol": "ETHUSDT",
  "price": 3052.97,
  "timestamp": "2025-12-04T10:30:00.000Z"
}
```

---

## 接口 5：实时渲染预览

### 请求地址

```
POST /api/render
```

### 请求体

```json
{
  "width": 908,
  "height": 1280,
  "backgroundImage": "data:image/jpeg;base64,...",
  "layers": [
    {
      "type": "text",
      "text": "示例文字",
      "x": 100,
      "y": 200,
      "fontSize": 24,
      "color": "#ffffff",
      "fontWeight": 400,
      "fontFamily": "HarmonyOS Sans SC"
    },
    {
      "type": "qrcode",
      "x": 500,
      "y": 900,
      "width": 150,
      "height": 150
    }
  ]
}
```

### 说明

此接口用于 `test.html` 模板编辑器的实时预览功能，支持文字图层和二维码图层的渲染。

---

## 交易所对比

| 配置项 | Easicoin | LBanken |
|--------|----------|---------|
| 方向文案 | 做多/做空 | Close Long/Close Short |
| 收益色 | #21C07C | #00D4AA |
| 亏损色 | #F6465D | #FF6B6B |
| 日期格式 | YYYY-MM-DD HH:mm | YYYY/MM/DD HH:mm:ss |
| 模板尺寸 | 908×1280 | 750×1240 |
| 默认邀请码 | HAJIMI | 5NCXS |
| 二维码链接 | easicoinx.com/account/register/?inviteCode= | lbank.com/ref/ |

---

## 各语言调用示例

### Python

```python
import requests
import base64

params = {
    'ex': 'lbanken',
    'tradepair': 'ETHUSDT',
    'opendate': '2025-12-01 08:30',
    'date': '2025-12-03 12:45',
    'direction': 'long',
    'lev': 125,
    'direction_action': 'close',
    'dynamic_direction_color': 'true',
    'timezone': '+8',
    'refcode': 'MYCODE'
}

response = requests.get('http://localhost:3070/api/generate', params=params)

if response.status_code == 200:
    result = response.json()
    if result['success']:
        print(f"交易所: {result['exchange']['displayName']}")
        print(f"交易对: {result['tradepair']['display']}")
        print(f"收益率: {result['tradeInfo']['yield']}")
        print(f"邀请码: {result['tradeInfo']['ref']}")
        print(f"二维码链接: {result['tradeInfo']['qrcode_url']}")
        
        # 保存图片
        with open('output.png', 'wb') as f:
            f.write(base64.b64decode(result['data']['base64']))
        print('图片保存成功')
    else:
        print('错误:', result.get('message'))
```

### JavaScript (浏览器)

```javascript
async function generateImage() {
  const params = new URLSearchParams({
    ex: 'lbanken',
    tradepair: 'ETHUSDT',
    opendate: '2025-12-01 08:30',
    date: '2025-12-03 12:45',
    direction: 'long',
    lev: '125',
    direction_action: 'close',
    dynamic_direction_color: 'true',
    timezone: '+8',
    refcode: 'MYCODE'
  });
  
  const response = await fetch(`http://localhost:3070/api/generate?${params}`);
  const result = await response.json();
  
  if (result.success) {
    console.log('交易所:', result.exchange.displayName);
    console.log('收益率:', result.tradeInfo.yield);
    console.log('邀请码:', result.tradeInfo.ref);
    console.log('二维码链接:', result.tradeInfo.qrcode_url);
    
    // 显示图片
    const img = document.createElement('img');
    img.src = result.data.image;
    document.body.appendChild(img);
  }
}
```

---

## 扩展新交易所

### 步骤

1. **创建目录**：`exchanges/newex/`

2. **添加配置文件** `config.json`：

```json
{
  "name": "NewEx",
  "displayName": "NewEx 交易所",
  "description": "NewEx 交易所晒单收益图模板",
  "version": "1.0.0",
  "priceSource": "binance",
  "supportedPairs": ["ETHUSDT", "BTCUSDT"],
  "defaultPair": "ETHUSDT",
  "template": {
    "width": 908,
    "height": 1280,
    "backgroundPattern": "{pair}-background.jpg"
  },
  "styling": {
    "profitColor": "#21C07C",
    "lossColor": "#F6465D",
    "textShadow": "0 0 1px rgba(0,0,0,.8)"
  },
  "displayTexts": {
    "direction": {
      "long": "Long",
      "short": "Short",
      "open_long": "Open Long",
      "open_short": "Open Short",
      "close_long": "Close Long",
      "close_short": "Close Short"
    },
    "dateFormat": "YYYY-MM-DD HH:mm"
  },
  "dynamicColors": {
    "direction": {
      "open_long": "#21C07C",
      "open_short": "#F6465D",
      "close_long": "#F6465D",
      "close_short": "#21C07C",
      "long": "#21C07C",
      "short": "#F6465D"
    }
  },
  "qrcode": {
    "baseUrl": "https://newex.com/register?ref=",
    "defaultRefCode": "DEFAULT"
  }
}
```

**配置说明**：

| 配置项 | 说明 |
|--------|------|
| `displayTexts.direction` | 方向显示文本映射 |
| `displayTexts.dateFormat` | 日期显示格式（支持 YYYY、MM、DD、HH、mm、ss） |
| `dynamicColors.direction` | 方向动态颜色映射 |
| `qrcode.baseUrl` | 二维码链接基础 URL |
| `qrcode.defaultRefCode` | 默认邀请码 |

3. **添加模板文件** `model.json`：

```json
{
  "width": 908,
  "height": 1280,
  "layers": [
    {
      "id": "date",
      "type": "text",
      "text": "{{date}}",
      "x": 50,
      "y": 100,
      "fontSize": 24,
      "color": "#ffffff",
      "fontWeight": 400,
      "fontFamily": "HarmonyOS Sans SC"
    },
    {
      "id": "qrcode",
      "type": "qrcode",
      "x": 700,
      "y": 1000,
      "width": 150,
      "height": 150
    }
  ]
}
```

4. **添加底图文件**：`ethusdt-background.jpg`、`btcusdt-background.jpg`

5. **重启服务**：`./restart.sh`

---

## 字体支持

### HarmonyOS Sans SC

支持全部 6 种字重：

| 字重值 | 名称 | 效果 |
|--------|------|------|
| 100 | Thin | 极细 |
| 300 | Light | 细 |
| 400 | Regular | 常规 |
| 500 | Medium | 中等 |
| 700 | Bold | 粗 |
| 900 | Black | 特粗 |

### 字体安装

1. 从华为官网下载字体：https://developer.huawei.com/consumer/cn/design/harmonyos-design/
2. 将 `HarmonyOS_Sans_SC_*.ttf` 文件复制到 `fonts/` 目录
3. 重启服务

---

## 工具页面

| 页面 | 地址 | 说明 |
|------|------|------|
| API 首页 | `http://localhost:3070/` | API 文档和示例 |
| 模板编辑器 | `test.html` | 可视化编辑模板，支持实时 API 预览 |
| API 测试工具 | `api-test.html` | 快速测试 API 参数 |

---

## 注意事项

1. **时间格式**：必须使用 `YYYY-MM-DD HH:mm` 格式
2. **URL 编码**：空格需要编码为 `%20`
3. **跨域支持**：API 已启用 CORS，可从浏览器直接调用
4. **响应时间**：首次请求约 2-3 秒（需要加载字体），后续请求约 1 秒
5. **字体文件**：HarmonyOS Sans 需手动下载安装
6. **时区**：默认使用 UTC+8，可通过 `timezone` 参数调整

---

## 服务器部署

### 启动服务

```bash
cd /path/to/project
npm install
node server.js

# 或使用脚本
./start.sh
./restart.sh
```

### 服务运行日志示例

```
🚀 加密货币晒单收益模拟 API 已启动
   地址: http://localhost:3070
   使用 Playwright 渲染，支持 HarmonyOS Sans SC 字体
   默认交易所: easicoin

📦 已加载 2 个交易所配置:
   - easicoin: Easicoin 交易所
   - lbanken: LBanken 交易所

✅ Playwright 浏览器已就绪

📊 生成晒单请求:
   交易所: LBanken 交易所
   交易对: ETHUSDT
   开仓时间: 2025-12-01 08:30
   显示时间: 2025-12-03 12:45
   时区: UTC+8
   方向: Close Long
   杠杆: 125x
   动态变色: 启用
   邀请码: 5NCXS
   二维码链接: https://lbank.com/ref/5NCXS
   ✅ 图片生成成功（base64）
```

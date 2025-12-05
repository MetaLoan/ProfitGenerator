# 🚀 加密货币晒单收益模拟 API

生成交易所风格的晒单收益图片，支持多交易所、多交易对、自动获取历史价格计算收益率。

## ✨ 功能特性

- 📊 **多交易所支持**：Easicoin、LBanken，可扩展更多
- 💹 **自动价格获取**：从 Binance API 获取历史价格
- 🎨 **动态方向变色**：根据开仓/平仓方向自动设置颜色
- 📱 **二维码邀请码**：支持自定义邀请码生成二维码
- 🌏 **时区转换**：支持不同时区的时间显示
- 🔤 **HarmonyOS Sans 字体**：支持全 6 种字重

## 📦 快速部署

### 🐧 Ubuntu 一键部署（推荐）

```bash
# 最新版本 v1.1（支持 Ubuntu 22.04 / 24.04）
curl -fsSL https://raw.githubusercontent.com/MetaLoan/ProfitGenerator/main/deploy-ubuntu-v1.1.sh | bash
```

部署完成后会自动显示公网 API 地址，服务会开机自启。

### 手动部署

#### 1. 克隆仓库

```bash
git clone https://github.com/MetaLoan/ProfitGenerator.git
cd ProfitGenerator
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 安装 Playwright 浏览器

```bash
npx playwright install chromium
```

#### 4. 启动服务

```bash
node server.js
# 或
./start.sh
```

服务将在 `http://localhost:3070` 启动

### 5. 测试

打开浏览器访问：
- API 首页：http://localhost:3070
- API 测试工具：直接打开 `api-test.html`
- 模板编辑器：直接打开 `test.html`

## 📁 目录结构

```
ProfitGenerator/
├── server.js                     # API 服务主文件
├── test.html                     # 可视化模板编辑器
├── api-test.html                 # API 参数测试工具
├── API文档.md                    # 完整 API 文档
├── package.json                  # Node.js 依赖
├── fonts/                        # 字体文件目录
│   ├── harmonyos-sans.css        # 字体定义文件
│   └── download-fonts.sh         # 字体下载脚本
├── exchanges/                    # 交易所配置目录
│   ├── easicoin/                 # Easicoin 交易所
│   │   ├── config.json           # 交易所配置
│   │   ├── model.json            # 模板配置
│   │   ├── ethusdt-background.jpg
│   │   └── btcusdt-background.jpg
│   └── lbanken/                  # LBanken 交易所
│       ├── config.json
│       ├── model.json
│       ├── ethusdt-background.jpg
│       └── btcusdt-background.jpg
├── start.sh                      # 启动脚本
├── stop.sh                       # 停止脚本
└── restart.sh                    # 重启脚本
```

## 🔧 API 使用

### 生成晒单图片

```
GET /api/generate
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `ex` | ❌ | 交易所 ID，默认 `easicoin`，可选 `lbanken` |
| `tradepair` | ✅ | 交易对，如 `ETHUSDT`、`BTCUSDT` |
| `opendate` | ✅ | 开仓时间 `YYYY-MM-DD HH:mm` |
| `date` | ✅ | 显示时间 `YYYY-MM-DD HH:mm` |
| `lev` | ❌ | 杠杆倍数，默认 10 |
| `direction` | ❌ | `long`(做多) / `short`(做空) |
| `direction_action` | ❌ | `open`(开仓) / `close`(平仓) |
| `dynamic_direction_color` | ❌ | `true` 启用动态方向变色 |
| `timezone` | ❌ | 时区，如 `+8`、`-5`，默认 `+8` |
| `refcode` | ❌ | 邀请码，用于生成二维码 |

### 示例请求

```bash
# Easicoin 做多
curl "http://localhost:3070/api/generate?tradepair=ETHUSDT&opendate=2025-12-01%2008:30&date=2025-12-03%2012:45&direction=long&lev=125"

# LBanken 平仓 + 动态变色
curl "http://localhost:3070/api/generate?ex=lbanken&tradepair=BTCUSDT&opendate=2025-12-01%2010:00&date=2025-12-03%2018:00&direction=short&lev=150&direction_action=close&dynamic_direction_color=true"
```

### 返回格式

```json
{
  "success": true,
  "message": "ETH/USDT 做多 50x 杠杆，收益率 +454.27%",
  "exchange": { "id": "easicoin", "displayName": "Easicoin 交易所" },
  "tradepair": { "symbol": "ETHUSDT", "display": "ETH/USDT" },
  "tradeInfo": {
    "direction": "做多",
    "leverage": 50,
    "yield": "+454.27%",
    "ref": "HAJIMI",
    "qrcode_url": "https://www.easicoinx.com/account/register/?inviteCode=HAJIMI"
  },
  "data": {
    "image": "data:image/png;base64,...",
    "base64": "...",
    "width": 908,
    "height": 1280
  }
}
```

## 🎨 可选：安装 HarmonyOS Sans 字体

如需使用 HarmonyOS Sans 字体的全部字重：

1. 访问 https://developer.huawei.com/consumer/cn/design/harmonyos-design/
2. 下载 HarmonyOS Sans 字体包
3. 将以下文件复制到 `fonts/` 目录：
   - `HarmonyOS_Sans_SC_Thin.ttf`
   - `HarmonyOS_Sans_SC_Light.ttf`
   - `HarmonyOS_Sans_SC_Regular.ttf`
   - `HarmonyOS_Sans_SC_Medium.ttf`
   - `HarmonyOS_Sans_SC_Bold.ttf`
   - `HarmonyOS_Sans_SC_Black.ttf`

## 🔄 添加新交易所

1. 在 `exchanges/` 下创建新目录
2. 添加 `config.json`（交易所配置）
3. 添加 `model.json`（模板配置，使用 `test.html` 编辑）
4. 添加底图文件（如 `ethusdt-background.jpg`）
5. 重启服务

## 📋 服务管理

```bash
./start.sh         # 启动服务
./stop.sh          # 停止服务
./restart.sh       # 重启服务
```

## 🌐 公网访问

使用 ngrok 暴露服务：

```bash
ngrok http 3070
```

## 📝 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

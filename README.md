# 加密货币晒单收益模拟 API

## 项目说明

支持多交易所、多交易对的晒单图片生成 API，根据历史时间自动获取价格，计算收益率并生成晒单图片。

## 目录结构

```
project/
├── server.js                  # API 服务器
├── exchanges/                 # 交易所配置目录
│   └── easicoin/              # easicoin 交易所（默认）
│       ├── config.json        # 交易所配置
│       ├── model.json         # 模板配置（文字位置、字体等）
│       └── ethusdt-background.jpg  # ETHUSDT 底图
├── API文档.md                 # 完整 API 文档
├── restart.sh                 # 重启服务脚本
├── restart-ngrok.sh           # 重启 ngrok 脚本
└── README.md
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
node server.js
# 或使用脚本
./start.sh
```

服务将在 `http://localhost:3070` 启动

### 测试 API

```bash
# 获取交易所列表
curl "http://localhost:3070/api/exchanges"

# 生成晒单图片（使用默认交易所 easicoin）
curl "http://localhost:3070/api/generate?tradepair=ETHUSDT&opendate=2025-12-01%2008:30&date=2025-12-03%2012:45&direction=long&lev=125"

# 指定交易所
curl "http://localhost:3070/api/generate?ex=easicoin&tradepair=ETHUSDT&opendate=2025-12-01%2008:30&date=2025-12-03%2012:45&direction=long&lev=125"
```

## API 参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| `ex` | 否 | 交易所 ID，默认 `easicoin` |
| `tradepair` | 是 | 交易对，如 ETHUSDT |
| `opendate` | 是 | 开仓时间 YYYY-MM-DD HH:mm |
| `date` | 是 | 显示时间 YYYY-MM-DD HH:mm |
| `lev` | 否 | 杠杆倍数，默认 10 |
| `direction` | 否 | long(做多) / short(做空)，默认 long |

## 返回格式

```json
{
  "success": true,
  "message": "ETH/USDT 做多 50x 杠杆，收益率 +475.03%",
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
    "opendate": "2025-12-02 10:00",
    "date": "2025-12-03 18:00",
    "direction": "做多",
    "leverage": 50,
    "entprice": 2795.09,
    "lastprice": 3060.64,
    "yield": "+475.03%"
  },
  "data": {
    "image": "data:image/png;base64,...",
    "base64": "...",
    "format": "png",
    "width": 908,
    "height": 1280,
    "params": { ... }
  }
}
```

## 添加新交易所

1. 在 `exchanges/` 下创建新目录，如 `exchanges/binance/`

2. 添加配置文件 `config.json`：

```json
{
  "name": "Binance",
  "displayName": "币安交易所",
  "priceSource": "binance",
  "supportedPairs": ["ETHUSDT", "BTCUSDT"],
  "template": {
    "width": 908,
    "height": 1280,
    "backgroundPattern": "{pair}-background.jpg"
  }
}
```

3. 添加模板文件 `model.json`（定义文字位置和样式）

4. 添加底图文件（如 `ethusdt-background.jpg`）

5. 重启服务：`./restart.sh`

## 添加新交易对

1. 准备底图文件（推荐尺寸：908x1280）
2. 按照命名规则保存：`{交易对小写}-background.jpg`
3. 将文件放在对应交易所目录下（如 `exchanges/easicoin/`）
4. 重启服务即可使用

### 底图命名示例

| 交易对 | 底图文件名 |
|--------|-----------|
| ETHUSDT | `ethusdt-background.jpg` |
| BTCUSDT | `btcusdt-background.jpg` |
| BNBUSDT | `bnbusdt-background.jpg` |

## 服务管理脚本

```bash
./start.sh         # 启动服务
./stop.sh          # 停止服务
./restart.sh       # 重启服务
./restart-ngrok.sh # 重启 ngrok（公共访问）
```

## 注意事项

1. 底图文件必须存在于对应交易所目录，否则 API 会返回错误
2. 交易对会自动转换为大写（如 ethusdt → ETHUSDT）
3. 价格数据来自 Binance API
4. 如果收益率为负，系统会自动切换多空方向确保收益为正
5. 如果不传 `ex` 参数，默认使用 `easicoin` 交易所

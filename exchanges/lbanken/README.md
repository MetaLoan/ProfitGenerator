# LBanken 交易所配置

## ⚠️ 占位资源说明

当前目录包含占位资源，需要替换为 LBanken 实际素材：

### 需要替换的文件

| 文件 | 说明 |
|------|------|
| `ethusdt-background.jpg` | ETH/USDT 交易对背景图 (908×1280) |
| `btcusdt-background.jpg` | BTC/USDT 交易对背景图 (908×1280) |
| `model.json` | 文字层位置配置 |

### 配置步骤

1. **准备背景图**
   - 将 LBanken 的晒单图模板保存为 `ethusdt-background.jpg`
   - 尺寸要求：908×1280 像素

2. **调整文字层位置**
   - 打开 `http://localhost:8080/test.html`
   - 上传 LBanken 的背景图
   - 导入当前 `model.json`
   - 拖拽调整各文字层位置
   - 导出新的 JSON 替换 `model.json`

3. **自定义样式**
   - 编辑 `config.json` 调整颜色、文案等
   - `displayTexts` 控制显示文案（Long/Short 等）
   - `styling` 控制颜色配置

### 当前配置特点

- 使用 **英文** 方向文案：Long / Short
- 使用 **Inter** 字体（现代无衬线）
- 收益颜色：`#00D4AA` (绿) / `#FF6B6B` (红)

### API 参数说明

| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `ex` | string | 否 | 交易所ID，默认 easicoin | `lbanken` |
| `tradepair` | string | ✅ | 交易对 | `ETHUSDT` / `BTCUSDT` |
| `opendate` | string | ✅ | 开仓时间 | `2025-12-01 10:00` |
| `date` | string | ✅ | 显示时间（用于获取最新价格） | `2025-12-04 18:00` |
| `direction` | string | ✅ | 方向 | `long` / `short` |
| `lev` | number | ✅ | 杠杆倍数 | `50` |
| `direction_action` | string | 否 | 开平动作 | `open` / `close` |
| `dynamic_direction_color` | boolean | 否 | 启用动态方向变色 | `true` / `false` |

### 测试页面

打开测试页面填写参数：
```
http://localhost:8080/api-test.html
```

在「交易所」字段填入 `lbanken` 即可测试本交易所配置。

### API 测试

```bash
# 基础测试
curl "http://localhost:3070/api/generate?ex=lbanken&tradepair=ETHUSDT&opendate=2025-12-01%2010:00&date=2025-12-04%2018:00&direction=long&lev=50"

# 带开平动作
curl "http://localhost:3070/api/generate?ex=lbanken&tradepair=ETHUSDT&opendate=2025-12-01%2010:00&date=2025-12-04%2018:00&direction=long&lev=100&direction_action=open"

# 启用动态变色
curl "http://localhost:3070/api/generate?ex=lbanken&tradepair=BTCUSDT&opendate=2025-12-01%2010:00&date=2025-12-04%2018:00&direction=short&lev=75&direction_action=close&dynamic_direction_color=true"
```

### 文件结构

```
exchanges/lbanken/
├── config.json              # 交易所配置
├── model.json               # 文字层模板
├── ethusdt-background.jpg   # ETH 背景图 (占位)
├── btcusdt-background.jpg   # BTC 背景图 (占位)
└── README.md                # 本文档
```


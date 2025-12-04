# 🚀 快速开始

## 一键操作

```bash
# 进入项目目录
cd /Users/leo/Desktop/create

# 重启服务（推荐）
./restart.sh
```

## 📋 常用命令

| 命令 | 说明 |
|------|------|
| `./restart.sh` | 🔄 一键重启服务 |
| `./start.sh` | ▶️ 启动服务 |
| `./stop.sh` | ⏸️ 停止服务 |
| `tail -f server.log` | 📄 查看实时日志 |
| `curl http://localhost:3070/api/health` | 💚 健康检查 |

## 🌐 服务地址

- **本地**: http://localhost:3070
- **公共域名**: https://nathalie-clothlike-urgently.ngrok-free.dev

## 🧪 快速测试

```bash
# 健康检查
curl http://localhost:3070/api/health

# 测试生成图片
curl "http://localhost:3070/api/generate?tradepair=ETHUSDT&opendate=2025-12-02%2017:20&date=2025-12-03%2017:20&direction=long&lev=50"
```

## 📚 详细文档

- `服务管理说明.md` - 完整的服务管理指南
- `API文档.md` - API 接口文档
- `最终修复说明.md` - 技术修复说明




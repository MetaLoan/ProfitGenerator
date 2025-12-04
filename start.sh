#!/bin/bash

# 启动服务脚本

PORT=3070
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 启动服务..."
echo "=================================="
echo ""

# 检查端口是否被占用
PID=$(lsof -ti:$PORT 2>/dev/null)
if [ ! -z "$PID" ]; then
    echo "⚠️  端口 $PORT 已被占用（PID: $PID）"
    echo "   请先运行 ./stop.sh 停止服务"
    exit 1
fi

# 切换到项目目录
cd "$SCRIPT_DIR" || {
    echo "❌ 无法切换到项目目录"
    exit 1
}

# 检查 server.js
if [ ! -f "server.js" ]; then
    echo "❌ 找不到 server.js 文件"
    exit 1
fi

# 启动服务
echo "📁 项目目录: $(pwd)"
echo "🚀 正在启动..."
nohup node server.js > server.log 2>&1 &
SERVER_PID=$!

echo "⏳ 等待服务启动..."
sleep 5

# 验证启动
HEALTH=$(curl -s http://localhost:$PORT/api/health 2>/dev/null)
if echo "$HEALTH" | grep -q "healthy" 2>/dev/null; then
    echo "✅ 服务启动成功！"
    echo ""
    echo "📍 服务信息："
    echo "   本地地址: http://localhost:$PORT"
    echo "   进程 PID: $SERVER_PID"
    echo "   日志文件: server.log"
else
    echo "⚠️  服务可能未完全启动，请检查日志"
    echo "   查看日志: tail -f server.log"
fi

echo ""




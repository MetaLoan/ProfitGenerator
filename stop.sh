#!/bin/bash

# 停止服务脚本

PORT=3070

echo "🛑 停止服务..."
echo "=================================="
echo ""

# 查找进程
PID=$(lsof -ti:$PORT 2>/dev/null)

if [ -z "$PID" ]; then
    echo "ℹ️  端口 $PORT 未被占用，服务可能未运行"
    exit 0
fi

echo "📋 找到进程 PID: $PID"

# 停止服务
echo "🛑 正在停止..."
kill -9 $PID 2>/dev/null

# 等待进程退出
sleep 2

# 验证是否已停止
REMAINING=$(lsof -ti:$PORT 2>/dev/null)
if [ -z "$REMAINING" ]; then
    echo "✅ 服务已停止"
else
    echo "⚠️  仍有进程占用端口，强制清理..."
    kill -9 $REMAINING 2>/dev/null
    sleep 1
    echo "✅ 服务已强制停止"
fi

echo ""




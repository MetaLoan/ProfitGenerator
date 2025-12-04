#!/bin/bash

# 一键重启服务脚本

PORT=3070
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="ETH 晒单收益模拟 API"

echo "🔄 重启 $SERVICE_NAME"
echo "=================================="
echo ""

# 1. 停止现有服务
echo "1️⃣  停止现有服务..."
PID=$(lsof -ti:$PORT 2>/dev/null)

if [ -z "$PID" ]; then
    echo "   ℹ️  端口 $PORT 未被占用，服务可能未运行"
else
    echo "   🛑 找到进程 PID: $PID"
    kill -9 $PID 2>/dev/null
    echo "   ✅ 已停止服务"
    
    # 等待进程完全退出
    echo "   ⏳ 等待进程退出..."
    sleep 2
    
    # 再次检查
    REMAINING=$(lsof -ti:$PORT 2>/dev/null)
    if [ ! -z "$REMAINING" ]; then
        echo "   ⚠️  仍有进程占用端口，强制清理..."
        kill -9 $REMAINING 2>/dev/null
        sleep 1
    fi
fi
echo ""

# 2. 检查端口是否已释放
echo "2️⃣  检查端口状态..."
PORT_CHECK=$(lsof -ti:$PORT 2>/dev/null)
if [ ! -z "$PORT_CHECK" ]; then
    echo "   ❌ 端口 $PORT 仍被占用，请手动检查"
    exit 1
else
    echo "   ✅ 端口 $PORT 已释放"
fi
echo ""

# 3. 切换到项目目录
echo "3️⃣  切换到项目目录..."
cd "$SCRIPT_DIR" || {
    echo "   ❌ 无法切换到项目目录: $SCRIPT_DIR"
    exit 1
}
echo "   📁 当前目录: $(pwd)"
echo ""

# 4. 检查 server.js 是否存在
if [ ! -f "server.js" ]; then
    echo "   ❌ 找不到 server.js 文件"
    exit 1
fi

# 5. 启动服务
echo "4️⃣  启动服务..."
echo "   🚀 启动中..."
nohup node server.js > server.log 2>&1 &
SERVER_PID=$!

# 等待服务启动
echo "   ⏳ 等待服务启动..."
sleep 3

# 6. 检查服务是否成功启动
echo "5️⃣  验证服务状态..."
sleep 2

HEALTH_CHECK=$(curl -s http://localhost:$PORT/api/health 2>/dev/null)
if echo "$HEALTH_CHECK" | grep -q "healthy" 2>/dev/null; then
    echo "   ✅ 服务启动成功！"
    echo ""
    echo "=================================="
    echo "✨ 重启完成"
    echo ""
    echo "📍 服务信息："
    echo "   本地地址: http://localhost:$PORT"
    echo "   进程 PID: $SERVER_PID"
    echo "   日志文件: $SCRIPT_DIR/server.log"
    echo ""
    echo "📊 健康状态："
    echo "$HEALTH_CHECK" | python3 -m json.tool 2>/dev/null | sed 's/^/   /' || echo "$HEALTH_CHECK"
    echo ""
    echo "💡 查看日志: tail -f server.log"
    echo "💡 停止服务: lsof -ti:$PORT | xargs kill -9"
else
    echo "   ⚠️  服务可能未完全启动，请检查日志"
    echo ""
    echo "📋 查看日志："
    tail -20 server.log 2>/dev/null || echo "   无法读取日志文件"
    echo ""
    echo "💡 手动检查: tail -f server.log"
fi

echo ""




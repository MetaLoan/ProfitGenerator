#!/bin/bash

# 重启 ngrok 脚本

PORT=3070

echo "🔄 重启 ngrok 公共访问..."
echo "=================================="
echo ""

# 1. 检查服务是否运行
echo "1️⃣  检查服务状态..."
PID=$(lsof -ti:$PORT 2>/dev/null)

if [ -z "$PID" ]; then
    echo "   ❌ 端口 $PORT 未被占用，服务未运行"
    echo "   请先运行 ./start.sh 启动服务"
    exit 1
fi

echo "   ✅ 服务运行中 (PID: $PID)"
echo ""

# 2. 停止现有 ngrok
echo "2️⃣  停止现有 ngrok..."
pkill -f ngrok 2>/dev/null
sleep 2
echo "   ✅ 已停止"
echo ""

# 3. 启动新 ngrok
echo "3️⃣  启动新的 ngrok 隧道..."
nohup ngrok http $PORT > ngrok.log 2>&1 &
NGROK_PID=$!

echo "   ⏳ 等待 ngrok 启动..."
sleep 8

# 4. 获取公共 URL
echo "4️⃣  获取公共访问地址..."

PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | \
  python3 -c "import sys, json; data = json.load(sys.stdin); \
    tunnels = data.get('tunnels', []); \
    https_tunnel = [t for t in tunnels if 'https' in t.get('public_url', '')]; \
    print(https_tunnel[0]['public_url'] if https_tunnel else '')" 2>/dev/null)

if [ -z "$PUBLIC_URL" ]; then
    echo "   ⚠️  无法获取公共 URL，请检查 ngrok.log"
    echo "   查看日志: tail -f ngrok.log"
    exit 1
fi

echo "   ✅ 成功！"
echo ""
echo "=================================="
echo "🌐 公共访问地址:"
echo "   $PUBLIC_URL"
echo ""
echo "📋 测试命令:"
echo "   curl \"$PUBLIC_URL/api/health\""
echo ""
echo "💡 查看 ngrok 日志: tail -f ngrok.log"
echo "💡 查看 ngrok 状态: curl http://localhost:4040/api/tunnels"
echo ""




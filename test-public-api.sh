#!/bin/bash

# 公共域名测试脚本

PUBLIC_URL="https://nathalie-clothlike-urgently.ngrok-free.dev"

echo "🧪 测试公共 API 域名"
echo "=================================="
echo ""

# 1. 健康检查
echo "1️⃣  测试健康检查端点..."
HEALTH=$(curl -s -H "ngrok-skip-browser-warning: true" "$PUBLIC_URL/api/health")
if echo "$HEALTH" | grep -q "healthy"; then
    echo "   ✅ 健康检查通过"
    echo "$HEALTH" | python3 -m json.tool | sed 's/^/   /'
else
    echo "   ❌ 健康检查失败"
    echo "$HEALTH"
fi
echo ""

# 2. 测试生成图片
echo "2️⃣  测试生成晒单图片..."
RESPONSE=$(curl -s -H "ngrok-skip-browser-warning: true" "$PUBLIC_URL/api/generate?tradepair=ETHUSDT&opendate=2025-12-02%2017:20&date=2025-12-03%2017:20&direction=long&lev=50")

if echo "$RESPONSE" | python3 -c "import sys, json; r=json.load(sys.stdin); sys.exit(0 if r.get('success') else 1)" 2>/dev/null; then
    echo "   ✅ 生成成功"
    echo "$RESPONSE" | python3 -c "import sys, json; r=json.load(sys.stdin); print('   收益率:', r['data']['params']['yield']); print('   图片大小:', len(r['data']['base64']), '字符')" 2>/dev/null
else
    echo "   ❌ 生成失败"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
fi
echo ""

# 3. 显示完整响应（可选）
if [ "$1" == "--full" ]; then
    echo "3️⃣  完整响应："
    echo "$RESPONSE" | python3 -m json.tool | head -30
fi

echo ""
echo "=================================="
echo "✨ 测试完成"




#!/bin/bash
# 下载 HarmonyOS Sans SC 字体
# 运行方式: chmod +x download-fonts.sh && ./download-fonts.sh

echo "📦 下载 HarmonyOS Sans SC 字体..."

# 字重列表
WEIGHTS=("Thin" "Light" "Regular" "Medium" "Bold" "Black")

# 下载地址 (使用华为官方资源或镜像)
# 注意：如果链接失效，请从 https://developer.huawei.com/consumer/cn/design/harmonyos-design/ 手动下载
BASE_URL="https://communityfile-drcn.op.hicloud.com/FileServer/getFile/cmtyPub/011/111/111/0000000000011111111.20230517175717.12665436363853765721667195639023:50001231000000:2800:9E1E3DF40F638A0B1C41B9E15C2E7F67C8E17D04D92A2C41AB6AACF6F2DCE3F0.zip"

echo "⚠️  自动下载可能不可用，请手动下载字体："
echo ""
echo "1. 访问: https://developer.huawei.com/consumer/cn/design/harmonyos-design/"
echo "2. 点击「HarmonyOS Sans」下载按钮"
echo "3. 解压后将以下文件复制到此目录 (fonts/):"
echo ""

for weight in "${WEIGHTS[@]}"; do
  echo "   - HarmonyOS_Sans_SC_${weight}.ttf"
done

echo ""
echo "或者使用简体中文版本:"
for weight in "${WEIGHTS[@]}"; do
  echo "   - HarmonyOS_Sans_SC_${weight}.ttf"
done

echo ""
echo "📝 下载完成后，字体将自动生效。"


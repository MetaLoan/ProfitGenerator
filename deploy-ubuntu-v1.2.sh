#!/bin/bash

#==============================================================================
# 🚀 加密货币晒单收益模拟 API - Ubuntu 一键部署脚本
# 
# 版本: v1.2
# 更新: 2025-12-05
# 支持: Ubuntu 20.04 / 22.04 / 24.04
#
# 使用方法:
#   curl -fsSL https://raw.githubusercontent.com/MetaLoan/ProfitGenerator/main/deploy-ubuntu-v1.2.sh | bash
#
# 更新日志:
#   v1.2 - 添加 swap 配置防止 OOM，自动配置 setcap，优化服务配置
#   v1.1 - 兼容 Ubuntu 24.04 包名变更
#   v1.0 - 初始版本
#==============================================================================

VERSION="v1.2"

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置
REPO_URL="https://github.com/MetaLoan/ProfitGenerator.git"
INSTALL_DIR="$HOME/ProfitGenerator"
PORT=80
SERVICE_NAME="profit-generator"
SWAP_SIZE="2G"  # swap 大小

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  🚀 加密货币晒单收益模拟 API - Ubuntu 一键部署               ║"
echo "║  版本: ${VERSION}  |  支持: Ubuntu 20.04 / 22.04 / 24.04          ║"
echo "║  GitHub: https://github.com/MetaLoan/ProfitGenerator         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# 检测系统
check_system() {
    echo -e "\n${BLUE}🔍 检测系统环境...${NC}"
    
    if [[ ! -f /etc/os-release ]]; then
        echo -e "${RED}❌ 无法检测操作系统${NC}"
        exit 1
    fi
    
    source /etc/os-release
    echo -e "${GREEN}   ✅ 系统: ${ID} ${VERSION_ID}${NC}"
    
    # 检测内存
    TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
    echo -e "${GREEN}   ✅ 内存: ${TOTAL_MEM}MB${NC}"
    
    if [[ $TOTAL_MEM -lt 1024 ]]; then
        echo -e "${YELLOW}   ⚠️  内存较低，将配置 swap 防止 OOM${NC}"
    fi
}

# 配置 swap（防止 OOM）
setup_swap() {
    echo -e "\n${BLUE}📦 步骤 1/7: 配置 swap（防止内存不足）...${NC}"
    
    # 检查是否已有 swap
    if [[ $(swapon --show | wc -l) -gt 0 ]]; then
        echo -e "${YELLOW}   已存在 swap，跳过${NC}"
        return
    fi
    
    # 创建 swap 文件
    echo -e "${GREEN}   创建 ${SWAP_SIZE} swap 文件...${NC}"
    sudo fallocate -l ${SWAP_SIZE} /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    
    # 持久化
    if ! grep -q '/swapfile' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
    fi
    
    echo -e "${GREEN}   ✅ Swap 配置完成${NC}"
}

# 安装 Node.js 20.x
install_nodejs() {
    echo -e "\n${BLUE}📦 步骤 2/7: 安装 Node.js 20.x...${NC}"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | tr -d 'v')
        if [[ $MAJOR_VERSION -ge 18 ]]; then
            echo -e "${GREEN}   ✅ 已安装 Node.js ${NODE_VERSION}${NC}"
            return
        fi
    fi
    
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    echo -e "${GREEN}   ✅ Node.js $(node -v) 安装完成${NC}"
}

# 安装系统依赖
install_dependencies() {
    echo -e "\n${BLUE}📦 步骤 3/7: 安装系统依赖...${NC}"
    
    sudo apt-get update
    sudo apt-get install -y git curl wget unzip
    
    # Playwright 依赖 - 兼容 Ubuntu 22.04 和 24.04
    PACKAGES=(libnss3 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2)
    
    for pkg in "${PACKAGES[@]}"; do
        sudo apt-get install -y "$pkg" 2>/dev/null || true
    done
    
    # 带 t64 后缀的包（Ubuntu 24.04）
    sudo apt-get install -y libasound2t64 2>/dev/null || sudo apt-get install -y libasound2 2>/dev/null || true
    sudo apt-get install -y libatk1.0-0t64 2>/dev/null || sudo apt-get install -y libatk1.0-0 2>/dev/null || true
    sudo apt-get install -y libatk-bridge2.0-0t64 2>/dev/null || sudo apt-get install -y libatk-bridge2.0-0 2>/dev/null || true
    sudo apt-get install -y libcups2t64 2>/dev/null || sudo apt-get install -y libcups2 2>/dev/null || true
    sudo apt-get install -y libdrm2 2>/dev/null || true
    sudo apt-get install -y libatspi2.0-0t64 2>/dev/null || sudo apt-get install -y libatspi2.0-0 2>/dev/null || true
    
    echo -e "${GREEN}   ✅ 系统依赖安装完成${NC}"
}

# 克隆仓库
clone_repo() {
    echo -e "\n${BLUE}📦 步骤 4/7: 克隆代码仓库...${NC}"
    
    if [[ -d "$INSTALL_DIR" ]]; then
        echo -e "${YELLOW}   目录已存在，更新代码...${NC}"
        cd "$INSTALL_DIR"
        git pull origin main
    else
        git clone "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi
    
    echo -e "${GREEN}   ✅ 代码准备完成: $INSTALL_DIR${NC}"
}

# 安装 npm 依赖
install_npm_deps() {
    echo -e "\n${BLUE}📦 步骤 5/7: 安装 npm 依赖...${NC}"
    
    cd "$INSTALL_DIR"
    npm install
    
    echo -e "${GREEN}   ✅ npm 依赖安装完成${NC}"
}

# 安装 Playwright 浏览器
install_playwright() {
    echo -e "\n${BLUE}📦 步骤 6/7: 安装 Playwright 浏览器...${NC}"
    
    cd "$INSTALL_DIR"
    npx playwright install chromium
    
    # 配置 setcap 让 Node.js 可以监听 80 端口
    echo -e "${GREEN}   配置 Node.js 低端口权限...${NC}"
    sudo setcap 'cap_net_bind_service=+ep' $(which node)
    
    echo -e "${GREEN}   ✅ Playwright 浏览器安装完成${NC}"
}

# 创建 systemd 服务
create_service() {
    echo -e "\n${BLUE}📦 步骤 7/7: 创建系统服务...${NC}"
    
    sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=Profit Generator API Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$(which node) server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}
Environment=NODE_ENV=production
Environment=PORT=${PORT}

# 内存限制和优化
MemoryMax=1G
MemoryHigh=800M

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable ${SERVICE_NAME}
    sudo systemctl start ${SERVICE_NAME}
    
    echo -e "${GREEN}   ✅ 系统服务创建完成${NC}"
}

# 配置防火墙
configure_firewall() {
    echo -e "\n${BLUE}🔥 配置防火墙...${NC}"
    
    if command -v ufw &> /dev/null; then
        sudo ufw allow 80/tcp 2>/dev/null || true
        echo -e "${GREEN}   ✅ 已开放端口 80${NC}"
    fi
}

# 获取公网 IP
get_public_ip() {
    PUBLIC_IP=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || curl -s --connect-timeout 5 ipinfo.io/ip 2>/dev/null || echo "无法获取")
    echo "$PUBLIC_IP"
}

# 等待服务启动
wait_for_service() {
    echo -e "\n${BLUE}⏳ 等待服务启动...${NC}"
    
    for i in {1..30}; do
        if curl -s --connect-timeout 2 "http://localhost/api/health" > /dev/null 2>&1; then
            echo -e "${GREEN}   ✅ 服务已就绪${NC}"
            return 0
        fi
        sleep 2
        echo -n "."
    done
    
    echo -e "\n${YELLOW}   ⚠️  服务启动较慢，请稍后检查${NC}"
    return 1
}

# 打印结果
print_result() {
    PUBLIC_IP=$(get_public_ip)
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    
    echo -e "\n${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  🎉 部署完成！                                               ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    echo -e "${CYAN}📍 API 访问地址:${NC}"
    echo -e "   本地访问:   ${GREEN}http://localhost${NC}"
    echo -e "   内网访问:   ${GREEN}http://${LOCAL_IP}${NC}"
    echo -e "   公网访问:   ${GREEN}http://${PUBLIC_IP}${NC}"
    
    echo -e "\n${CYAN}🔗 常用接口:${NC}"
    echo -e "   API 首页:        ${BLUE}http://${PUBLIC_IP}/${NC}"
    echo -e "   健康检查:        ${BLUE}http://${PUBLIC_IP}/api/health${NC}"
    echo -e "   交易所列表:      ${BLUE}http://${PUBLIC_IP}/api/exchanges${NC}"
    echo -e "   生成图片示例:    ${BLUE}http://${PUBLIC_IP}/api/generate?tradepair=ETHUSDT&opendate=2025-12-01%2008:00&date=2025-12-03%2012:00&direction=long&lev=100${NC}"
    
    echo -e "\n${CYAN}🛠️ 服务管理命令:${NC}"
    echo -e "   查看状态:   ${YELLOW}sudo systemctl status ${SERVICE_NAME}${NC}"
    echo -e "   查看日志:   ${YELLOW}sudo journalctl -u ${SERVICE_NAME} -f${NC}"
    echo -e "   重启服务:   ${YELLOW}sudo systemctl restart ${SERVICE_NAME}${NC}"
    echo -e "   停止服务:   ${YELLOW}sudo systemctl stop ${SERVICE_NAME}${NC}"
    
    echo -e "\n${CYAN}📁 安装目录:${NC} ${INSTALL_DIR}"
    
    echo -e "\n${CYAN}📊 系统信息:${NC}"
    echo -e "   内存: $(free -h | awk '/^Mem:/{print $2}')"
    echo -e "   Swap: $(free -h | awk '/^Swap:/{print $2}')"
    
    echo -e "\n${YELLOW}⚠️  注意事项:${NC}"
    echo -e "   1. 确保云服务器安全组已开放端口 80"
    echo -e "   2. 首次生成图片需要初始化浏览器，可能较慢"
    echo -e "   3. 如遇问题，查看日志: sudo journalctl -u ${SERVICE_NAME} -n 100"
    
    echo ""
}

# 主函数
main() {
    check_system
    setup_swap
    install_nodejs
    install_dependencies
    clone_repo
    install_npm_deps
    install_playwright
    create_service
    configure_firewall
    wait_for_service
    print_result
}

# 执行
main


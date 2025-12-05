#!/bin/bash

#==============================================================================
# 🚀 加密货币晒单收益模拟 API - Ubuntu 一键部署脚本
# 
# 使用方法:
#   curl -fsSL https://raw.githubusercontent.com/MetaLoan/ProfitGenerator/main/deploy-ubuntu.sh | bash
#
# 或下载后执行:
#   chmod +x deploy-ubuntu.sh && ./deploy-ubuntu.sh
#==============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置
REPO_URL="https://github.com/MetaLoan/ProfitGenerator.git"
INSTALL_DIR="$HOME/ProfitGenerator"
PORT=3070
SERVICE_NAME="profit-generator"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  🚀 加密货币晒单收益模拟 API - Ubuntu 一键部署               ║"
echo "║  GitHub: https://github.com/MetaLoan/ProfitGenerator         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# 检测系统
check_system() {
    if [[ ! -f /etc/os-release ]]; then
        echo -e "${RED}❌ 无法检测操作系统${NC}"
        exit 1
    fi
    
    source /etc/os-release
    echo -e "${GREEN}✅ 检测到系统: ${ID} ${VERSION_ID}${NC}"
}

# 安装 Node.js 20.x
install_nodejs() {
    echo -e "\n${BLUE}📦 步骤 1/6: 安装 Node.js 20.x...${NC}"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        echo -e "${YELLOW}   已安装 Node.js ${NODE_VERSION}${NC}"
        
        # 检查版本是否 >= 18
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | tr -d 'v')
        if [[ $MAJOR_VERSION -ge 18 ]]; then
            echo -e "${GREEN}   ✅ 版本满足要求${NC}"
            return
        fi
    fi
    
    # 安装 Node.js 20.x
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    echo -e "${GREEN}   ✅ Node.js $(node -v) 安装完成${NC}"
}

# 安装系统依赖
install_dependencies() {
    echo -e "\n${BLUE}📦 步骤 2/6: 安装系统依赖...${NC}"
    
    sudo apt-get update
    sudo apt-get install -y \
        git \
        curl \
        wget \
        unzip \
        libnss3 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libdrm2 \
        libxkbcommon0 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxrandr2 \
        libgbm1 \
        libasound2 \
        libpango-1.0-0 \
        libcairo2 \
        libatspi2.0-0
    
    echo -e "${GREEN}   ✅ 系统依赖安装完成${NC}"
}

# 克隆仓库
clone_repo() {
    echo -e "\n${BLUE}📦 步骤 3/6: 克隆代码仓库...${NC}"
    
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
    echo -e "\n${BLUE}📦 步骤 4/6: 安装 npm 依赖...${NC}"
    
    cd "$INSTALL_DIR"
    npm install
    
    echo -e "${GREEN}   ✅ npm 依赖安装完成${NC}"
}

# 安装 Playwright 浏览器
install_playwright() {
    echo -e "\n${BLUE}📦 步骤 5/6: 安装 Playwright 浏览器...${NC}"
    
    cd "$INSTALL_DIR"
    npx playwright install chromium
    
    echo -e "${GREEN}   ✅ Playwright 浏览器安装完成${NC}"
}

# 创建 systemd 服务
create_service() {
    echo -e "\n${BLUE}📦 步骤 6/6: 创建系统服务...${NC}"
    
    # 创建服务文件
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
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=${SERVICE_NAME}
Environment=NODE_ENV=production
Environment=PORT=${PORT}

[Install]
WantedBy=multi-user.target
EOF

    # 重载 systemd
    sudo systemctl daemon-reload
    
    # 启用并启动服务
    sudo systemctl enable ${SERVICE_NAME}
    sudo systemctl start ${SERVICE_NAME}
    
    echo -e "${GREEN}   ✅ 系统服务创建完成${NC}"
}

# 配置防火墙
configure_firewall() {
    echo -e "\n${BLUE}🔥 配置防火墙...${NC}"
    
    if command -v ufw &> /dev/null; then
        sudo ufw allow ${PORT}/tcp 2>/dev/null || true
        echo -e "${GREEN}   ✅ 已开放端口 ${PORT}${NC}"
    fi
}

# 获取公网 IP
get_public_ip() {
    PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "无法获取")
    echo "$PUBLIC_IP"
}

# 检查服务状态
check_service() {
    sleep 3
    
    if sudo systemctl is-active --quiet ${SERVICE_NAME}; then
        return 0
    else
        return 1
    fi
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
    echo -e "   本地访问:   ${GREEN}http://localhost:${PORT}${NC}"
    echo -e "   内网访问:   ${GREEN}http://${LOCAL_IP}:${PORT}${NC}"
    echo -e "   公网访问:   ${GREEN}http://${PUBLIC_IP}:${PORT}${NC}"
    
    echo -e "\n${CYAN}🔗 常用接口:${NC}"
    echo -e "   API 首页:        ${BLUE}http://${PUBLIC_IP}:${PORT}/${NC}"
    echo -e "   健康检查:        ${BLUE}http://${PUBLIC_IP}:${PORT}/api/health${NC}"
    echo -e "   交易所列表:      ${BLUE}http://${PUBLIC_IP}:${PORT}/api/exchanges${NC}"
    echo -e "   生成图片:        ${BLUE}http://${PUBLIC_IP}:${PORT}/api/generate?tradepair=ETHUSDT&opendate=2025-12-01%2008:00&date=2025-12-03%2012:00&direction=long&lev=100${NC}"
    
    echo -e "\n${CYAN}🛠️ 服务管理命令:${NC}"
    echo -e "   查看状态:   ${YELLOW}sudo systemctl status ${SERVICE_NAME}${NC}"
    echo -e "   查看日志:   ${YELLOW}sudo journalctl -u ${SERVICE_NAME} -f${NC}"
    echo -e "   重启服务:   ${YELLOW}sudo systemctl restart ${SERVICE_NAME}${NC}"
    echo -e "   停止服务:   ${YELLOW}sudo systemctl stop ${SERVICE_NAME}${NC}"
    
    echo -e "\n${CYAN}📁 安装目录:${NC} ${INSTALL_DIR}"
    
    echo -e "\n${YELLOW}⚠️  注意事项:${NC}"
    echo -e "   1. 确保云服务器安全组/防火墙已开放端口 ${PORT}"
    echo -e "   2. 建议配置 Nginx 反向代理并启用 HTTPS"
    echo -e "   3. 如需使用 HarmonyOS Sans 字体，请手动下载到 fonts/ 目录"
    
    echo ""
}

# 主函数
main() {
    check_system
    install_nodejs
    install_dependencies
    clone_repo
    install_npm_deps
    install_playwright
    create_service
    configure_firewall
    
    if check_service; then
        print_result
    else
        echo -e "\n${RED}❌ 服务启动失败，请检查日志:${NC}"
        echo -e "   ${YELLOW}sudo journalctl -u ${SERVICE_NAME} -n 50${NC}"
        exit 1
    fi
}

# 执行
main


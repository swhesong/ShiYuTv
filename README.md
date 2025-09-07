# 🎬 ShiYuTV

<div align="center">
  <img src="public/logo.png" alt="ShiYuTV Logo" width="160" style="border-radius: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.12);">
  
  <h3 style="margin: 24px 0 8px 0; color: #1a1a1a; font-weight: 700;">跨平台影视聚合播放器</h3>
  <p style="color: #6b7280; font-size: 16px; margin: 0 0 32px 0; max-width: 600px;">
    基于 Next.js 14 构建的现代化影视应用，支持多资源搜索、云端同步、离线缓存，为您提供无缝的观影体验
  </p>

  <!-- 技术栈徽章 -->
  <div style="margin: 24px 0;">
    <img src="https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" style="margin: 4px;">
    <img src="https://img.shields.io/badge/TailwindCSS-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="TailwindCSS" style="margin: 4px;">
    <img src="https://img.shields.io/badge/TypeScript-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" style="margin: 4px;">
    <img src="https://img.shields.io/badge/Docker-2496ed?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" style="margin: 4px;">
  </div>

  <!-- 状态徽章 -->
  <div style="margin: 16px 0 32px 0;">
    <img src="https://img.shields.io/badge/License-MIT-22c55e?style=flat-square" alt="License" style="margin: 0 4px;">
    <img src="https://img.shields.io/badge/PWA-Ready-ff6b6b?style=flat-square" alt="PWA Ready" style="margin: 0 4px;">
    <img src="https://img.shields.io/badge/Mobile-Optimized-blue?style=flat-square" alt="Mobile Optimized" style="margin: 0 4px;">
  </div>
</div>

---

## ✨ 核心特性

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin: 32px 0;">

### 🔍 智能聚合搜索
**一键全网搜索**  
集成多个资源站点，单次搜索即可获得全网影视资源，告别逐站搜索的繁琐

### 📱 PWA 原生体验
**离线可用 · 桌面安装**  
支持离线缓存和桌面安装，在移动设备上提供接近原生应用的流畅体验

### ☁️ 云端同步
**多端数据同步**  
基于 Kvrocks/Redis/Upstash 存储，收藏夹和播放进度在所有设备间实时同步

### 🎨 响应式设计
**精美界面 · 自适应布局**  
现代化 UI 设计，支持深色模式，完美适配桌面端和移动端各种屏幕尺寸

### ▶️ 高质量播放
**流畅播放 · 智能优化**  
集成 ArtPlayer 和 HLS.js，支持多种视频格式，智能跳过广告片段

### 📊 详尽信息展示
**丰富的影视资料**  
完整的剧集列表、演员信息、上映年份、剧情简介等详细信息展示

</div>

> ⚠️ **重要提示**：部署后项目为空壳应用，无内置播放源和直播源，需要管理员自行配置资源站点

<details>
<summary>📸 <strong>项目截图预览</strong></summary>

<div style="margin: 20px 0;">
  <img src="public/screenshot1.png" alt="主界面" style="max-width: 100%; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); margin: 8px 0;">
  <img src="public/screenshot2.png" alt="搜索界面" style="max-width: 100%; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); margin: 8px 0;">
  <img src="public/screenshot3.png" alt="播放界面" style="max-width: 100%; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); margin: 8px 0;">
  <img src="public/screenshot4.png" alt="移动端界面" style="max-width: 100%; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); margin: 8px 0;">
</div>

</details>

---

## 🏗️ 技术架构

<div style="margin: 24px 0;">

| 技术分类 | 核心技术 | 描述 |
|----------|----------|------|
| **🎯 前端框架** | Next.js 14 · App Router | 现代化 React 全栈框架 |
| **🎨 UI 设计** | Tailwind CSS 3 | 原子化 CSS 框架 |
| **⚡ 开发语言** | TypeScript 4 | 类型安全的 JavaScript |
| **📺 播放引擎** | ArtPlayer · HLS.js | 高性能视频播放解决方案 |
| **🔧 开发工具** | ESLint · Prettier · Jest | 代码质量保障 |
| **🚀 部署方案** | Docker | 容器化部署 |

</div>

---

## 🚀 快速部署

> 💡 **推荐方式**：使用 Docker Compose 进行容器化部署

### 方案一：Kvrocks 存储（🌟 推荐）

```yaml
# docker-compose.yml
services:
  shiyutv-core:
    image: devinglaw/shiyutv:latest
    container_name: shiyutv-core
    restart: unless-stopped
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=kvrocks
      - KVROCKS_URL=redis://shiyutv-kvrocks:6666
    networks:
      - shiyutv-network
    depends_on:
      - shiyutv-kvrocks

  shiyutv-kvrocks:
    image: apache/kvrocks
    container_name: shiyutv-kvrocks
    restart: unless-stopped
    volumes:
      - kvrocks-data:/var/lib/kvrocks
    networks:
      - shiyutv-network

networks:
  shiyutv-network:
    driver: bridge

volumes:
  kvrocks-data:
    driver: local
```

### 方案二：Redis 存储

```yaml
# docker-compose.yml
services:
  shiyutv-core:
    image: devinglaw/shiyutv:latest
    container_name: shiyutv-core
    restart: unless-stopped
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=redis
      - REDIS_URL=redis://shiyutv-redis:6379
    networks:
      - shiyutv-network
    depends_on:
      - shiyutv-redis

  shiyutv-redis:
    image: redis:alpine
    container_name: shiyutv-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - ./data:/data
    networks:
      - shiyutv-network

networks:
  shiyutv-network:
    driver: bridge
```

### 方案三：Upstash 云存储

1. **注册 Upstash 账号**  
   访问 [upstash.com](https://upstash.com/) 创建 Redis 实例

2. **获取连接信息**  
   复制 **HTTPS ENDPOINT** 和 **TOKEN**

3. **部署配置**
```yaml
# docker-compose.yml
services:
  shiyutv-core:
    image: devinglaw/shiyutv:latest
    container_name: shiyutv-core
    restart: unless-stopped
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=upstash
      - UPSTASH_URL=你的_HTTPS_ENDPOINT
      - UPSTASH_TOKEN=你的_TOKEN
```

---

## ⚙️ 配置管理

### 📋 配置文件结构

完成部署后，需要在管理后台配置资源站点。配置文件采用 JSON 格式：

```json
{
  "cache_time": 7200,
  "api_site": {
    "example_site": {
      "api": "https://api.example.com/provide/vod",
      "name": "示例影视资源",
      "detail": "https://www.example.com"
    }
  },
  "custom_category": [
    {
      "name": "华语电影",
      "type": "movie",
      "query": "华语"
    },
    {
      "name": "美剧推荐", 
      "type": "tv",
      "query": "美剧"
    }
  ]
}
```

### 🏷️ 配置项说明

<div style="margin: 20px 0;">

| 配置项 | 类型 | 说明 |
|--------|------|------|
| **cache_time** | `number` | API 缓存时间（秒），建议 7200 |
| **api_site** | `object` | 资源站点配置对象 |
| **custom_category** | `array` | 自定义分类配置数组 |

</div>

### 🎯 自定义分类

支持创建个性化的影视分类，可用的预设分类：

**电影分类**：热门、最新、经典、豆瓣高分、冷门佳片、华语、欧美、韩国、日本、动作、喜剧、爱情、科幻、悬疑、恐怖、治愈

**电视剧分类**：热门、美剧、英剧、韩剧、日剧、国产剧、港剧、日本动画、综艺、纪录片

---

## 🔄 自动更新

### 使用 Watchtower

```bash
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --cleanup \
  --interval 86400
```

### Docker Compose UI

支持 Dockge、Portainer、Komodo 等主流 Docker 管理界面的自动更新功能

---

## 🌐 环境变量配置

### 📋 完整变量列表

<div style="margin: 20px 0; overflow-x: auto;">

| 变量名 | 说明 | 可选值 | 默认值 |
|--------|------|--------|--------|
| **基础配置** ||||
| `USERNAME` | 管理员用户名 | 任意字符串 | 必填 |
| `PASSWORD` | 管理员密码 | 任意字符串 | 必填 |
| `SITE_BASE` | 站点根域名 | `https://example.com` | 空 |
| `NEXT_PUBLIC_SITE_NAME` | 站点显示名称 | 任意字符串 | `ShiYuTV` |
| `ANNOUNCEMENT` | 站点公告 | 任意字符串 | 默认免责声明 |
| **存储配置** ||||
| `NEXT_PUBLIC_STORAGE_TYPE` | 存储类型 | `redis` `kvrocks` `upstash` | 必填 |
| `KVROCKS_URL` | Kvrocks 连接地址 | Redis URL | 空 |
| `REDIS_URL` | Redis 连接地址 | Redis URL | 空 |
| `UPSTASH_URL` | Upstash 连接地址 | HTTPS URL | 空 |
| `UPSTASH_TOKEN` | Upstash 访问令牌 | Token 字符串 | 空 |
| **功能配置** ||||
| `NEXT_PUBLIC_SEARCH_MAX_PAGE` | 搜索最大页数 | `1-50` | `5` |
| `NEXT_PUBLIC_FLUID_SEARCH` | 流式搜索输出 | `true` `false` | `true` |
| `NEXT_PUBLIC_DISABLE_YELLOW_FILTER` | 关闭内容过滤 | `true` `false` | `false` |
| **豆瓣配置** ||||
| `NEXT_PUBLIC_DOUBAN_PROXY_TYPE` | 豆瓣数据代理 | 见下方说明 | `direct` |
| `NEXT_PUBLIC_DOUBAN_PROXY` | 自定义代理地址 | URL 前缀 | 空 |
| `NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE` | 豆瓣图片代理 | 见下方说明 | `direct` |
| `NEXT_PUBLIC_DOUBAN_IMAGE_PROXY` | 自定义图片代理 | URL 前缀 | 空 |

</div>

### 🔗 豆瓣代理配置详解

**数据代理类型 (`DOUBAN_PROXY_TYPE`)**
- `direct`: 服务器直连豆瓣官方
- `cors-proxy-zwei`: 使用 Zwei 提供的 CORS 代理
- `cmliussss-cdn-tencent`: CMLiussss 腾讯云 CDN
- `cmliussss-cdn-ali`: CMLiussss 阿里云 CDN  
- `custom`: 自定义代理地址

**图片代理类型 (`DOUBAN_IMAGE_PROXY_TYPE`)**
- `direct`: 浏览器直连豆瓣图片
- `server`: 服务器代理请求
- `img3`: 豆瓣官方阿里云 CDN
- `cmliussss-cdn-tencent`: CMLiussss 腾讯云 CDN
- `cmliussss-cdn-ali`: CMLiussss 阿里云 CDN
- `custom`: 自定义图片代理

---

## 📱 Android TV 支持

### 方法一：Edge 浏览器安装

1. 使用 Edge 手机浏览器访问应用
2. 点击右下角菜单中的"添加到手机"
3. 安装 PWA 应用到设备

<details>
<summary>📸 <strong>安装截图演示</strong></summary>

<div style="margin: 16px 0;">
  <img src="public/android.png" alt="Android 安装演示" style="max-width: 400px; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.1);">
</div>

</details>

### 方法二：OrionTV 集成

配合 [OrionTV](https://github.com/zimplexing/OrionTV) 在 Android TV 上使用，可直接作为 OrionTV 的后端数据源。

**✅ 两种方式均支持播放记录与网页端同步**

---

## 🔒 安全与隐私

### ⚠️ 重要安全提醒

<div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 24px; border-radius: 12px; border-left: 4px solid #f59e0b; margin: 24px 0;">

**🛡️ 请务必设置强密码并关闭公网注册**

为确保您的数据安全并避免潜在的法律风险，请严格按照以下要求操作：

</div>

### 📋 部署安全检查清单

- [ ] ✅ 设置复杂的管理员密码 (`PASSWORD` 环境变量)
- [ ] 🔒 仅供个人或家庭内部使用
- [ ] 🚫 禁止公开分享实例链接
- [ ] ⚖️ 确保使用行为符合当地法律法规
- [ ] 🔐 定期更新容器镜像版本

### 📜 免责声明

<div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">

- 本项目仅供**学习研究**和**个人使用**
- 请勿用于**商业用途**或**公共服务**
- 项目开发者不对用户使用行为承担任何法律责任
- 本项目不在中国大陆地区提供服务
- 用户需自行承担使用过程中的所有法律风险和责任

</div>

---

## 📜 开源许可

本项目基于 [MIT License](LICENSE) 开源协议发布

---

## 🙏 致谢与贡献

### 🏆 特别感谢

<div style="margin: 24px 0;">

- **[ts-nextjs-tailwind-starter](https://github.com/theodorusclarence/ts-nextjs-tailwind-starter)** - 项目脚手架基础
- **[LibreTV](https://github.com/LibreSpark/LibreTV)** - 项目灵感来源
- **[MoonTV](https://github.com/MoonTechLab/LunaTV)** - 功能参考与完善
- **[ArtPlayer](https://github.com/zhw2590582/ArtPlayer)** - 强大的网页播放器
- **[HLS.js](https://github.com/video-dev/hls.js)** - HLS 流媒体支持
- **[Zwei](https://github.com/bestzwei)** - 豆瓣数据 CORS 代理服务
- **[CMLiussss](https://github.com/cmliu)** - 豆瓣 CDN 加速服务

</div>

### 🌟 社区贡献

感谢所有为项目提供免费影视接口的站点维护者，以及每一位贡献代码和建议的开发者。

### 📈 项目热度

<div align="center" style="margin: 32px 0;">
  <a href="https://star-history.com/#swhesong/ShiYuTv&Date">
    <img src="https://api.star-history.com/svg?repos=swhesong/ShiYuTv&type=Date" alt="Star History Chart" style="max-width: 100%; border-radius: 8px;">
  </a>
</div>

---

<div align="center" style="margin: 48px 0 24px 0; padding: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; color: white;">
  <h3 style="margin: 0 0 12px 0; font-weight: 700;">🎬 开始您的观影之旅</h3>
  <p style="margin: 0; opacity: 0.9;">
    现在就部署 ShiYuTV，享受无广告、全平台、云同步的观影体验
  </p>
</div>

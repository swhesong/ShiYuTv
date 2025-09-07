# 🎬 ShiYuTV

<div align="center">
  <img src="public/logo.png" alt="ShiYuTv Logo" width="160" style="border-radius: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.12);">
  
  <h3 style="margin: 24px 0 8px 0; color: #1a1a1a; font-weight: 700;">开箱即用的跨平台影视聚合播放器</h3>
  <p style="color: #6b7280; font-size: 16px; margin: 0 0 32px 0; max-width: 600px;">
    基于 <strong>Next.js 14</strong> + <strong>Tailwind CSS</strong> + <strong>TypeScript</strong> 构建，支持多资源搜索、在线播放、收藏同步、播放记录、云端存储，让你可以随时随地畅享海量免费影视内容。
  </p>

  <!-- 技术栈徽章 -->
  <div style="margin: 24px 0;">
    <img src="https://img.shields.io/badge/Next.js-14-000?logo=nextdotjs&logoColor=white&style=for-the-badge" alt="Next.js" style="margin: 4px;">
    <img src="https://img.shields.io/badge/TailwindCSS-3-38bdf8?logo=tailwindcss&logoColor=white&style=for-the-badge" alt="TailwindCSS" style="margin: 4px;">
    <img src="https://img.shields.io/badge/TypeScript-4.x-3178c6?logo=typescript&logoColor=white&style=for-the-badge" alt="TypeScript" style="margin: 4px;">
    <img src="https://img.shields.io/badge/License-MIT-green&style=for-the-badge" alt="License" style="margin: 4px;">
    <img src="https://img.shields.io/badge/Docker-ready-blue?logo=docker&logoColor=white&style=for-the-badge" alt="Docker Ready" style="margin: 4px;">
  </div>
</div>

---

## ✨ 功能特性

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 32px 0;">

<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white;">

**🔍 多源聚合搜索**  
一次搜索立刻返回全源结果。
</div>

<div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 12px; color: white;">

**📄 丰富详情页**  
支持剧集列表、演员、年份、简介等完整信息展示。
</div>

<div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 20px; border-radius: 12px; color: white;">

**▶️ 流畅在线播放**  
集成 HLS.js & ArtPlayer。
</div>

<div style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); padding: 20px; border-radius: 12px; color: #333;">

**❤️ 收藏 + 继续观看**  
支持 Kvrocks/Redis/Upstash 存储，多端同步进度。
</div>

<div style="background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); padding: 20px; border-radius: 12px; color: #333;">

**📱 PWA**  
离线缓存、安装到桌面/主屏，移动端原生体验。
</div>

<div style="background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%); padding: 20px; border-radius: 12px; color: #333;">

**🌗 响应式布局**  
桌面侧边栏 + 移动底部导航，自适应各种屏幕尺寸。
</div>

<div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 20px; border-radius: 12px; color: #333;">

**👿 智能去广告**  
自动跳过视频中的切片广告（实验性）。
</div>

</div>

<div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 12px; border-left: 4px solid #f59e0b; margin: 24px 0;">

### ⚠️ 注意：部署后项目为空壳项目，无内置播放源和直播源，需要自行收集
</div>

<details>
  <summary><strong>📸 点击查看项目截图</strong></summary>
  
  <div style="margin: 20px 0;">
    <img src="public/screenshot1.png" alt="项目截图" style="max-width:600px; border-radius: 8px; margin: 8px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <img src="public/screenshot2.png" alt="项目截图" style="max-width:600px; border-radius: 8px; margin: 8px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <img src="public/screenshot3.png" alt="项目截图" style="max-width:600px; border-radius: 8px; margin: 8px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <img src="public/screenshot4.png" alt="项目截图" style="max-width:600px; border-radius: 8px; margin: 8px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
  </div>
</details>

<div style="background: #ef4444; color: white; padding: 16px; border-radius: 8px; margin: 24px 0;">

### 🚫 请不要在 B 站、小红书、微信公众号、抖音、今日头条或其他中国大陆社交平台发布视频或文章宣传本项目，不授权任何"科技周刊/月刊"类项目或站点收录本项目。
</div>

## 🗺 目录

- [技术栈](#技术栈)
- [部署](#部署)
- [配置文件](#配置文件)
- [自动更新](#自动更新)
- [环境变量](#环境变量)
- [AndroidTV 使用](#AndroidTV-使用)
- [Roadmap](#roadmap)
- [安全与隐私提醒](#安全与隐私提醒)
- [License](#license)
- [致谢](#致谢)

## 🏗️ 技术栈

<div style="margin: 24px 0; overflow-x: auto;">

| 分类      | 主要依赖                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------- |
| **🎯 前端框架**  | [Next.js 14](https://nextjs.org/) · App Router                                                        |
| **🎨 UI & 样式** | [Tailwind CSS 3](https://tailwindcss.com/)                                                       |
| **⚡ 语言**      | TypeScript 4                                                                                          |
| **📺 播放器**    | [ArtPlayer](https://github.com/zhw2590582/ArtPlayer) · [HLS.js](https://github.com/video-dev/hls.js/) |
| **🔧 代码质量**  | ESLint · Prettier · Jest                                                                              |
| **🚀 部署**      | Docker                                                                                                |

</div>

## 🚀 部署

<div style="background: #3b82f6; color: white; padding: 16px; border-radius: 8px; margin: 20px 0;">

### 📦 本项目**仅支持 Docker 或其他基于 Docker 的平台** 部署。
</div>

### 🌟 Kvrocks 存储（推荐）

```yml
services:
  ShiYuTv-core:
    image: devinglaw/shiyutv:latest
    container_name: ShiYuTv-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=kvrocks
      - KVROCKS_URL=redis://ShiYuTv-kvrocks:6666
    networks:
      - ShiYuTv-network
    depends_on:
      - ShiYuTv-kvrocks
  ShiYuTv-kvrocks:
    image: apache/kvrocks
    container_name: ShiYuTv-kvrocks
    restart: unless-stopped
    volumes:
      - kvrocks-data:/var/lib/kvrocks
    networks:
      - ShiYuTv-network
networks:
  ShiYuTv-network:
    driver: bridge
volumes:
  kvrocks-data:
```

### 🔴 Redis 存储（有一定的丢数据风险）

```yml
services:
  ShiYuTv-core:
    image: devinglaw/shiyutv:latest
    container_name: ShiYuTv-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=redis
      - REDIS_URL=redis://ShiYuTv-redis:6379
    networks:
      - ShiYuTv-network
    depends_on:
      - ShiYuTv-redis
  ShiYuTv-redis:
    image: redis:alpine
    container_name: ShiYuTv-redis
    restart: unless-stopped
    networks:
      - ShiYuTv-network
    # 请开启持久化，否则升级/重启后数据丢失
    volumes:
      - ./data:/data
networks:
  ShiYuTv-network:
    driver: bridge
```

### ☁️ Upstash 存储

<div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 16px 0;">

1. 在 [upstash](https://upstash.com/) 注册账号并新建一个 Redis 实例，名称任意。
2. 复制新数据库的 **HTTPS ENDPOINT 和 TOKEN**
3. 使用如下 docker compose
</div>

```yml
services:
  ShiYuTv-core:
    image: devinglaw/shiyutv:latest
    container_name: ShiYuTv-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=upstash
      - UPSTASH_URL=上面 https 开头的 HTTPS ENDPOINT
      - UPSTASH_TOKEN=上面的 TOKEN
```

## ⚙️ 配置文件

<div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 12px; border-left: 4px solid #f59e0b; margin: 24px 0;">

完成部署后为空壳应用，无播放源，需要站长在管理后台的配置文件设置中填写配置文件（后续会支持订阅）
</div>

配置文件示例如下：

```json
{
  "cache_time": 7200,
  "api_site": {
    "dyttzy": {
      "api": "http://xxx.com/api.php/provide/vod",
      "name": "示例资源",
      "detail": "http://xxx.com"
    }
    // ...更多站点
  },
  "custom_category": [
    {
      "name": "华语",
      "type": "movie",
      "query": "华语"
    }
  ]
}
```

### 📋 配置项详解

- **`cache_time`**：接口缓存时间（秒）。
- **`api_site`**：你可以增删或替换任何资源站，字段说明：
  - `key`：唯一标识，保持小写字母/数字。
  - `api`：资源站提供的 `vod` JSON API 根地址。
  - `name`：在人机界面中展示的名称。
  - `detail`：（可选）部分无法通过 API 获取剧集详情的站点，需要提供网页详情根 URL，用于爬取。
- **`custom_category`**：自定义分类配置，用于在导航中添加个性化的影视分类。以 type + query 作为唯一标识。支持以下字段：
  - `name`：分类显示名称（可选，如不提供则使用 query 作为显示名）
  - `type`：分类类型，支持 `movie`（电影）或 `tv`（电视剧）
  - `query`：搜索关键词，用于在豆瓣 API 中搜索相关内容

### 🎯 自定义分类支持

**custom_category 支持的自定义分类已知如下：**

- **movie**：热门、最新、经典、豆瓣高分、冷门佳片、华语、欧美、韩国、日本、动作、喜剧、爱情、科幻、悬疑、恐怖、治愈
- **tv**：热门、美剧、英剧、韩剧、日剧、国产剧、港剧、日本动画、综艺、纪录片

也可输入如 "哈利波特" 效果等同于豆瓣搜索

<div style="background: #dbeafe; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 16px 0;">

### 📺 ShiYuTv 支持标准的苹果 CMS V10 API 格式。
</div>

## 🔄 自动更新

可借助 [watchtower](https://github.com/containrrr/watchtower) 自动更新镜像容器

dockge/komodo 等 docker compose UI 也有自动更新功能

## 🌐 环境变量

<div style="margin: 20px 0; overflow-x: auto;">

| 变量                                | 说明                     | 可选值                   | 默认值                                                                                                                     |
| ----------------------------------- | ------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **基础配置** ||||
| USERNAME                            | 站长账号                 | 任意字符串               | 无默认，必填字段                                                                                                           |
| PASSWORD                            | 站长密码                 | 任意字符串               | 无默认，必填字段                                                                                                           |
| SITE_BASE                           | 站点 url                 | 形如 https://example.com | 空                                                                                                                         |
| NEXT_PUBLIC_SITE_NAME               | 站点名称                 | 任意字符串               | ShiYuTv                                                                                                                     |
| ANNOUNCEMENT                        | 站点公告                 | 任意字符串               | 本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。 |
| **存储配置** ||||
| NEXT_PUBLIC_STORAGE_TYPE            | 播放记录/收藏的存储方式  | redis、kvrocks、upstash  | 无默认，必填字段                                                                                                           |
| KVROCKS_URL                         | kvrocks 连接 url         | 连接 url                 | 空                                                                                                                         |
| REDIS_URL                           | redis 连接 url           | 连接 url                 | 空                                                                                                                         |
| UPSTASH_URL                         | upstash redis 连接 url   | 连接 url                 | 空                                                                                                                         |
| UPSTASH_TOKEN                       | upstash redis 连接 token | 连接 token               | 空                                                                                                                         |
| **功能配置** ||||
| NEXT_PUBLIC_SEARCH_MAX_PAGE         | 搜索接口可拉取的最大页数 | 1-50                     | 5                                                                                                                          |
| NEXT_PUBLIC_DOUBAN_PROXY_TYPE       | 豆瓣数据源请求方式       | 见下方                   | direct                                                                                                                     |
| NEXT_PUBLIC_DOUBAN_PROXY            | 自定义豆瓣数据代理 URL   | url prefix               | (空)                                                                                                                       |
| NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE | 豆瓣图片代理类型         | 见下方                   | direct                                                                                                                     |
| NEXT_PUBLIC_DOUBAN_IMAGE_PROXY      | 自定义豆瓣图片代理 URL   | url prefix               | (空)                                                                                                                       |
| NEXT_PUBLIC_DISABLE_YELLOW_FILTER   | 关闭色情内容过滤         | true/false               | false                                                                                                                      |
| NEXT_PUBLIC_FLUID_SEARCH            | 是否开启搜索接口流式输出 | true/ false              | true                                                                                                                       |

</div>

### 🔗 NEXT_PUBLIC_DOUBAN_PROXY_TYPE 选项解释：

<div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">

- **direct**: 由服务器直接请求豆瓣源站
- **cors-proxy-zwei**: 浏览器向 cors proxy 请求豆瓣数据，该 cors proxy 由 [Zwei](https://github.com/bestzwei) 搭建
- **cmliussss-cdn-tencent**: 浏览器向豆瓣 CDN 请求数据，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由腾讯云 cdn 提供加速
- **cmliussss-cdn-ali**: 浏览器向豆瓣 CDN 请求数据，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由阿里云 cdn 提供加速
- **custom**: 用户自定义 proxy，由 NEXT_PUBLIC_DOUBAN_PROXY 定义
</div>

### 🖼️ NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE 选项解释：

<div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">

- **direct**：由浏览器直接请求豆瓣分配的默认图片域名
- **server**：由服务器代理请求豆瓣分配的默认图片域名
- **img3**：由浏览器请求豆瓣官方的精品 cdn（阿里云）
- **cmliussss-cdn-tencent**：由浏览器请求豆瓣 CDN，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由腾讯云 cdn 提供加速
- **cmliussss-cdn-ali**：由浏览器请求豆瓣 CDN，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由阿里云 cdn 提供加速
- **custom**: 用户自定义 proxy，由 NEXT_PUBLIC_DOUBAN_IMAGE_PROXY 定义
</div>

## 📱 AndroidTV 使用

### 方法一：Edge 浏览器安装
1. 利用Edge手机浏览器打开镜像网站，浏览器右下角三横里边Add to phone安装app应用到手机。
    <details>
      <summary><strong>📸 点击查看截图</strong></summary>
      <div style="margin: 16px 0;">
        <img src="public/android.png" alt="项目截图" style="max-width:600px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
      </div>
    </details>

### 方法二：OrionTV 集成
2. 配合 OrionTV [<sup>1</sup>](https://github.com/zimplexing/OrionTV) 在 Android TV 上使用，可以直接作为 OrionTV 后端。

<div style="background: #d1fae5; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981; margin: 16px 0;">

### ✅ 以上方式均已实现播放记录和网页端同步
</div>

## 🗓️ Roadmap

*(此部分在原文档中被引用但未详细展开，保留标题以维持完整性)*

## 🔒 安全与隐私提醒

<div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); padding: 24px; border-radius: 12px; border-left: 4px solid #ef4444; margin: 24px 0;">

### 🛡️ 请设置密码保护并关闭公网注册

为了您的安全和避免潜在的法律风险，我们要求在部署时**强烈建议关闭公网注册**：
</div>

### 📋 部署要求

<div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">

1. **设置环境变量 `PASSWORD`**：为您的实例设置一个强密码
2. **仅供个人使用**：请勿将您的实例链接公开分享或传播
3. **遵守当地法律**：请确保您的使用行为符合当地法律法规
</div>

### ⚖️ 重要声明

<div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">

- 本项目仅供学习和个人使用
- 请勿将部署的实例用于商业用途或公开服务
- 如因公开分享导致的任何法律问题，用户需自行承担责任
- 项目开发者不对用户的使用行为承担任何法律责任
- 本项目不在中国大陆地区提供服务。如有该项目在向中国大陆地区提供服务，属个人行为。在该地区使用所产生的法律风险及责任，属于用户个人行为，与本项目无关，须自行承担全部责任。特此声明
</div>

## 📜 License

<div align="center" style="margin: 20px 0;">

[MIT](LICENSE) © 2025 ShiYuTv & Contributors
</div>

## 🙏 致谢

<div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 24px; border-radius: 12px; margin: 24px 0;">

- **[ts-nextjs-tailwind-starter](https://github.com/theodorusclarence/ts-nextjs-tailwind-starter)** — 项目最初基于该脚手架。
- **[LibreTV](https://github.com/LibreSpark/LibreTV)** — 由此启发，站在巨人的肩膀上。
- **[MoonTv](https://github.com/MoonTechLab/LunaTV)** — 已完项目基础上完善。
- **[MoonTv二改](https://github.com/puyujian/LunaTV)** — 对ShiYuTv进行二次改造。
- **[MoonTv二改](https://github.com/katelya77/KatelyaTV)** — 对ShiYuTv进行二次改造。
- **[ArtPlayer](https://github.com/zhw2590582/ArtPlayer)** — 提供强大的网页视频播放器。
- **[HLS.js](https://github.com/video-dev/hls.js)** — 实现 HLS 流媒体在浏览器中的播放支持。
- **[Zwei](https://github.com/bestzwei)** — 提供获取豆瓣数据的 cors proxy
- **[CMLiussss](https://github.com/cmliu)** — 提供豆瓣 CDN 服务
- 感谢所有提供免费影视接口的站点。
</div>

## ⭐ Star History

<div align="center" style="margin: 32px 0;">
  <a href="https://star-history.com/#swhesong/ShiYuTv&Date">
    <img src="https://api.star-history.com/svg?repos=swhesong/ShiYuTv&type=Date" alt="Star History Chart" style="border-radius: 8px; max-width: 100%;">
  </a>
</div>

---

<div align="center" style="margin: 48px 0 24px 0; padding: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; color: white;">
  <h3 style="margin: 0 0 12px 0; font-weight: 700;">🎬 开始您的观影之旅</h3>
  <p style="margin: 0; opacity: 0.9;">
    现在就部署 ShiYuTV，享受无广告、全平台、云同步的观影体验
  </p>
</div>

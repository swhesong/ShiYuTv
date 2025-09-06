# ---- 第 1 阶段：安装依赖 ----
FROM node:20-alpine AS deps

# 启用 corepack 并激活 pnpm（Node20 默认提供 corepack）
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 仅复制依赖清单，提高构建缓存利用率
COPY package.json pnpm-lock.yaml ./

# 安装所有依赖（含 devDependencies，后续会裁剪）
RUN pnpm install --frozen-lockfile

# ---- 第 2 阶段：构建项目 (增加详细日志) ----
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
# 复制全部源代码
COPY . .

# 在构建阶段也显式设置 DOCKER_ENV，
ENV DOCKER_ENV=true

# 为 Node.js 构建进程增加内存限制，防止因内存不足而构建失败
ENV NODE_OPTIONS="--max-old-space-size=4096"

# ==================== 日志增强部分 ====================
# 1. 打印环境信息，确认基础工具版本
RUN echo "=== Node Version ===" && \
    node -v && \
    echo "=== PNPM Version ===" && \
    pnpm -v && \
    echo "=== TypeScript Version ===" && \
    pnpm exec tsc --version

# 2. 列出当前目录文件，检查代码是否已正确复制
RUN echo "=== Listing Files in /app ===" && \
    ls -la

# 3. 独立运行类型检查，将类型错误和构建错误分离
RUN echo "=== Running TypeScript Type Check ===" && \
    pnpm exec tsc --noEmit --pretty && \
    echo "=== TypeScript Check Completed Successfully ==="

# 4. 执行构建命令，并附带详细日志标志
RUN echo "=== Starting Next.js Build with Verbose Output ===" && \
    pnpm run build --verbose
# ======================================================

# ---- 第 3 阶段：生成运行时镜像 ----
FROM node:20-alpine AS runner

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DOCKER_ENV=true

# 从构建器中复制 standalone 输出
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# 从构建器中复制 scripts 目录
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
# 从构建器中复制 start.js
COPY --from=builder --chown=nextjs:nodejs /app/start.js ./start.js
# 从构建器中复制 public 和 .next/static 目录
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 切换到非特权用户
USER nextjs

EXPOSE 3000

# 使用自定义启动脚本，先预加载配置再启动服务器
CMD ["node", "start.js"]

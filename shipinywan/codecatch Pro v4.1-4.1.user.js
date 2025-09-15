// ==UserScript==
// @name         GitHub代码文件批量抓取器 Pro v4.1
// @namespace    http://tampermonkey.net/
// @version      4.1
// @description  高效抓取GitHub搜索结果中的所有文件内容 - 支持并行处理和自动翻页
// @author       Assistant
// @match        https://github.com/search*
// @match        https://github.com/*/blob/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// @connect      github.com
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function() {
    'use strict';

    // 检查环境并提供兼容性支持
    function checkEnvironment() {
        // 请求剪贴板权限
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'clipboard-read' }).catch(() => {
                console.log('剪贴板权限请求失败，将使用备用方案');
            });
        }

        const missingAPIs = [];

        // 如果GM API不存在，使用localStorage作为替代
        if (typeof GM_setValue === 'undefined') {
            window.GM_setValue = (key, value) => localStorage.setItem(key, value);
            console.log('使用localStorage替代GM_setValue');
        }
        if (typeof GM_getValue === 'undefined') {
            window.GM_getValue = (key, defaultValue) => localStorage.getItem(key) || defaultValue;
            console.log('使用localStorage替代GM_getValue');
        }
        if (typeof GM_deleteValue === 'undefined') {
            window.GM_deleteValue = (key) => localStorage.removeItem(key);
            console.log('使用localStorage替代GM_deleteValue');
        }

        // 如果GM_xmlhttpRequest不存在，使用fetch API作为替代
        if (typeof GM_xmlhttpRequest === 'undefined') {
            window.GM_xmlhttpRequest = async (options) => {
                try {
                    // 直接使用fetch请求raw URL
                    const response = await fetch(options.url, {
                        method: options.method || 'GET',
                        headers: {
                            'User-Agent': options.headers?.['User-Agent'] || CONFIG.USER_AGENT,
                            'Accept': 'text/plain,*/*',
                            'Cache-Control': 'no-cache'
                        },
                        mode: 'cors',
                        credentials: 'omit'
                    });

                    if (response.ok) {
                        const content = await response.text();
                        if (options.onload) {
                            options.onload({
                                status: response.status,
                                responseText: content,
                                statusText: response.statusText || 'OK'
                            });
                        }
                    } else {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                } catch (error) {
                    console.warn('Fetch请求失败，尝试使用代理方式:', error);

                    // 如果直接fetch失败，尝试使用JSONP或其他方式
                    try {
                        // 构造代理URL（使用公共CORS代理）
                        const proxyUrls = [
                            `https://api.allorigins.win/raw?url=${encodeURIComponent(options.url)}`,
                            `https://cors-anywhere.herokuapp.com/${options.url}`,
                            options.url // 最后直接尝试原URL
                        ];

                        for (const proxyUrl of proxyUrls) {
                            try {
                                const response = await fetch(proxyUrl, {
                                    method: 'GET',
                                    headers: {
                                        'Accept': 'text/plain,*/*'
                                    },
                                    mode: 'cors'
                                });

                                if (response.ok) {
                                    const content = await response.text();
                                    if (content && content.trim()) {
                                        if (options.onload) {
                                            options.onload({
                                                status: 200,
                                                responseText: content,
                                                statusText: 'OK'
                                            });
                                        }
                                        return;
                                    }
                                }
                            } catch (e) {
                                console.warn(`代理${proxyUrl}失败:`, e);
                                continue;
                            }
                        }

                        // 所有方法都失败了
                        throw new Error('所有请求方式都失败');

                    } catch (finalError) {
                        console.error('最终请求失败:', finalError);
                        if (options.onerror) {
                            options.onerror(new Error('无法获取文件内容'));
                        }
                    }
                }
            };
            console.log('使用Fetch API替代GM_xmlhttpRequest');
        }

        return true;
    }

    // 环境检查通过后继续执行
    if (!checkEnvironment()) {
        return;
    }

    // 配置参数
    const CONFIG = {
        CONCURRENT_REQUESTS: 2,     // 降低并发数以避免被限制
        REQUEST_DELAY: 2000,        // 增加请求间隔
        MAX_PAGES: 50,
        STORAGE_KEY: 'github_scraper_v41',
        MAX_RETRIES: 3,
        OUTPUT_FILENAME: 'shipinywan.txt',
        USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    // 存储管理器
    class StorageManager {
        static saveData(data) {
            try {
                GM_setValue(CONFIG.STORAGE_KEY, JSON.stringify(data));
                return true;
            } catch (e) {
                console.error('保存数据失败:', e);
                return false;
            }
        }

        static getData() {
            try {
                const data = GM_getValue(CONFIG.STORAGE_KEY, '{"files":[],"currentPage":1,"totalPages":0}');
                return JSON.parse(data);
            } catch (e) {
                console.error('读取数据失败:', e);
                return { files: [], currentPage: 1, totalPages: 0 };
            }
        }

        static clearData() {
            try {
                GM_deleteValue(CONFIG.STORAGE_KEY);
                return true;
            } catch (e) {
                console.error('清除数据失败:', e);
                return false;
            }
        }
    }

    // 工具函数
    const Utils = {
        delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

        safeQuery: (selector, context = document) => {
            try {
                return context.querySelector(selector);
            } catch (e) {
                console.warn('查询选择器失败:', selector, e);
                return null;
            }
        },

        safeQueryAll: (selector, context = document) => {
            try {
                return Array.from(context.querySelectorAll(selector));
            } catch (e) {
                console.warn('查询选择器失败:', selector, e);
                return [];
            }
        },

        parseGitHubUrl: (url) => {
            try {
                const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)/);
                if (match) {
                    return {
                        owner: match[1],
                        repo: match[2],
                        branch: match[3],
                        path: match[4],
                        fullRepo: `${match[1]}/${match[2]}`
                    };
                }
            } catch (e) {
                console.error('解析URL失败:', url, e);
            }
            return null;
        },

        buildRawUrl: (urlInfo) => {
            return `https://raw.githubusercontent.com/${urlInfo.owner}/${urlInfo.repo}/${urlInfo.branch}/${urlInfo.path}`;
        },

        formatBytes: (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        // 创建安全的下载链接
        createDownloadBlob: (content, filename) => {
            try {
                // 优先使用GM_download（如果可用）
                if (typeof GM_download !== 'undefined' && GM_download.toString().indexOf('native') === -1) {
                    GM_download(content, filename, 'data:text/plain;charset=utf-8,');
                    return true;
                }

                // 否则使用浏览器原生方法
                const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.style.display = 'none';

                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // 清理URL对象
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                return true;
            } catch (e) {
                console.error('创建下载失败:', e);
                // 如果下载失败，提供复制到剪贴板的选项
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(content).then(() => {
                        alert('下载失败，但内容已复制到剪贴板');
                    });
                }
                return false;
            }
        }
    };

    // HTTP请求管理器
    class RequestManager {
        constructor() {
            this.requestQueue = [];
            this.activeRequests = 0;
            this.maxConcurrent = CONFIG.CONCURRENT_REQUESTS;
            this.rateLimitDelay = 1000; // 速率限制延迟
        }

        async makeRequest(url, options = {}) {
            return new Promise((resolve, reject) => {
                const requestConfig = {
                    method: 'GET',
                    url: url,
                    timeout: 30000,
                    headers: {
                        'User-Agent': CONFIG.USER_AGENT,
                        'Accept': 'text/plain,text/html,*/*',
                        'Cache-Control': 'no-cache',
                        'Origin': 'https://github.com',
                        'Referer': 'https://github.com/'
                    },
                    ...options,
                    onload: (response) => {
                        this.activeRequests--;
                        this.processQueue();

                        // 检查响应状态
                        if (response.status === 200) {
                            resolve(response);
                        } else if (response.status === 429) {
                            // 遇到速率限制，增加延迟
                            this.rateLimitDelay *= 2;
                            reject(new Error(`Rate limited (429), increasing delay to ${this.rateLimitDelay}ms`));
                        } else if (response.status === 404) {
                            reject(new Error('File not found (404)'));
                        } else {
                            reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
                        }
                    },
                    onerror: (error) => {
                        this.activeRequests--;
                        this.processQueue();
                        reject(new Error(`Network error: ${error.message || 'Unknown error'}`));
                    },
                    ontimeout: () => {
                        this.activeRequests--;
                        this.processQueue();
                        reject(new Error('Request timeout (30s)'));
                    }
                };

                if (this.activeRequests < this.maxConcurrent) {
                    this.executeRequest(requestConfig);
                } else {
                    this.requestQueue.push(() => this.executeRequest(requestConfig));
                }
            });
        }

        executeRequest(config) {
            this.activeRequests++;
            // 添加速率限制延迟
            setTimeout(() => {
                try {
                    GM_xmlhttpRequest(config);
                } catch (e) {
                    this.activeRequests--;
                    this.processQueue();
                    if (config.onerror) {
                        config.onerror(e);
                    }
                }
            }, this.rateLimitDelay);
        }

        processQueue() {
            if (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrent) {
                const nextRequest = this.requestQueue.shift();
                nextRequest();
            }
        }

        // 重置速率限制延迟
        resetRateLimit() {
            this.rateLimitDelay = Math.max(1000, this.rateLimitDelay / 2);
        }
    }

    // UI管理器
    class UIManager {
        static createPanel() {
            if (document.getElementById('github-scraper-v41')) {
                return document.getElementById('github-scraper-v41');
            }

            const panel = document.createElement('div');
            panel.id = 'github-scraper-v41';
            panel.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                width: 400px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 12px;
                padding: 20px;
                box-shadow: 0 15px 35px rgba(0,0,0,0.6);
                z-index: 999999;
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-size: 14px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.2);
            `;

            const savedData = StorageManager.getData();

            panel.innerHTML = `
                <div style="display: flex; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; flex: 1; font-size: 18px; font-weight: 700;">
                        🚀 GitHub批量抓取器 v4.1
                    </h3>
                    <button id="togglePanelV41" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 16px;">−</button>
                </div>

                <div id="panelContentV41">
                    <div id="statusPanel" style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>状态:</span>
                            <span id="currentStatus" style="font-weight: bold; color: #4CAF50;">就绪</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>进度:</span>
                            <span id="progressText">0/0</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>页面:</span>
                            <span id="pageInfo">1/0</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>数据:</span>
                            <span id="dataSize">0 B</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>成功率:</span>
                            <span id="successRate">0%</span>
                        </div>

                        <div style="margin-top: 10px;">
                            <div style="background: rgba(255,255,255,0.3); height: 8px; border-radius: 4px; overflow: hidden;">
                                <div id="progressBar" style="background: #4CAF50; height: 100%; width: 0%; transition: width 0.3s ease;"></div>
                            </div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-bottom: 15px;">
                        <button id="startScraping" style="background: #4CAF50; border: none; color: white; padding: 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; transition: background 0.3s;">
                            开始抓取
                        </button>
                        <button id="stopScraping" style="background: #f44336; border: none; color: white; padding: 12px; border-radius: 6px; cursor: pointer; font-weight: bold; opacity: 0.6;" disabled>
                            停止
                        </button>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px;">
                        <button id="downloadResult" style="background: #2196F3; border: none; color: white; padding: 10px; border-radius: 6px; cursor: pointer; font-size: 13px; transition: background 0.3s;">
                            📥 下载结果
                        </button>
                        <button id="clearData" style="background: #FF9800; border: none; color: white; padding: 10px; border-radius: 6px; cursor: pointer; font-size: 13px; transition: background 0.3s;">
                            🗑️ 清空数据
                        </button>
                    </div>

                    <div style="background: rgba(0,0,0,0.4); padding: 12px; border-radius: 6px; max-height: 180px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.1);">
                        <div id="logOutput" style="font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4;">
                            <div style="color: #4CAF50;">系统已就绪，等待开始...</div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(panel);
            this.bindEvents();
            this.updateDataDisplay(savedData);
            return panel;
        }

        static bindEvents() {
            // 折叠/展开面板
            const toggleBtn = document.getElementById('togglePanelV41');
            if (toggleBtn) {
                toggleBtn.onclick = () => {
                    const content = document.getElementById('panelContentV41');
                    const isHidden = content.style.display === 'none';
                    content.style.display = isHidden ? 'block' : 'none';
                    toggleBtn.textContent = isHidden ? '−' : '+';
                };
            }

            // 绑定按钮事件
            const startBtn = document.getElementById('startScraping');
            const stopBtn = document.getElementById('stopScraping');
            const downloadBtn = document.getElementById('downloadResult');
            const clearBtn = document.getElementById('clearData');

            if (startBtn) {
                startBtn.onclick = () => {
                    if (window.gitHubScraperV41) {
                        window.gitHubScraperV41.startScraping();
                    }
                };

                // 添加悬停效果
                startBtn.onmouseover = () => startBtn.style.background = '#45a049';
                startBtn.onmouseout = () => startBtn.style.background = '#4CAF50';
            }

            if (stopBtn) {
                stopBtn.onclick = () => {
                    if (window.gitHubScraperV41) {
                        window.gitHubScraperV41.stopScraping();
                    }
                };
            }

            if (downloadBtn) {
                downloadBtn.onclick = () => {
                    if (window.gitHubScraperV41) {
                        window.gitHubScraperV41.downloadResults();
                    }
                };

                downloadBtn.onmouseover = () => downloadBtn.style.background = '#1976D2';
                downloadBtn.onmouseout = () => downloadBtn.style.background = '#2196F3';
            }

            if (clearBtn) {
                clearBtn.onclick = () => {
                    if (confirm('确定要清空所有抓取的数据吗？此操作无法撤销！')) {
                        const success = StorageManager.clearData();
                        if (success) {
                            this.log('数据已清空', 'success');
                            this.updateDataDisplay({ files: [], currentPage: 1, totalPages: 0 });
                            this.updateStats(0, 0, 0);
                        } else {
                            this.log('清空数据失败', 'error');
                        }
                    }
                };

                clearBtn.onmouseover = () => clearBtn.style.background = '#F57C00';
                clearBtn.onmouseout = () => clearBtn.style.background = '#FF9800';
            }
        }

        static updateStatus(status, color = '#4CAF50') {
            const element = document.getElementById('currentStatus');
            if (element) {
                element.textContent = status;
                element.style.color = color;
            }
        }

        static updateProgress(current, total) {
            const progressText = document.getElementById('progressText');
            const progressBar = document.getElementById('progressBar');

            if (progressText) progressText.textContent = `${current}/${total}`;
            if (progressBar && total > 0) {
                const percent = Math.round((current / total) * 100);
                progressBar.style.width = `${percent}%`;
            }
        }

        static updatePageInfo(current, total) {
            const element = document.getElementById('pageInfo');
            if (element) element.textContent = `${current}/${total || '?'}`;
        }

        static updateDataSize(bytes) {
            const element = document.getElementById('dataSize');
            if (element) element.textContent = Utils.formatBytes(bytes);
        }

        static updateStats(successful, total, currentPage) {
            const rate = total > 0 ? Math.round((successful / total) * 100) : 0;
            const element = document.getElementById('successRate');
            if (element) element.textContent = `${rate}%`;
        }

        static updateButtonStates(isRunning) {
            const startBtn = document.getElementById('startScraping');
            const stopBtn = document.getElementById('stopScraping');

            if (startBtn) {
                startBtn.disabled = isRunning;
                startBtn.textContent = isRunning ? '抓取中...' : '开始抓取';
                startBtn.style.opacity = isRunning ? '0.6' : '1';
            }
            if (stopBtn) {
                stopBtn.disabled = !isRunning;
                stopBtn.style.opacity = isRunning ? '1' : '0.6';
            }
        }

        static updateDataDisplay(data) {
            if (data.files) {
                const totalSize = data.files.reduce((size, file) => size + (file.contentLength || 0), 0);
                this.updateProgress(data.files.length, data.files.length);
                this.updateDataSize(totalSize);
                this.updatePageInfo(data.currentPage || 1, data.totalPages || 0);
                this.updateStats(data.files.length, data.files.length, data.currentPage || 1);
            }
        }

        static log(message, type = 'info') {
            const logOutput = document.getElementById('logOutput');
            if (!logOutput) return;

            const timestamp = new Date().toLocaleTimeString();
            const logEntry = document.createElement('div');

            const colors = {
                info: '#E3F2FD',
                success: '#4CAF50',
                warning: '#FF9800',
                error: '#f44336'
            };

            logEntry.style.cssText = `
                margin: 2px 0;
                padding: 4px 8px;
                border-left: 3px solid ${colors[type] || colors.info};
                background: rgba(255,255,255,0.1);
                border-radius: 3px;
                word-break: break-word;
                color: ${colors[type] || colors.info};
                font-size: 11px;
            `;

            logEntry.textContent = `[${timestamp}] ${message}`;
            logOutput.appendChild(logEntry);
            logOutput.scrollTop = logOutput.scrollHeight;

            // 限制日志条数
            while (logOutput.children.length > 100) {
                logOutput.removeChild(logOutput.firstChild);
            }
        }

        static showNotification(message, type = 'info') {
            // 创建临时通知
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: ${type === 'error' ? '#f44336' : '#4CAF50'};
                color: white;
                padding: 15px 25px;
                border-radius: 8px;
                z-index: 9999999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-weight: bold;
                box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            `;
            notification.textContent = message;

            document.body.appendChild(notification);
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        }
    }

    // 页面解析器
    class PageParser {
        static isSearchPage() {
            return window.location.href.includes('github.com/search') &&
                   window.location.href.includes('type=code');
        }

        static extractFileLinks() {
            const fileLinks = [];

            // 更全面的选择器策略
            const selectors = [
                '[data-testid="results-list"] .search-title a[href*="/blob/"]',
                '.code-list-item .f4 a[href*="/blob/"]',
                '.codesearch-results .f4 a[href*="/blob/"]',
                '.Box-row .text-bold a[href*="/blob/"]',
                'h3.f4 a[href*="/blob/"]',
                'a[href*="/blob/"]:not([href*="#"]):not([href*="?"])'
            ];

            for (const selector of selectors) {
                const links = Utils.safeQueryAll(selector);
                if (links.length > 0) {
                    links.forEach(link => {
                        try {
                            const href = link.getAttribute('href');
                            if (href && href.includes('/blob/')) {
                                const fullUrl = href.startsWith('http') ? href : 'https://github.com' + href;
                                const urlInfo = Utils.parseGitHubUrl(fullUrl);

                                if (urlInfo) {
                                    // 避免重复
                                    const exists = fileLinks.some(item => item.url === fullUrl);
                                    if (!exists) {
                                        fileLinks.push({
                                            url: fullUrl,
                                            rawUrl: Utils.buildRawUrl(urlInfo),
                                            fileName: urlInfo.path.split('/').pop() || 'unknown',
                                            filePath: urlInfo.path,
                                            repo: urlInfo.fullRepo,
                                            title: link.textContent?.trim() || urlInfo.path,
                                            ...urlInfo
                                        });
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('处理链接失败:', link, e);
                        }
                    });
                    break; // 找到一个有效的选择器就停止
                }
            }

            return fileLinks;
        }

        static getNextPageUrl() {
            const selectors = [
                'a[aria-label="Next"]',
                '.paginate-container .next_page:not(.disabled)',
                '.pagination a[rel="next"]:not(.disabled)',
                '.pagination .next_page:not(.disabled)'
            ];

            for (const selector of selectors) {
                const nextLink = Utils.safeQuery(selector);
                if (nextLink && !nextLink.hasAttribute('disabled') &&
                    !nextLink.classList.contains('disabled') &&
                    !nextLink.classList.contains('current')) {
                    const href = nextLink.getAttribute('href');
                    if (href) {
                        return href.startsWith('http') ? href : 'https://github.com' + href;
                    }
                }
            }

            return null;
        }

        static getTotalPages() {
            try {
                // 多种方式获取总页数
                const pageNumbers = Utils.safeQueryAll('.pagination a[data-page]');
                if (pageNumbers.length > 0) {
                    const numbers = pageNumbers
                        .map(el => parseInt(el.getAttribute('data-page')) || 0)
                        .filter(num => num > 0);
                    if (numbers.length > 0) {
                        return Math.max(...numbers);
                    }
                }

                // 备用方案
                const paginationLinks = Utils.safeQueryAll('.pagination a');
                if (paginationLinks.length > 0) {
                    for (let i = paginationLinks.length - 1; i >= 0; i--) {
                        const text = paginationLinks[i].textContent.trim();
                        const match = text.match(/^\d+$/);
                        if (match) {
                            return parseInt(match[0]);
                        }
                    }
                }

                return 0;
            } catch (e) {
                console.error('获取总页数失败:', e);
                return 0;
            }
        }

        static getCurrentPage() {
            try {
                const url = new URL(window.location.href);
                return parseInt(url.searchParams.get('p')) || 1;
            } catch (e) {
                return 1;
            }
        }
    }

    // 主抓取器
    class GitHubScraperV41 {
        constructor() {
            this.isRunning = false;
            this.requestManager = new RequestManager();
            this.processedFiles = 0;
            this.successfulFiles = 0;
            this.totalFiles = 0;
            this.currentPage = 1;
            this.totalPages = 0;
            this.collectedFiles = [];
            this.errors = [];
        }

        async startScraping() {
            if (this.isRunning) {
                UIManager.showNotification('抓取任务已在运行中', 'warning');
                return;
            }

            if (!PageParser.isSearchPage()) {
                UIManager.log('请在GitHub搜索页面运行此脚本！', 'warning');
                UIManager.showNotification('请在GitHub搜索页面运行此脚本！', 'error');
                return;
            }

            this.isRunning = true;
            this.errors = [];
            UIManager.updateButtonStates(true);
            UIManager.updateStatus('初始化中...', '#FF9800');

            try {
                // 加载已保存的数据
                const savedData = StorageManager.getData();
                this.collectedFiles = savedData.files || [];
                this.currentPage = PageParser.getCurrentPage();
                this.successfulFiles = this.collectedFiles.length;

                UIManager.log(`开始批量抓取，已有 ${this.collectedFiles.length} 个文件`, 'info');

                // 获取总页数
                this.totalPages = PageParser.getTotalPages();
                if (this.totalPages > 0) {
                    UIManager.log(`检测到总共 ${this.totalPages} 页`, 'info');
                    UIManager.updatePageInfo(this.currentPage, this.totalPages);
                } else {
                    UIManager.log('无法检测总页数，将逐页处理', 'warning');
                }

                await this.processAllPages();

            } catch (error) {
                UIManager.log(`抓取过程出错: ${error.message}`, 'error');
                UIManager.showNotification('抓取过程出错', 'error');
            } finally {
                this.stopScraping();
            }
        }

        async processAllPages() {
            let currentUrl = window.location.href;
            let pageCount = 0;
            let consecutiveEmptyPages = 0;

            while (this.isRunning && pageCount < CONFIG.MAX_PAGES && consecutiveEmptyPages < 3) {
                pageCount++;
                this.currentPage = pageCount;

                UIManager.updateStatus(`处理第 ${pageCount} 页`, '#2196F3');
                UIManager.log(`正在处理第 ${pageCount} 页... (${currentUrl})`, 'info');
                UIManager.updatePageInfo(pageCount, this.totalPages);

                try {
                    // 如果不是当前页面，需要获取页面内容
                    let pageContent = document;
                    if (currentUrl !== window.location.href) {
                        UIManager.updateStatus(`加载页面 ${pageCount}`, '#FF9800');
                        const response = await this.requestManager.makeRequest(currentUrl);
                        const parser = new DOMParser();
                        pageContent = parser.parseFromString(response.responseText, 'text/html');
                        await Utils.delay(1000); // 页面加载延迟
                    }

                    // 提取当前页面的文件链接
                    const fileLinks = this.extractFileLinksFromPage(pageContent);

                    if (fileLinks.length === 0) {
                        consecutiveEmptyPages++;
                        UIManager.log(`第 ${pageCount} 页未找到文件链接 (连续空页: ${consecutiveEmptyPages})`, 'warning');

                        if (consecutiveEmptyPages >= 3) {
                            UIManager.log('连续3页无内容，可能已到达最后页', 'info');
                            break;
                        }
                    } else {
                        consecutiveEmptyPages = 0; // 重置空页计数
                        UIManager.log(`第 ${pageCount} 页发现 ${fileLinks.length} 个文件`, 'success');

                        // 处理当前页面的所有文件
                        await this.processPageFiles(fileLinks, pageCount);
                    }

                    // 获取下一页URL
                    const nextPageUrl = this.getNextPageUrlFromPage(pageContent);
                    if (!nextPageUrl) {
                        UIManager.log('已到达最后一页', 'success');
                        break;
                    }

                    currentUrl = nextPageUrl;

                    // 保存进度
                    this.saveProgress();

                    // 页面间延迟
                    await Utils.delay(CONFIG.REQUEST_DELAY);

                } catch (error) {
                    UIManager.log(`处理第 ${pageCount} 页时出错: ${error.message}`, 'error');
                    this.errors.push(`页面${pageCount}: ${error.message}`);

                    // 如果是网络错误，增加延迟后重试
                    if (error.message.includes('Network') || error.message.includes('timeout')) {
                        UIManager.log(`网络错误，等待 ${CONFIG.REQUEST_DELAY * 2}ms 后继续`, 'warning');
                        await Utils.delay(CONFIG.REQUEST_DELAY * 2);
                    }

                    consecutiveEmptyPages++;
                    if (consecutiveEmptyPages >= 3) {
                        UIManager.log('连续错误过多，停止抓取', 'error');
                        break;
                    }
                }
            }

            // 显示最终统计
            const successRate = this.totalFiles > 0 ? Math.round((this.successfulFiles / this.totalFiles) * 100) : 0;
            UIManager.log(`批量抓取完成！`, 'success');
            UIManager.log(`处理页面: ${pageCount} 页`, 'info');
            UIManager.log(`发现文件: ${this.totalFiles} 个`, 'info');
            UIManager.log(`成功抓取: ${this.successfulFiles} 个 (${successRate}%)`, 'success');
            UIManager.log(`失败文件: ${this.totalFiles - this.successfulFiles} 个`, this.errors.length > 0 ? 'warning' : 'info');

            if (this.errors.length > 0) {
                UIManager.log(`主要错误: ${this.errors.slice(0, 3).join('; ')}`, 'warning');
            }

            UIManager.updateStatus('完成', '#4CAF50');
            UIManager.showNotification(`抓取完成！获得 ${this.successfulFiles} 个文件`, 'success');
        }

        extractFileLinksFromPage(pageContent) {
            const fileLinks = [];

            const selectors = [
                '[data-testid="results-list"] .search-title a[href*="/blob/"]',
                '.code-list-item .f4 a[href*="/blob/"]',
                '.codesearch-results .f4 a[href*="/blob/"]',
                '.Box-row .text-bold a[href*="/blob/"]',
                'h3.f4 a[href*="/blob/"]',
                'a[href*="/blob/"]:not([href*="#"]):not([href*="?"])'
            ];

            for (const selector of selectors) {
                const links = Utils.safeQueryAll(selector, pageContent);
                if (links.length > 0) {
                    links.forEach(link => {
                        try {
                            const href = link.getAttribute('href');
                            if (href && href.includes('/blob/')) {
                                const fullUrl = href.startsWith('http') ? href : 'https://github.com' + href;
                                const urlInfo = Utils.parseGitHubUrl(fullUrl);

                                if (urlInfo) {
                                    // 避免重复
                                    const exists = fileLinks.some(item => item.url === fullUrl);
                                    if (!exists) {
                                        fileLinks.push({
                                            url: fullUrl,
                                            rawUrl: Utils.buildRawUrl(urlInfo),
                                            fileName: urlInfo.path.split('/').pop() || 'unknown',
                                            filePath: urlInfo.path,
                                            repo: urlInfo.fullRepo,
                                            title: link.textContent?.trim() || urlInfo.path,
                                            ...urlInfo
                                        });
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('处理链接失败:', e);
                        }
                    });
                    break;
                }
            }

            return fileLinks;
        }

        getNextPageUrlFromPage(pageContent) {
            const selectors = [
                'a[aria-label="Next"]',
                '.paginate-container .next_page:not(.disabled)',
                '.pagination a[rel="next"]:not(.disabled)',
                '.pagination .next_page:not(.disabled)'
            ];

            for (const selector of selectors) {
                const nextLink = Utils.safeQuery(selector, pageContent);
                if (nextLink && !nextLink.hasAttribute('disabled') &&
                    !nextLink.classList.contains('disabled') &&
                    !nextLink.classList.contains('current')) {
                    const href = nextLink.getAttribute('href');
                    if (href) {
                        return href.startsWith('http') ? href : 'https://github.com' + href;
                    }
                }
            }

            return null;
        }

        async processPageFiles(fileLinks, pageNumber) {
            this.totalFiles += fileLinks.length;
            UIManager.updateProgress(this.processedFiles, this.totalFiles);

            // 并行处理文件（分批处理）
            const batchSize = CONFIG.CONCURRENT_REQUESTS;
            for (let i = 0; i < fileLinks.length; i += batchSize) {
                if (!this.isRunning) break;

                const batch = fileLinks.slice(i, i + batchSize);
                const promises = batch.map(fileInfo => this.processFile(fileInfo, pageNumber));

                const results = await Promise.allSettled(promises);

                // 统计成功和失败
                results.forEach((result, index) => {
                    if (result.status === 'fulfilled' && result.value === true) {
                        this.successfulFiles++;
                    }
                });

                // 更新成功率
                UIManager.updateStats(this.successfulFiles, this.processedFiles, this.currentPage);

                // 批次间延迟
                if (i + batchSize < fileLinks.length) {
                    await Utils.delay(CONFIG.REQUEST_DELAY);
                }
            }
        }

        async processFile(fileInfo, pageNumber, retryCount = 0) {
            const fileName = fileInfo.fileName || 'unknown';
            UIManager.updateStatus(`处理: ${fileName}`, '#2196F3');

            try {
                // 检查是否已经处理过
                const existing = this.collectedFiles.find(f => f.url === fileInfo.url);
                if (existing) {
                    this.processedFiles++;
                    UIManager.updateProgress(this.processedFiles, this.totalFiles);
                    return true;
                }

                // 请求文件内容
                const response = await this.requestManager.makeRequest(fileInfo.rawUrl);

                if (response.status === 200 && response.responseText) {
                    const content = response.responseText.trim();

                    if (content.length > 0) {
                        // 格式化文件内容
                        const formattedContent = this.formatFileContent(fileInfo, content, pageNumber);

                        const fileData = {
                            ...fileInfo,
                            content: formattedContent,
                            contentLength: content.length,
                            pageNumber: pageNumber,
                            timestamp: new Date().toISOString(),
                            rawContentLength: content.length
                        };

                        this.collectedFiles.push(fileData);

                        UIManager.log(`✓ ${fileName} (${Utils.formatBytes(content.length)}) - 第${pageNumber}页`, 'success');

                        // 定期保存进度
                        if (this.collectedFiles.length % 10 === 0) {
                            this.saveProgress();
                        }

                        // 重置速率限制延迟
                        this.requestManager.resetRateLimit();

                        this.processedFiles++;
                        UIManager.updateProgress(this.processedFiles, this.totalFiles);

                        // 更新数据显示
                        const totalSize = this.collectedFiles.reduce((size, file) => size + (file.rawContentLength || 0), 0);
                        UIManager.updateDataSize(totalSize);

                        return true;

                    } else {
                        UIManager.log(`⚠ ${fileName} 内容为空`, 'warning');
                    }
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText || 'Unknown error'}`);
                }

            } catch (error) {
                // 重试逻辑
                if (retryCount < CONFIG.MAX_RETRIES && this.isRunning) {
                    const delay = Math.min(5000, 1000 * Math.pow(2, retryCount)); // 指数退避
                    UIManager.log(`✗ ${fileName} 失败，${delay/1000}s后重试 (${retryCount + 1}/${CONFIG.MAX_RETRIES})`, 'warning');
                    await Utils.delay(delay);
                    return await this.processFile(fileInfo, pageNumber, retryCount + 1);
                } else {
                    UIManager.log(`✗ ${fileName} 最终失败: ${error.message}`, 'error');
                    this.errors.push(`${fileName}: ${error.message}`);
                }
            }

            this.processedFiles++;
            UIManager.updateProgress(this.processedFiles, this.totalFiles);
            return false;
        }

        formatFileContent(fileInfo, content, pageNumber) {
            const separator = '='.repeat(100);
            const timestamp = new Date().toLocaleString();

            const header = `\n${separator}\n` +
                          `页面: ${pageNumber} | 仓库: ${fileInfo.repo} | 文件: ${fileInfo.fileName}\n` +
                          `路径: ${fileInfo.filePath}\n` +
                          `URL: ${fileInfo.url}\n` +
                          `抓取时间: ${timestamp}\n` +
                          `文件大小: ${Utils.formatBytes(content.length)}\n` +
                          `${separator}\n`;

            return header + content + '\n';
        }

        saveProgress() {
            const data = {
                files: this.collectedFiles,
                currentPage: this.currentPage,
                totalPages: this.totalPages,
                processedFiles: this.processedFiles,
                totalFiles: this.totalFiles,
                successfulFiles: this.successfulFiles,
                errors: this.errors,
                lastUpdate: new Date().toISOString()
            };

            const success = StorageManager.saveData(data);
            if (!success) {
                UIManager.log('保存进度失败', 'warning');
            }
        }

        stopScraping() {
            this.isRunning = false;
            UIManager.updateButtonStates(false);
            UIManager.updateStatus('已停止', '#FF9800');

            // 保存最终进度
            this.saveProgress();

            UIManager.log('抓取任务已停止', 'info');
        }

        downloadResults() {
            if (this.collectedFiles.length === 0) {
                UIManager.log('没有可下载的内容', 'warning');
                UIManager.showNotification('由于CORS限制，建议手动复制文件内容', 'warning');
                this.showManualInstructions();
                return;
            }

            try {
                // 生成文件头信息
                const stats = {
                    generatedTime: new Date().toLocaleString(),
                    totalFiles: this.collectedFiles.length,
                    totalSize: this.collectedFiles.reduce((size, file) => size + (file.rawContentLength || 0), 0),
                    successRate: this.totalFiles > 0 ? Math.round((this.successfulFiles / this.totalFiles) * 100) : 0,
                    pagesProcessed: this.currentPage,
                    totalErrors: this.errors.length
                };

                const header = `GitHub批量文件抓取结果报告\n` +
                              `${'='.repeat(100)}\n` +
                              `生成时间: ${stats.generatedTime}\n` +
                              `文件数量: ${stats.totalFiles}\n` +
                              `数据大小: ${Utils.formatBytes(stats.totalSize)}\n` +
                              `处理页面: ${stats.pagesProcessed}\n` +
                              `成功率: ${stats.successRate}%\n` +
                              `错误数: ${stats.totalErrors}\n` +
                              `${'='.repeat(100)}\n\n`;

                // 按页面分组排序
                const sortedFiles = this.collectedFiles.sort((a, b) => {
                    if (a.pageNumber !== b.pageNumber) {
                        return a.pageNumber - b.pageNumber;
                    }
                    return a.fileName.localeCompare(b.fileName);
                });

                const allContent = header + sortedFiles
                    .map(file => file.content)
                    .join('\n');

                // 下载文件
                const success = Utils.createDownloadBlob(allContent, CONFIG.OUTPUT_FILENAME);

                if (success) {
                    const totalSize = Utils.formatBytes(allContent.length);
                    UIManager.log(`文件已下载: ${CONFIG.OUTPUT_FILENAME} (${totalSize})`, 'success');
                    UIManager.log(`包含 ${this.collectedFiles.length} 个文件，成功率 ${stats.successRate}%`, 'success');
                    UIManager.showNotification(`下载成功！${this.collectedFiles.length} 个文件`, 'success');
                } else {
                    throw new Error('文件下载失败');
                }

            } catch (error) {
                UIManager.log(`下载失败: ${error.message}`, 'error');
                UIManager.showNotification('下载失败', 'error');
            }
        }

        showManualInstructions() {
            const instructions = `
由于浏览器CORS限制，无法自动获取raw.githubusercontent.com的内容。
建议使用以下手动方法：

1. 点击GitHub搜索页面中的每个文件链接
2. 在打开的文件页面中，点击右上角的"复制"按钮
3. 将内容粘贴到文本编辑器中
4. 重复以上步骤处理所有文件
5. 最后保存为shipinywan.txt文件

或者：
- 安装Tampermonkey扩展后运行此脚本
- 使用支持跨域请求的浏览器扩展
            `;

            UIManager.log('显示手动操作指导', 'info');
            alert(instructions);
        }
    }

    // 初始化脚本
    function initialize() {
        try {
            // 检查页面类型
            if (!PageParser.isSearchPage()) {
                console.log('GitHub Scraper V4.1: 仅在GitHub代码搜索页面工作');
                return;
            }

            // 创建UI面板
            UIManager.createPanel();

            // 创建主实例
            window.gitHubScraperV41 = new GitHubScraperV41();

            // 恢复已保存的数据
            const savedData = StorageManager.getData();
            if (savedData.files && savedData.files.length > 0) {
                window.gitHubScraperV41.collectedFiles = savedData.files;
                window.gitHubScraperV41.successfulFiles = savedData.files.length;
                window.gitHubScraperV41.processedFiles = savedData.processedFiles || savedData.files.length;
                window.gitHubScraperV41.totalFiles = savedData.totalFiles || savedData.files.length;
                window.gitHubScraperV41.currentPage = savedData.currentPage || 1;
                window.gitHubScraperV41.totalPages = savedData.totalPages || 0;
                window.gitHubScraperV41.errors = savedData.errors || [];

                UIManager.log(`发现 ${savedData.files.length} 个已保存的文件`, 'info');
                UIManager.updateDataDisplay(savedData);

                if (savedData.errors && savedData.errors.length > 0) {
                    UIManager.log(`上次运行有 ${savedData.errors.length} 个错误`, 'warning');
                }
            }

            UIManager.log('GitHub批量抓取器 v4.1 已准备就绪', 'success');
            UIManager.log('优化版本：改进错误处理和性能', 'info');

            // 显示当前页面信息
            const fileLinks = PageParser.extractFileLinks();
            if (fileLinks.length > 0) {
                UIManager.log(`当前页面检测到 ${fileLinks.length} 个文件`, 'info');
            }

            const totalPages = PageParser.getTotalPages();
            const currentPage = PageParser.getCurrentPage();
            if (totalPages > 0) {
                UIManager.log(`检测到总共 ${totalPages} 页搜索结果，当前第 ${currentPage} 页`, 'info');
            }

            UIManager.log('点击"开始抓取"按钮开始批量抓取文件', 'info');

        } catch (error) {
            console.error('初始化失败:', error);
            UIManager.showNotification('脚本初始化失败', 'error');
        }
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initialize, 1500);
        });
    } else {
        setTimeout(initialize, 1500);
    }

})();
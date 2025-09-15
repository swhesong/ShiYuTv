/* eslint-disable @typescript-eslint/no-explicit-any,no-console */
import he from 'he';
import Hls from 'hls.js';
import { AdminConfig } from '@/lib/admin.types';

function getDoubanImageProxyConfig(): {
  proxyType:
    | 'direct'
    | 'server'
    | 'img3'
    | 'cmliussss-cdn-tencent'
    | 'cmliussss-cdn-ali'
    | 'custom';
  proxyUrl: string;
} {
  const doubanImageProxyType =
    localStorage.getItem('doubanImageProxyType') ||
    (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE ||
    'cmliussss-cdn-tencent';
  const doubanImageProxy =
    localStorage.getItem('doubanImageProxyUrl') ||
    (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY ||
    '';
  return {
    proxyType: doubanImageProxyType,
    proxyUrl: doubanImageProxy,
  };
}

/**
 * 处理图片 URL，如果设置了图片代理则使用代理
 */
export function processImageUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  // 仅处理豆瓣图片代理
  if (!originalUrl.includes('doubanio.com')) {
    return originalUrl;
  }

  const { proxyType, proxyUrl } = getDoubanImageProxyConfig();
  switch (proxyType) {
    case 'server':
      return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
    case 'img3':
      return originalUrl.replace(/img\d+\.doubanio\.com/g, 'img3.doubanio.com');
    case 'cmliussss-cdn-tencent':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.net'
      );
    case 'cmliussss-cdn-ali':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.com'
      );
    case 'custom':
      return `${proxyUrl}${encodeURIComponent(originalUrl)}`;
    case 'direct':
    default:
      return originalUrl;
  }
}

/**
 * 从m3u8地址获取视频质量等级和网络信息
 * @param m3u8Url m3u8播放列表的URL
 * @returns Promise<{quality: string, loadSpeed: string, pingTime: number}> 视频质量等级和网络信息
 */
export async function getVideoResolutionFromM3u8(m3u8Url: string): Promise<{
  quality: string; // 如720p、1080p等
  loadSpeed: string; // 自动转换为KB/s或MB/s
  pingTime: number; // 网络延迟（毫秒）
}> {
  try {
    // 直接使用m3u8 URL作为视频源，避免CORS问题
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.preload = 'metadata';

      // 测量网络延迟（ping时间） - 使用m3u8 URL而不是ts文件
      const pingStart = performance.now();
      let pingTime = 0;

      // 测量ping时间（使用m3u8 URL）
      fetch(m3u8Url, { method: 'HEAD', mode: 'no-cors' })
        .then(() => {
          pingTime = performance.now() - pingStart;
        })
        .catch(() => {
          pingTime = performance.now() - pingStart; // 记录到失败为止的时间
        });

      // 固定使用hls.js加载
      const hls = new Hls();

      // 设置超时处理
      const timeout = setTimeout(() => {
        hls.destroy();
        video.remove();
        reject(new Error('Timeout loading video metadata'));
      }, 4000);

      video.onerror = () => {
        clearTimeout(timeout);
        hls.destroy();
        video.remove();
        reject(new Error('Failed to load video metadata'));
      };

      let actualLoadSpeed = '未知';
      let hasSpeedCalculated = false;
      let hasMetadataLoaded = false;

      let fragmentStartTime = 0;

      // 检查是否可以返回结果
      const checkAndResolve = () => {
        if (
          hasMetadataLoaded &&
          (hasSpeedCalculated || actualLoadSpeed !== '未知')
        ) {
          clearTimeout(timeout);
          const width = video.videoWidth;
          if (width && width > 0) {
            hls.destroy();
            video.remove();

            // 根据视频宽度判断视频质量等级，使用经典分辨率的宽度作为分割点
            const quality =
              width >= 3840
                ? '4K' // 4K: 3840x2160
                : width >= 2560
                ? '2K' // 2K: 2560x1440
                : width >= 1920
                ? '1080p' // 1080p: 1920x1080
                : width >= 1280
                ? '720p' // 720p: 1280x720
                : width >= 854
                ? '480p'
                : 'SD'; // 480p: 854x480

            resolve({
              quality,
              loadSpeed: actualLoadSpeed,
              pingTime: Math.round(pingTime),
            });
          } else {
            // webkit 无法获取尺寸，直接返回
            resolve({
              quality: '未知',
              loadSpeed: actualLoadSpeed,
              pingTime: Math.round(pingTime),
            });
          }
        }
      };

      // 监听片段加载开始
      hls.on(Hls.Events.FRAG_LOADING, () => {
        fragmentStartTime = performance.now();
      });

      // 监听片段加载完成，只需首个分片即可计算速度
      hls.on(Hls.Events.FRAG_LOADED, (event: any, data: any) => {
        if (
          fragmentStartTime > 0 &&
          data &&
          data.payload &&
          !hasSpeedCalculated
        ) {
          const loadTime = performance.now() - fragmentStartTime;
          const size = data.payload.byteLength || 0;

          if (loadTime > 0 && size > 0) {
            const speedKBps = size / 1024 / (loadTime / 1000);

            // 立即计算速度，无需等待更多分片
            const avgSpeedKBps = speedKBps;

            if (avgSpeedKBps >= 1024) {
              actualLoadSpeed = `${(avgSpeedKBps / 1024).toFixed(1)} MB/s`;
            } else {
              actualLoadSpeed = `${avgSpeedKBps.toFixed(1)} KB/s`;
            }
            hasSpeedCalculated = true;
            checkAndResolve(); // 尝试返回结果
          }
        }
      });

      hls.loadSource(m3u8Url);
      hls.attachMedia(video);

      // 监听hls.js错误
      hls.on(Hls.Events.ERROR, (event: any, data: any) => {
        console.error('HLS错误:', data);
        if (data.fatal) {
          clearTimeout(timeout);
          hls.destroy();
          video.remove();
          reject(new Error(`HLS播放失败: ${data.type}`));
        }
      });

      // 监听视频元数据加载完成
      video.onloadedmetadata = () => {
        hasMetadataLoaded = true;
        checkAndResolve(); // 尝试返回结果
      };
    });
  } catch (error) {
    throw new Error(
      `Error getting video resolution: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function cleanHtmlTags(text: string): string {
  if (!text) return '';

  const cleanedText = text
    .replace(/<[^>]+>/g, '\n') // 将 HTML 标签替换为换行
    .replace(/\n+/g, '\n') // 将多个连续换行合并为一个
    .replace(/[ \t]+/g, ' ') // 将多个连续空格和制表符合并为一个空格，但保留换行符
    .replace(/^\n+|\n+$/g, '') // 去掉首尾换行
    .trim(); // 去掉首尾空格

  // 使用 he 库解码 HTML 实体
  return he.decode(cleanedText);
}


// ========================================================================
// 导入/导出功能所需的函数
// ========================================================================

type Source = AdminConfig['SourceConfig'][0];

/**
 * 导出数据为文件
 * @param data - 要导出的视频源数组
 * @param format - 格式 'json', 'csv', 'text'
 * @param cacheTime - 仅在导出json时需要，用于构建config.json结构
 */
export function exportData(
  data: Source[],
  format: 'json' | 'csv' | 'text',
  cacheTime?: number
) {
  let content: string;
  let mimeType: string;
  let fileExtension: string;
  let fileName: string; //用于自定义文件名

  switch (format) {
    case 'csv': {
      const header = 'name,key,api,detail,disabled\n';
      const rows = data
        .map(
          (s) =>
            `"${s.name}","${s.key}","${s.api}","${s.detail || ''}","${
              s.disabled
            }"`
        )
        .join('\n');
      content = header + rows;
      mimeType = 'text/csv;charset=utf-8;';
      fileExtension = 'csv';
      break;
    }

    case 'text':
      content = data.map((s) => s.api).join('\n');
      mimeType = 'text/plain;charset=utf-8;';
      fileExtension = 'txt';
      break;

    case 'json':
    default: {
      // 将数组转换为 "api_site" 对象结构
      const api_site = data.reduce(
        (acc, source) => {
          // 只导出需要的字段
          acc[source.key] = {
            name: source.name,
            api: source.api,
            detail: source.detail || '',
          };
          return acc;
        },
        {} as Record<string, { name: string; api: string; detail: string }>
      );

      const exportObject = {
        cache_time: cacheTime || 7200, // 使用传入的cacheTime或默认值
        api_site,
      };

      // 使用4个空格缩进以匹配格式
      content = JSON.stringify(exportObject, null, 4);
      mimeType = 'application/json;charset=utf-8;';
      fileExtension = 'json';
      break;
    }
  }

  // 根据格式决定文件名
  if (format === 'json') {
    fileName = 'config.json';
  } else {
    fileName = `video_sources_${new Date()
      .toISOString()
      .slice(0, 10)}.${fileExtension}`;
  }

  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName; //使用新的文件名变量
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 解析导入的文本数据并进行校验
 * @param rawText - 原始文本
 * @param existingKeys - 已存在的 key 集合，用于查重
 * @returns 解析结果，包括数据、格式和错误信息
 */
export function parseImportData(rawText: string, existingKeys: Set<string>) {
  const lines = rawText.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { data: [], format: 'unknown', errors: ['输入内容为空'] };

  const errors: string[] = [];
  const parsedData: Omit<Source, 'from'>[] = [];
  const importKeys = new Set<string>();
  let format = 'unknown';

  // 1. Try parsing as JSON
  try {
    const jsonData = JSON.parse(rawText);
    
    // 检查是否为 config.json 格式 (包含 api_site 对象)
    if (jsonData && typeof jsonData.api_site === 'object' && !Array.isArray(jsonData.api_site)) {
      format = 'json';
      Object.entries(jsonData.api_site).forEach(([key, site]: [string, any], index) => {
        if (!site.name || !site.api) {
          errors.push(`第 ${index + 1} 条 (JSON config): 源 "${key}" 缺少 name 或 api 字段。`);
          return;
        }
        if (existingKeys.has(key)) {
          errors.push(`第 ${index + 1} 条 (JSON config): Key "${key}" 已存在，将跳过。`);
          return;
        }
        if (importKeys.has(key)) {
          errors.push(`第 ${index + 1} 条 (JSON config): Key "${key}" 在导入数据中重复，将跳过。`);
          return;
        }
        parsedData.push({
          name: String(site.name),
          key: key,
          api: String(site.api),
          detail: String(site.detail || ''),
          disabled: false, // 默认不禁用
        });
        importKeys.add(key);
      });
      return { data: parsedData, format, errors };
    }
    
    // 检查是否为简单的对象数组格式
    if (Array.isArray(jsonData)) {
      format = 'json';
      jsonData.forEach((item, index) => {
        if (!item.key || !item.name || !item.api) {
          errors.push(`第 ${index + 1} 行 (JSON): 缺少 name, key, 或 api 字段。`);
          return;
        }
        if (existingKeys.has(item.key)) {
          errors.push(`第 ${index + 1} 行 (JSON): Key "${item.key}" 已存在，将跳过。`);
          return;
        }
        if (importKeys.has(item.key)) {
          errors.push(`第 ${index + 1} 行 (JSON): Key "${item.key}" 在导入数据中重复，将跳过。`);
          return;
        }
        parsedData.push({
          name: String(item.name),
          key: String(item.key),
          api: String(item.api),
          detail: String(item.detail || ''),
          disabled: Boolean(item.disabled),
        });
        importKeys.add(item.key);
      });
      return { data: parsedData, format, errors };
    }
  } catch (e) { /* 不是 JSON, 继续尝试下一种格式 */ }
  
  // 2. Try parsing as CSV
  if (lines[0].includes(',')) {
    format = 'csv';
    const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
    const nameIndex = header.indexOf('name');
    const keyIndex = header.indexOf('key');
    const apiIndex = header.indexOf('api');
    
    if (nameIndex > -1 && keyIndex > -1 && apiIndex > -1) {
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const key = values[keyIndex];
        const name = values[nameIndex];
        const api = values[apiIndex];

        if (!key || !name || !api) {
          errors.push(`第 ${i + 1} 行 (CSV): 缺少 name, key, 或 api 值。`);
          continue;
        }
        if (existingKeys.has(key)) {
          errors.push(`第 ${i + 1} 行 (CSV): Key "${key}" 已存在，将跳过。`);
          continue;
        }
        if (importKeys.has(key)) {
          errors.push(`第 ${i + 1} 行 (CSV): Key "${key}" 在导入数据中重复，将跳过。`);
          continue;
        }
        parsedData.push({
          key, name, api,
          detail: values[header.indexOf('detail')] || '',
          disabled: values[header.indexOf('disabled')] === 'true',
        });
        importKeys.add(key);
      }
      return { data: parsedData, format, errors };
    }
  }

  // 3. Assume Plain Text (one API per line)
  format = 'text';
  lines.forEach((line, index) => {
    try {
      const url = new URL(line);
      const name = url.hostname;
      const key = `imported_${Date.now()}_${index}`; // 生成唯一 key
      
      parsedData.push({
        name: `导入 - ${name}`,
        key,
        api: line,
        detail: '',
        disabled: false,
      });
    } catch (e) {
      errors.push(`第 ${index + 1} 行 (TEXT): "${line.slice(0, 30)}..." 不是一个有效的 URL。`);
    }
  });

  return { data: parsedData, format, errors };
}

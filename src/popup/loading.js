// loading.js - 索引构建进度页面

import { getAllEmbeddings, saveEmbedding } from '../utils/indexdb.js';
import { embed, waitForReady, setProgressCallback, setErrorCallback, checkChromeAI } from '../utils/workerClient.js';

const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const progressDetail = document.getElementById('progressDetail');
const loadingTitle = document.getElementById('loadingTitle');
const loadingDesc = document.getElementById('loadingDesc');

// 获取所有书签
async function getBookmarks() {
  return new Promise((resolve) => {
    chrome.bookmarks.getTree((tree) => {
      const result = [];

      function walk(nodes) {
        for (const n of nodes) {
          if (n.url) {
            result.push(n);
          }
          if (n.children) walk(n.children);
        }
      }

      walk(tree);
      resolve(result);
    });
  });
}

// 更新进度
function updateProgress(percent, current, total, message) {
  progressFill.style.width = `${percent}%`;
  progressText.textContent = `${percent}%`;
  progressDetail.textContent = message || `已处理 ${current} / ${total} 个书签`;
}

// 显示错误
function showError(message) {
  loadingTitle.textContent = '初始化失败';
  loadingDesc.textContent = '';
  progressFill.style.background = '#c62828';
  progressDetail.style.color = '#c62828';
  progressDetail.textContent = message;
}

// 跳转到主页面
function goToMain() {
  window.location.href = 'index.html';
}

// 模型下载进度状态
let lastProgressStatus = '';

// 构建索引
async function buildIndex() {
  loadingTitle.textContent = '正在构建索引';
  loadingDesc.textContent = '首次使用时，需要为收藏夹生成向量嵌入';

  // 检测 AI 模式
  const hasChromeAI = await checkChromeAI();
  if (hasChromeAI) {
    loadingDesc.textContent = '检测到 Chrome 内置 AI，将用于对话';
  }

  // 设置进度回调
  setProgressCallback((progress) => {
    const status = progress.status || '';
    const pct = progress.progress || 0;

    // 下载状态映射
    const statusMap = {
      'init': '正在初始化...',
      'fetch': '正在准备下载模型...',
      'download': `正在下载模型... ${Math.round(pct)}%`,
      'load': '正在加载模型...',
      'done': '模型加载完成',
    };

    const newStatus = statusMap[status] || status;
    if (newStatus !== lastProgressStatus || status === 'download') {
      lastProgressStatus = newStatus;

      if (status === 'download') {
        progressFill.style.width = `${Math.min(pct, 95)}%`;
        progressText.textContent = `${Math.round(pct)}%`;
        progressDetail.textContent = `正在下载模型文件...`;
      } else {
        progressFill.style.width = '5%';
        progressText.textContent = '5%';
        progressDetail.textContent = newStatus;
      }
    }
  });

  // 设置错误回调
  setErrorCallback((error) => {
    console.error('Worker error:', error);
    showError(`初始化失败: ${error}`);
  });

  // 设置超时（3分钟）
  const timeout = setTimeout(() => {
    showError('初始化超时，请检查网络连接');
  }, 3 * 60 * 1000);

  try {
    // 等待模型就绪
    updateProgress(5, 0, 0, '正在加载 AI 模型...');
    await waitForReady();
  } catch (err) {
    clearTimeout(timeout);
    showError(`加载失败: ${err.message}`);
    return;
  }

  clearTimeout(timeout);

  // 获取书签
  updateProgress(10, 0, 0, '正在读取收藏夹...');
  const bookmarks = await getBookmarks();
  const existing = await getAllEmbeddings();
  const existingUrls = new Set(existing.map(e => e.url));

  // 找出需要建立索引的书签
  const toProcess = bookmarks.filter(b => !existingUrls.has(b.url));
  const total = toProcess.length;

  if (total === 0) {
    updateProgress(100, 0, 0, '索引已是最新');
    setTimeout(goToMain, 500);
    return;
  }

  // 批量处理
  const BATCH_SIZE = 5;
  let processed = 0;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (bookmark) => {
        try {
          const embedding = await embed(bookmark.title);
          await saveEmbedding({
            url: bookmark.url,
            title: bookmark.title,
            embedding
          });
          processed++;
        } catch (err) {
          console.error('处理书签失败:', bookmark.title, err);
          processed++; // 失败也计入进度
        }
      })
    );

    const percent = Math.round((processed / total) * 80) + 10; // 10-90%
    updateProgress(percent, processed, total);
  }

  // 完成
  updateProgress(100, total, total, '索引构建完成');
  loadingTitle.textContent = '初始化完成';
  loadingDesc.textContent = '即将进入搜索页面...';

  setTimeout(goToMain, 800);
}

// 启动
buildIndex();

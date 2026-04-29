// settings.js - 设置页面

import { clearAllEmbeddings, saveEmbedding } from '../utils/indexdb.js';
import { embed, setProgressCallback, setErrorCallback, initSandboxForSettings } from '../utils/workerClient.js';

let isRebuilding = false;

// 初始化
async function init() {
  loadVersion();
  await loadSettings();
  setupEventListeners();
}

document.addEventListener('DOMContentLoaded', init);

// 加载设置
async function loadSettings() {
  const result = await chrome.storage.sync.get(['resultLimit']);
  const limit = result.resultLimit ?? 20;
  document.getElementById('resultLimit').value = limit;
}

// 加载版本号
function loadVersion() {
  const manifest = chrome.runtime.getManifest();
  const versionEl = document.querySelector('.version');
  if (versionEl) {
    versionEl.textContent = `${manifest.name} v${manifest.version}`;
  }
}

// 保存设置
async function saveSettings() {
  const inputValue = parseInt(document.getElementById('resultLimit').value, 10);
  const limit = isNaN(inputValue) ? 20 : inputValue;
  await chrome.storage.sync.set({ resultLimit: limit });
  document.getElementById('resultLimit').value = limit;
}

// 设置事件监听
function setupEventListeners() {
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  document.getElementById('resultLimit').addEventListener('change', saveSettings);

  document.getElementById('rebuildBtn').addEventListener('click', async () => {
    try {
      await rebuildDatabase();
    } catch (err) {
      console.error('重建失败:', err);
      setProgressVisible(true);
      updateProgress(0, `错误: ${err.message}`);
      setButtonLoading(false);
      isRebuilding = false;
    }
  });
}

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
function updateProgress(percent, message) {
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');

  progressFill.style.width = `${percent}%`;
  progressText.textContent = message;
}

// 显示/隐藏进度
function setProgressVisible(visible) {
  const container = document.getElementById('progressContainer');
  container.classList.toggle('active', visible);
}

// 设置按钮状态
function setButtonLoading(loading) {
  const btn = document.getElementById('rebuildBtn');
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
  btn.textContent = loading ? '重建中...' : '重建数据';
}

// 重建数据库
async function rebuildDatabase() {
  if (isRebuilding) return;

  isRebuilding = true;
  setButtonLoading(true);
  setProgressVisible(true);
  updateProgress(0, '正在清空旧数据...');

  try {
    // 1. 清空现有数据
    await clearAllEmbeddings();

    // 2. 初始化 sandbox
    setProgressCallback((progress) => {
      const status = progress.status || '';
      const pct = progress.progress || 0;

      const statusMap = {
        'init': '正在初始化...',
        'fetch': '正在准备下载模型...',
        'download': `正在下载模型... ${Math.round(pct)}%`,
        'load': '正在加载模型...',
        'done': '模型加载完成',
      };

      const newStatus = statusMap[status] || status;
      if (status === 'download') {
        updateProgress(Math.min(Math.round(pct) * 0.1 + 5, 15), newStatus);
      } else if (status !== 'done') {
        updateProgress(10, newStatus);
      }
    });

    setErrorCallback((error) => {
      throw new Error(error);
    });

    // 初始化 sandbox（settings 页面专用）
    updateProgress(5, '正在初始化模型...');
    await initSandboxForSettings();

    // 3. 获取所有书签
    updateProgress(20, '正在读取收藏夹...');
    const bookmarks = await getBookmarks();
    const total = bookmarks.length;

    if (total === 0) {
      updateProgress(100, '收藏夹为空');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
      return;
    }

    // 4. 批量处理
    updateProgress(25, `正在处理 ${total} 个书签...`);
    const BATCH_SIZE = 5;
    let processed = 0;

    for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
      const batch = bookmarks.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (bookmark) => {
          try {
            // 结合标题和URL进行向量化，提升中文搜索效果
            const textToEmbed = `${bookmark.title} ${bookmark.url}`;
            const embedding = await embed(textToEmbed);
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

      const percent = Math.round((processed / total) * 70) + 25; // 25-95%
      updateProgress(percent, `已处理 ${processed} / ${total} 个书签`);
    }

    // 5. 完成
    updateProgress(100, `重建完成！共处理 ${processed} 个书签`);
    setButtonLoading(false);

    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);

  } catch (err) {
    console.error('重建失败:', err);
    updateProgress(0, `重建失败: ${err.message}`);
    setButtonLoading(false);
    isRebuilding = false;
  }
}

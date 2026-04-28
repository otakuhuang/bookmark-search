// loading.js - 索引构建进度页面

import { getAllEmbeddings, saveEmbedding } from '../utils/indexdb.js';
import { embed, waitForReady } from '../utils/workerClient.js';

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

// 跳转到主页面
function goToMain() {
  window.location.href = 'index.html';
}

// 构建索引
async function buildIndex() {
  loadingTitle.textContent = '正在构建索引';
  loadingDesc.textContent = '首次使用时，需要为收藏夹生成向量嵌入';

  // 等待模型就绪
  updateProgress(5, 0, 0, '正在加载 AI 模型...');
  await waitForReady();

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

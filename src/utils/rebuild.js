// rebuild.js - 数据重建共享逻辑

import { getAllEmbeddings, clearAllEmbeddings, saveEmbedding } from '../utils/indexdb.js';
import { embed, waitForReady, setProgressCallback, setErrorCallback } from '../utils/workerClient.js';

// 获取所有书签
export async function getBookmarks() {
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

// 构建索引
export async function rebuildIndex(onProgress) {
  // 设置进度回调
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
    onProgress({ status: newStatus, percent: status === 'download' ? Math.min(pct, 15) : 10 });
  });

  // 设置错误回调
  setErrorCallback((error) => {
    throw new Error(error);
  });

  // 等待模型就绪
  await waitForReady();

  // 获取书签
  const bookmarks = await getBookmarks();
  const total = bookmarks.length;

  if (total === 0) {
    onProgress({ status: '收藏夹为空', percent: 100 });
    return { processed: 0, total: 0 };
  }

  // 批量处理
  const BATCH_SIZE = 5;
  let processed = 0;

  for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
    const batch = bookmarks.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (bookmark) => {
        try {
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
          processed++;
        }
      })
    );

    const percent = Math.round((processed / total) * 85) + 10;
    onProgress({ status: `已处理 ${processed} / ${total}`, percent });
  }

  return { processed, total };
}

// 清空数据库
export async function clearDatabase() {
  await clearAllEmbeddings();
}

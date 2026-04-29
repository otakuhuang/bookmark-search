// loading.js - 索引构建进度页面

import { rebuildIndex } from '../utils/rebuild.js';

const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const progressDetail = document.getElementById('progressDetail');
const loadingTitle = document.getElementById('loadingTitle');
const loadingDesc = document.getElementById('loadingDesc');

// 检查是否为重建模式
const urlParams = new URLSearchParams(window.location.search);
const isRebuildMode = urlParams.get('mode') === 'rebuild';

// 更新进度
function updateProgress(status, percent) {
  progressFill.style.width = `${percent}%`;
  progressText.textContent = `${percent}%`;
  progressDetail.textContent = status;
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

// 构建索引
async function buildIndex() {
  if (isRebuildMode) {
    loadingTitle.textContent = '正在重建索引';
    loadingDesc.textContent = '正在为收藏夹生成向量嵌入';
  } else {
    loadingTitle.textContent = '正在构建索引';
    loadingDesc.textContent = '首次使用时，需要为收藏夹生成向量嵌入';
  }

  // 设置超时（5分钟）
  const timeout = setTimeout(() => {
    showError('初始化超时，请检查网络连接');
  }, 5 * 60 * 1000);

  try {
    await rebuildIndex(({ status, percent }) => {
      updateProgress(status, percent);
    });
  } catch (err) {
    clearTimeout(timeout);
    showError(`初始化失败: ${err.message}`);
    return;
  }

  clearTimeout(timeout);

  // 完成
  loadingTitle.textContent = isRebuildMode ? '重建完成' : '初始化完成';
  loadingDesc.textContent = '即将进入搜索页面...';

  setTimeout(goToMain, 1000);
}

// 启动
buildIndex();

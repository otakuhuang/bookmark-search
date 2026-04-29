// settings.js - 设置页面

import { clearDatabase } from '../utils/rebuild.js';

const SESSION_KEY = 'searchSession';

// 初始化
async function init() {
  loadVersion();
  await loadSettings();
  setupEventListeners();
}

document.addEventListener('DOMContentLoaded', init);

// 加载版本号
function loadVersion() {
  const manifest = chrome.runtime.getManifest();
  const versionEl = document.querySelector('.version');
  if (versionEl) {
    versionEl.textContent = `${manifest.name} v${manifest.version}`;
  }
}

// 加载设置
async function loadSettings() {
  const result = await chrome.storage.sync.get(['resultLimit']);
  const limit = result.resultLimit ?? 20;
  document.getElementById('resultLimit').value = limit;
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
    setButtonLoading(true);
    try {
      await clearDatabase();
      window.location.href = 'loading.html?mode=rebuild';
    } catch (err) {
      console.error('清空失败:', err);
      setButtonLoading(false);
    }
  });

  document.getElementById('clearBtn').addEventListener('click', clearSession);
}

// 清除会话
async function clearSession() {
  const btn = document.getElementById('clearBtn');
  btn.disabled = true;
  btn.textContent = '清除中...';

  try {
    await chrome.storage.local.remove([SESSION_KEY]);
    btn.textContent = '已清除';
    setTimeout(() => {
      btn.textContent = '清除会话';
      btn.disabled = false;
    }, 1500);
  } catch (err) {
    console.error('清除会话失败:', err);
    btn.textContent = '清除会话';
    btn.disabled = false;
  }
}

// 设置按钮状态
function setButtonLoading(loading) {
  const btn = document.getElementById('rebuildBtn');
  btn.disabled = loading;
  btn.textContent = loading ? '清空中...' : '重建数据';
}

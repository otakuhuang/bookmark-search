// settings.js - 设置页面

import { clearDatabase } from '../utils/rebuild.js';

const SESSION_KEY = 'searchSession';

// i18n 初始化
function initI18n() {
  // 替换 data-i18n 属性的文本
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(key);
    if (message) {
      el.innerHTML = message;
    }
  });
}

// 初始化
async function init() {
  initI18n();
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
      console.error(chrome.i18n.getMessage('clearFailed') || 'Clear failed:', err);
      setButtonLoading(false);
    }
  });

  document.getElementById('clearBtn').addEventListener('click', clearSession);
}

// 清除会话
async function clearSession() {
  const btn = document.getElementById('clearBtn');
  btn.disabled = true;
  btn.textContent = chrome.i18n.getMessage('clearing') || 'Clearing...';

  try {
    await chrome.storage.local.remove([SESSION_KEY]);
    btn.textContent = chrome.i18n.getMessage('cleared') || 'Cleared';
    setTimeout(() => {
      btn.textContent = chrome.i18n.getMessage('clearSession') || 'Clear Session';
      btn.disabled = false;
    }, 1500);
  } catch (err) {
    console.error('Clear session failed:', err);
    btn.textContent = chrome.i18n.getMessage('clearSession') || 'Clear Session';
    btn.disabled = false;
  }
}

// 设置按钮状态
function setButtonLoading(loading) {
  const btn = document.getElementById('rebuildBtn');
  btn.disabled = loading;
  btn.textContent = loading 
    ? (chrome.i18n.getMessage('clearingDatabase') || 'Clearing...')
    : (chrome.i18n.getMessage('rebuildData') || 'Rebuild Data');
}

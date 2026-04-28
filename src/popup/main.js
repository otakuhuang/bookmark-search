// 收藏夹搜索 - 基于向量相似度

import { getAllEmbeddings } from '../utils/indexdb.js';
import { cosine } from '../utils/cosine.js';
import { embed, waitForReady } from '../utils/workerClient.js';

let ready = false;

// 初始化
async function init() {
  // 检查是否需要构建索引
  const existing = await getAllEmbeddings();
  if (existing.length === 0) {
    window.location.href = 'loading.html';
    return;
  }

  // 初始化 worker
  console.log('[Popup] Calling waitForReady...');
  waitForReady()
    .then(() => {
      console.log('[Popup] waitForReady resolved');
      ready = true;
      updateModelStatus('ready');
    })
    .catch((err) => {
      console.error('[Popup] waitForReady error:', err);
      updateModelStatus('error');
    });

  setupEventListeners();
}

document.addEventListener('DOMContentLoaded', init);

// 设置事件监听
function setupEventListeners() {
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const settingsBtn = document.getElementById('settingsBtn');

  sendBtn.addEventListener('click', handleSend);

  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSend();
    }
  });

  settingsBtn.addEventListener('click', () => {
    window.location.href = 'settings.html';
  });
}

// 更新模型状态
function updateModelStatus(status) {
  const statusText = document.getElementById('modelStatusText');
  const downloadBtn = document.getElementById('downloadBtn');

  switch (status) {
    case 'checking':
      statusText.textContent = '检查中...';
      statusText.className = '';
      break;
    case 'ready':
      statusText.textContent = '就绪';
      statusText.className = 'status-available';
      downloadBtn.style.display = 'none';
      break;
    case 'loading':
      statusText.textContent = '加载中...';
      statusText.className = 'status-downloading';
      break;
    case 'error':
      statusText.textContent = '错误';
      statusText.className = 'status-unavailable';
      downloadBtn.textContent = '查看要求';
      downloadBtn.className = 'download-btn btn-view';
      downloadBtn.style.display = 'block';
      break;
  }
}

// 搜索
async function search(query) {
  if (!ready) {
    throw new Error('模型未就绪');
  }

  const qEmb = await embed(query);
  const all = await getAllEmbeddings();

  if (all.length === 0) {
    return [];
  }

  const res = all
    .map(x => ({
      ...x,
      score: cosine(qEmb, x.embedding)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return res;
}

// 发送消息
async function handleSend() {
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const message = userInput.value.trim();

  if (!message || isLoading || !ready) return;

  // 显示用户消息
  appendMessage(message, 'user');
  userInput.value = '';

  // 显示加载状态
  setLoading(true);

  try {
    const results = await search(message);

    if (results.length === 0) {
      appendMessage(`抱歉，没有找到与「${message}」相关的收藏夹。\n\n可以尝试：\n• 使用更通用的关键词\n• 尝试「教程」「视频」「文档」等类别词`, 'ai');
    } else {
      const response = formatResults(message, results);
      appendMessage(response, 'ai');
    }
  } catch (error) {
    appendMessage('抱歉，搜索时出现问题: ' + error.message, 'ai');
  } finally {
    setLoading(false);
  }
}

// 格式化搜索结果
function formatResults(query, results) {
  let response = `根据「${query}」，找到 ${results.length} 个相关收藏夹：\n\n`;

  results.forEach((r, i) => {
    const score = Math.round(r.score * 100);
    response += `${i + 1}. [${r.title}](${r.url}) (${score}%)\n`;
  });

  return response;
}

// 添加消息
function appendMessage(content, type) {
  const chatContainer = document.getElementById('chatContainer');

  const welcome = chatContainer.querySelector('.welcome-message');
  if (welcome) welcome.remove();

  const messageDiv = document.createElement('div');
  messageDiv.className = `message message-${type}`;

  if (type === 'ai') {
    messageDiv.innerHTML = formatMessage(content);
  } else {
    messageDiv.textContent = content;
  }

  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 格式化消息中的链接
function formatMessage(content) {
  const escaped = escapeHtml(content);
  // 匹配 [标题](URL) 格式
  return escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="recommend-item" target="_blank"><span class="recommend-title">$1</span></a>'
  );
}

// 设置加载状态
let isLoading = false;

function setLoading(loading) {
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const chatContainer = document.getElementById('chatContainer');

  isLoading = loading;
  userInput.disabled = loading;
  sendBtn.disabled = loading || !ready;
  sendBtn.textContent = loading ? '...' : '发送';

  if (loading) {
    updateModelStatus('loading');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message message-ai';
    loadingDiv.id = 'loadingMessage';
    loadingDiv.innerHTML = `
      <div class="loading">
        <div class="loading-dots"><span></span><span></span><span></span></div>
        <span class="loading-tip">搜索中...</span>
      </div>
    `;
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  } else {
    updateModelStatus(ready ? 'ready' : 'error');
    const loadingMsg = document.getElementById('loadingMessage');
    if (loadingMsg) loadingMsg.remove();
  }
}

// HTML转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}


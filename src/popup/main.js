// Bookmark Search - 基于向量相似度

import { getAllEmbeddings } from '../utils/indexdb.js';
import { cosine } from '../utils/cosine.js';
import { embed, waitForReady } from '../utils/workerClient.js';

let ready = false;
let resultLimit = 20;
const SESSION_KEY = 'searchSession';

// 初始化
async function init() {
  // 检查是否需要构建索引
  const existing = await getAllEmbeddings();
  if (existing.length === 0) {
    window.location.href = 'loading.html';
    return;
  }

  // 加载设置
  const settings = await chrome.storage.sync.get(['resultLimit']);
  resultLimit = settings.resultLimit ?? 20;

  // 加载会话历史
  await loadSession();

  // 初始化 worker
  console.log('[Popup] Calling waitForReady...');
  waitForReady()
    .then(() => {
      console.log('[Popup] waitForReady resolved');
      ready = true;
    })
    .catch((err) => {
      console.error('[Popup] waitForReady error:', err);
      ready = false;
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

  // 混合搜索：向量相似度 + 关键词匹配
  const results = all
    .map(x => {
      // 1. 向量相似度分数 (0-1)
      const vectorScore = cosine(qEmb, x.embedding);

      // 2. 关键词匹配分数 (0-1)
      const keywordScore = keywordMatch(query, x.title, x.url);

      // 3. 混合打分（向量70% + 关键词30%）
      const finalScore = vectorScore * 0.7 + keywordScore * 0.3;

      return {
        ...x,
        score: finalScore,
        vectorScore,
        keywordScore
      };
    })
    .filter(x => x.score > 0.1)  // 提高阈值，过滤低质量结果
    .sort((a, b) => b.score - a.score);

  return results;
}

// 关键词匹配算法
function keywordMatch(query, title, url) {
  if (!query || !title) return 0;

  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const text = `${title} ${url}`.toLowerCase();

  // 精确匹配评分
  let exactMatch = 0;
  for (const word of queryWords) {
    if (text.includes(word)) {
      exactMatch++;
    }
  }

  // 计算精确匹配率
  const exactScore = queryWords.length > 0 ? exactMatch / queryWords.length : 0;

  // 计算标题匹配加成（标题匹配比URL匹配更重要）
  let titleMatch = 0;
  for (const word of queryWords) {
    if (title.toLowerCase().includes(word)) {
      titleMatch++;
    }
  }
  const titleBonus = titleMatch / queryWords.length * 0.5;

  // 最终分数 = 精确匹配 * 0.7 + 标题加成 * 0.3
  return Math.min(1, exactScore * 0.7 + titleBonus * 0.3);
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
    const allResults = await search(message);

    let response;
    if (allResults.length === 0) {
      response = `抱歉，没有找到与「${message}」相关的收藏夹。\n\n可以尝试：\n• 使用更通用的关键词\n• 尝试「教程」「视频」「文档」等类别词`;
    } else {
      const totalCount = allResults.length;
      // 应用结果限制
      const displayResults = resultLimit > 0 ? allResults.slice(0, resultLimit) : allResults;
      response = formatResults(message, displayResults, totalCount);
    }

    appendMessage(response, 'ai');

    // 保存会话
    await saveToSession({
      query: message,
      results: allResults.map(r => ({ title: r.title, url: r.url, score: r.score })),
      timestamp: Date.now()
    });
  } catch (error) {
    appendMessage('抱歉，搜索时出现问题: ' + error.message, 'ai');
  } finally {
    setLoading(false);
  }
}

// 保存到会话历史
async function saveToSession(entry) {
  const result = await chrome.storage.local.get([SESSION_KEY]);
  let session = result[SESSION_KEY] || [];
  session.push(entry);
  // 限制会话历史最多保存 100 条
  if (session.length > 100) {
    session = session.slice(-100);
  }
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}

// 加载会话历史
async function loadSession() {
  const result = await chrome.storage.local.get([SESSION_KEY]);
  const session = result[SESSION_KEY] || [];
  const chatContainer = document.getElementById('chatContainer');

  if (session.length > 0) {
    const welcome = chatContainer.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    for (const entry of session) {
      // 重建用户消息
      const userMsg = document.createElement('div');
      userMsg.className = 'message message-user';
      userMsg.textContent = entry.query;
      chatContainer.appendChild(userMsg);

      // 重建 AI 响应
      const aiMsg = document.createElement('div');
      aiMsg.className = 'message message-ai';
      const displayResults = resultLimit > 0 ? entry.results.slice(0, resultLimit) : entry.results;
      if (entry.results.length === 0) {
        aiMsg.innerHTML = formatMessage(`抱歉，没有找到与「${entry.query}」相关的收藏夹。\n\n可以尝试：\n• 使用更通用的关键词\n• 尝试「教程」「视频」「文档」等类别词`);
      } else {
        aiMsg.innerHTML = formatMessage(formatResults(entry.query, displayResults, entry.results.length));
      }
      chatContainer.appendChild(aiMsg);
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// 格式化搜索结果
function formatResults(query, results, totalCount) {
  let response = `根据「${query}」，找到 ${totalCount} 个相关收藏夹：\n\n`;

  results.forEach((r) => {
    response += `[${r.title}](${r.url})\n`;
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
  // 匹配 [标题](URL) 格式，添加 title 属性用于 tooltip
  return escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="recommend-item" target="_blank" title="$1"><span class="recommend-title">$1</span></a>'
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


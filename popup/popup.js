// 收藏夹AI助手 - 使用Chrome内置AI API

let allBookmarks = [];
let isLoading = false;
let modelSession = null;
let modelStatus = 'checking';

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await checkModelAvailability();
  setupEventListeners();
});

// 检查模型可用性
async function checkModelAvailability() {
  const statusEl = document.getElementById('modelStatus');

  try {
    // 检查Prompt API是否可用
    const availability = await languageModel.availability();

    switch (availability) {
      case 'available':
        modelStatus = 'available';
        statusEl.textContent = 'AI就绪';
        statusEl.className = 'status-available';
        break;
      case 'downloadable':
        modelStatus = 'downloadable';
        statusEl.textContent = '正在下载模型...';
        statusEl.className = 'status-downloading';
        // 自动触发下载
        await downloadModel();
        break;
      case 'downloading':
        modelStatus = 'downloading';
        statusEl.textContent = '下载中...';
        statusEl.className = 'status-downloading';
        break;
      default:
        modelStatus = 'unavailable';
        statusEl.textContent = 'AI不可用';
        statusEl.className = 'status-unavailable';
        showError('你的设备不支持Chrome内置AI，请确保：\n1. Chrome版本 >= 140\n2. 磁盘空间 >= 22GB\n3. 内存 >= 16GB');
    }
  } catch (error) {
    modelStatus = 'unavailable';
    statusEl.textContent = 'API不可用';
    statusEl.className = 'status-unavailable';
  }
}

// 下载模型
async function downloadModel() {
  try {
    const session = await languageModel.create({
      systemPrompt: '你是一个收藏夹助手，负责根据用户需求推荐收藏夹。'
    });
    modelSession = session;
    modelStatus = 'available';

    const statusEl = document.getElementById('modelStatus');
    statusEl.textContent = 'AI就绪';
    statusEl.className = 'status-available';
  } catch (error) {
    console.error('模型下载失败:', error);
    modelStatus = 'unavailable';
  }
}

// 设置事件监听
function setupEventListeners() {
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');

  sendBtn.addEventListener('click', handleSend);

  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSend();
    }
  });
}

// 发送消息
async function handleSend() {
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const message = userInput.value.trim();

  if (!message || isLoading) return;

  // 显示用户消息
  appendMessage(message, 'user');
  userInput.value = '';

  // 显示加载状态
  setLoading(true);

  try {
    if (allBookmarks.length === 0) {
      await loadBookmarks();
    }

    // 调用内置AI
    const response = await callAI(message);
    appendMessage(response, 'ai');
  } catch (error) {
    appendMessage('抱歉，出了点问题: ' + error.message, 'ai');
  } finally {
    setLoading(false);
  }
}

// 加载所有收藏夹
async function loadBookmarks() {
  try {
    const tree = await chrome.bookmarks.getTree();
    allBookmarks = flattenBookmarks(tree);
  } catch (error) {
    console.error('加载收藏夹失败:', error);
  }
}

// 扁平化收藏夹
function flattenBookmarks(nodes) {
  const result = [];

  function traverse(list) {
    for (const node of list) {
      if (node.url) {
        result.push({
          title: node.title,
          url: node.url,
          id: node.id
        });
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return result;
}

// 调用Chrome内置AI
async function callAI(userMessage) {
  // 构建收藏夹列表
  const bookmarkList = allBookmarks.map((b, i) =>
    `[${i + 1}] ${b.title}: ${b.url}`
  ).join('\n');

  const prompt = `你是一个收藏夹助手。根据用户的需求，从以下收藏夹列表中推荐最相关的网页。

收藏夹列表：
${bookmarkList}

用户需求：${userMessage}

请根据用户的需求，推荐最合适的3-5个收藏夹。回复格式：
1. 先用一句话说明你推荐的理由
2. 列出推荐的收藏夹，包含标题和URL（格式：[标题](URL)）
3. 如果没有完全匹配的，可以推荐相关的
4. 只返回推荐结果，不要其他内容。`;

  // 如果模型不可用，使用本地匹配
  if (modelStatus !== 'available') {
    return getLocalResponse(userMessage);
  }

  // 复用或创建会话
  if (!modelSession) {
    modelSession = await languageModel.create({
      systemPrompt: '你是一个收藏夹助手，负责根据用户需求推荐Chrome收藏夹中的网页。回答要简洁，只列出推荐的收藏夹。'
    });
  }

  try {
    const result = await modelSession.prompt(prompt);
    return result;
  } catch (error) {
    console.error('AI调用失败:', error);
    return getLocalResponse(userMessage);
  }
}

// 本地匹配（备用方案）
function getLocalResponse(query) {
  const queryLower = query.toLowerCase();

  const matches = allBookmarks.filter(b =>
    b.title.toLowerCase().includes(queryLower) ||
    b.url.toLowerCase().includes(queryLower)
  );

  if (matches.length > 0) {
    const recommendations = matches.slice(0, 3);
    let response = `根据「${query}」，我找到了以下收藏夹：\n\n`;

    recommendations.forEach((b, i) => {
      response += `${i + 1}. [${b.title}](${b.url})\n`;
    });

    return response;
  }

  return `抱歉，没有找到与「${query}」相关的收藏夹。可以试试「教程」「视频」「文档」等关键词。`;
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
function setLoading(loading) {
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const chatContainer = document.getElementById('chatContainer');

  isLoading = loading;
  userInput.disabled = loading;
  sendBtn.disabled = loading;
  sendBtn.textContent = loading ? '...' : '发送';

  if (loading) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message message-ai';
    loadingDiv.id = 'loadingMessage';
    loadingDiv.innerHTML = `
      <div class="loading">
        <div class="loading-dots"><span></span><span></span><span></span></div>
        AI思考中...
      </div>
    `;
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  } else {
    const loadingMsg = document.getElementById('loadingMessage');
    if (loadingMsg) loadingMsg.remove();
  }
}

// 显示错误
function showError(message) {
  const chatContainer = document.getElementById('chatContainer');
  const welcome = chatContainer.querySelector('.welcome-message');
  if (welcome) welcome.remove();

  const errorDiv = document.createElement('div');
  errorDiv.className = 'message message-ai error-message';
  errorDiv.textContent = message;
  chatContainer.appendChild(errorDiv);
}

// HTML转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
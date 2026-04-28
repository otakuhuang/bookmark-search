// 收藏夹AI助手 - 使用Chrome内置AI API

let allBookmarks = [];
let isLoading = false;
let modelSession = null;
let modelStatus = 'checking';

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await checkModelAvailability();
  setupEventListeners();
  setupDownloadButton();
});

// 检查模型可用性
async function checkModelAvailability() {
  const statusText = document.getElementById('modelStatusText');
  const downloadBtn = document.getElementById('downloadBtn');

  // 默认显示检查中
  statusText.textContent = '检查中...';

  // 添加点击事件显示详情
  statusText.style.cursor = 'pointer';
  statusText.title = '点击查看详情';
  statusText.onclick = async () => {
    await showModelDetails();
  };

  try {
    if (typeof LanguageModel === 'undefined') {
      throw new Error('API不存在');
    }
    const availability = await LanguageModel.availability();
    console.log('AI availability:', availability);

    if (availability === 'available') {
      modelStatus = 'available';
      statusText.textContent = 'AI就绪';
      statusText.className = 'status-available';
      downloadBtn.style.display = 'none';
    } else if (availability === 'downloadable') {
      modelStatus = 'downloadable';
      statusText.textContent = '可下载';
      statusText.className = 'status-downloading';
      downloadBtn.textContent = '下载AI模型';
      downloadBtn.className = 'download-btn btn-download';
      downloadBtn.style.display = 'block';
    } else if (availability === 'downloading') {
      modelStatus = 'downloading';
      statusText.textContent = '下载中...';
      statusText.className = 'status-downloading';
      downloadBtn.style.display = 'none';
      await waitForDownload();
    } else {
      setUnavailable('此设备不支持Chrome内置AI', statusText, downloadBtn);
    }
  } catch (error) {
    console.error('AI检查失败:', error);
    setUnavailable('API不可用，请查看要求', statusText, downloadBtn);
  }
}

// 显示模型详情
async function showModelDetails() {
  let details = 'AI状态详情：\n\n';

  try {
    if (typeof LanguageModel === 'undefined') {
      details += '❌ LanguageModel API 不存在\n';
      details += '请使用 Chrome 140+ 版本';
    } else {
      const availability = await LanguageModel.availability();
      details += `当前状态：${availability}\n`;

      switch (availability) {
        case 'available':
          details += '✓ AI模型已就绪，可以直接使用';
          break;
        case 'downloadable':
          details += '○ AI模型可下载，点击"下载AI模型"按钮开始下载';
          break;
        case 'downloading':
          details += '下载中...请稍候';
          break;
        case 'unavailable':
          details += '✗ 此设备不支持Chrome内置AI';
          break;
      }
    }
  } catch (error) {
    details += `检查出错：${error.message}`;
  }

  details += '\n\n硬件要求：';
  details += '\n- Chrome 140+';
  details += '\n- 磁盘空间 >= 22GB';
  details += '\n- 内存 >= 16GB';
  details += '\n- Windows 10+/macOS 13+/Linux';

  appendMessage(details, 'ai');
}

function setUnavailable(msg, statusText, downloadBtn) {
  modelStatus = 'unavailable';
  statusText.textContent = msg;
  statusText.className = 'status-unavailable';
  downloadBtn.textContent = '查看要求';
  downloadBtn.className = 'download-btn btn-view';
  downloadBtn.onclick = () => window.open('https://developer.chrome.com/docs/ai/get-started?hl=zh-cn', '_blank');
  downloadBtn.style.display = 'block';
  if (msg !== 'API不可用，请查看要求') {
    showError('你的设备不支持Chrome内置AI。\n\n需要满足：\n1. Chrome版本 >= 140\n2. 磁盘空间 >= 22GB\n3. 内存 >= 16GB');
  }
}

// 等待下载完成
async function waitForDownload() {
  let availability = await LanguageModel.availability();
  while (availability === 'downloading') {
    await new Promise(r => setTimeout(r, 1000));
    availability = await LanguageModel.availability();
  }
  await checkModelAvailability();
}

// 下载模型
function setupDownloadButton() {
  const downloadBtn = document.getElementById('downloadBtn');
  downloadBtn.addEventListener('click', async () => {
    if (modelStatus === 'downloadable') {
      try {
        const session = await LanguageModel.create({
          systemPrompt: '你是一个收藏夹助手，负责根据用户需求推荐收藏夹。',
          expectedLanguage: 'ja'
        });
        modelSession = session;
        modelStatus = 'available';
        await checkModelAvailability();
      } catch (error) {
        console.error('模型下载失败:', error);
      }
    }
  });
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
  // 控制发送的收藏夹数量，避免输入过长
  // 优先发送最近的收藏夹（最后添加的）
  let selectedBookmarks;
  const maxCount = 50;
  if (allBookmarks.length > maxCount) {
    // 取最新的收藏夹（最后面的）
    selectedBookmarks = allBookmarks.slice(-maxCount);
  } else {
    selectedBookmarks = allBookmarks;
  }

  // 构建收藏夹列表
  const bookmarkList = selectedBookmarks.map((b, i) =>
    `[${i + 1}] ${b.title}: ${b.url}`
  ).join('\n');

  const totalCount = allBookmarks.length;
  const prompt = `你是一个收藏夹助手。根据用户的需求，从以下收藏夹列表中推荐最相关的网页。
（共${totalCount}个收藏夹，当前显示最近${selectedBookmarks.length}个）

收藏夹列表：
${bookmarkList}

用户需求：${userMessage}

请根据用户的需求，推荐最合适的收藏夹。回复格式：
1. 先用一句话说明你推荐的理由
2. 列出推荐的收藏夹，包含标题和URL（格式：[标题](URL)）
3. 如果没有完全匹配的，可以推荐相关的
4. 只返回推荐结果，不要其他内容。`;

  // 明确检查并显示AI状态
  let aiStatusText = '';
  if (modelStatus === 'available') {
    aiStatusText = '';
  } else {
    aiStatusText = '[使用本地匹配 - AI不可用]\n\n';
    return aiStatusText + getLocalResponse(userMessage);
  }

  // 复用或创建会话
  if (!modelSession) {
    modelSession = await LanguageModel.create({
      systemPrompt: '你是一个收藏夹助手，负责根据用户需求推荐Chrome收藏夹中的网页。回答要简洁，只列出推荐的收藏夹。',
      expectedLanguage: 'ja'
    });
  }

  try {
    const result = await modelSession.prompt(prompt);
    return result;
  } catch (error) {
    const errorMsg = error.message || error;
    console.log('AI调用失败，错误信息:', errorMsg);

    // 输入过长时，减少数量重试
    if (errorMsg.includes('input is too large') || errorMsg.includes('too long')) {
      // 限制为更少的数量重试（取最新的20条）
      const retryBookmarks = allBookmarks.slice(-20);
      const retryList = retryBookmarks.map((b, i) =>
        `[${i + 1}] ${b.title}: ${b.url}`
      ).join('\n');

      const retryPrompt = `你是一个收藏夹助手。根据用户的需求，从以下收藏夹列表中推荐最相关的网页。

收藏夹列表：
${retryList}

用户需求：${userMessage}

请根据用户的需求，推荐最合适的收藏夹。回复格式：
1. 先用一句话说明你推荐的理由
2. 列出推荐的收藏夹，包含标题和URL（格式：[标题](URL)）
3. 如果没有完全匹配的，可以推荐相关的
4. 只返回推荐结果，不要其他内容。`;

      try {
        const result = await modelSession.prompt(retryPrompt);
        return result;
      } catch (retryError) {
        console.log('AI重试失败，错误信息:', retryError.message || retryError);
      }
    }

    // 调用失败时也明确标识
    return '[使用本地匹配 - AI调用失败]\n\n' + getLocalResponse(userMessage);
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
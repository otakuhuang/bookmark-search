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

// 调用Chrome内置AI（分批处理模式）
async function callAI(userMessage) {
  // 初始化modelSession
  if (!modelSession) {
    modelSession = await LanguageModel.create({
      systemPrompt: '你是一个收藏夹助手，负责根据用户需求推荐Chrome收藏夹中的网页。',
      expectedLanguage: 'ja'
    });
  }

  // 分批处理配置
  const BATCH_SIZE = 50; // 每批处理的收藏夹数量
  const totalCount = allBookmarks.length;
  const batchCount = Math.ceil(totalCount / BATCH_SIZE);

  // 第一阶段：分批询问AI筛选相关收藏夹
  let relevantBookmarks = [];

  for (let i = 0; i < batchCount; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, totalCount);
    const batch = allBookmarks.slice(start, end);

    const batchList = batch.map((b, idx) =>
      `[${start + idx + 1}] ${b.title}: ${b.url}`
    ).join('\n');

    const batchPrompt = `你是一个收藏夹助手。用户需求：${userMessage}

从以下收藏夹列表中，筛选出与用户需求相关的收藏夹。
（共${totalCount}个收藏夹，这是第${i + 1}/${batchCount}批，编号${start + 1}-${end}）

收藏夹列表：
${batchList}

请严格按照以下JSON格式回复，只返回JSON，不要其他内容：
{"relevant": [{"index": 编号, "title": "标题", "url": "链接"}, ...]}`;

    try {
      const batchResult = await modelSession.prompt(batchPrompt);
      // 解析AI返回的JSON
      const parsed = parseAIResponse(batchResult);
      if (parsed && parsed.relevant) {
        relevantBookmarks.push(...parsed.relevant);
      }
    } catch (error) {
      console.log(`第${i + 1}批处理失败，继续下一批:`, error.message);
    }

    // 更新加载提示
    updateLoadingTip(`AI分析中... (${i + 1}/${batchCount})`);
  }

  // 第二阶段：如果没有找到相关收藏夹
  if (relevantBookmarks.length === 0) {
    return `抱歉，没有找到与「${userMessage}」相关的收藏夹。可以试试其他关键词，如「教程」「视频」「文档」等。`;
  }

  // 第三阶段：从所有相关收藏夹中选择最佳推荐
  const allRelevantList = relevantBookmarks.map((b, i) =>
    `[${i + 1}] ${b.title}: ${b.url}`
  ).join('\n');

  const finalPrompt = `你是一个收藏夹助手。用户需求：${userMessage}

从以下与需求相关的收藏夹中，选择最合适的3-5个进行推荐。

相关收藏夹列表：
${allRelevantList}

请回复：
1. 先用一句话说明你推荐的理由
2. 列出推荐的收藏夹（格式：[标题](URL)）
3. 只返回推荐结果，不要其他内容。`;

  try {
    const finalResult = await modelSession.prompt(finalPrompt);
    return finalResult;
  } catch (error) {
    // 如果最终总结失败，直接返回相关列表
    return `找到${relevantBookmarks.length}个相关收藏夹：\n\n` +
      relevantBookmarks.slice(0, 5).map((b, i) =>
        `${i + 1}. [${b.title}](${b.url})`
      ).join('\n');
  }
}

// 解析AI返回的JSON响应
function parseAIResponse(response) {
  try {
    // 尝试提取JSON部分
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.log(response)
    console.log('JSON解析失败，尝试其他方式', error.message);
  }
  return null;
}

// 更新加载提示
function updateLoadingTip(text) {
  const loadingMsg = document.getElementById('loadingMessage');
  if (loadingMsg) {
    const tip = loadingMsg.querySelector('.loading-tip');
    if (tip) tip.textContent = text;
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
        <span class="loading-tip">AI分析中...</span>
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
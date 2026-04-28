// workerClient.js - 支持 Chrome 内置 AI 或本地模型
// 使用 sandbox iframe + Web Worker 运行 WASM（Chrome MV3 不允许在扩展页面执行 WASM）

let sandboxFrame;
let id = 0;
const pending = new Map();
let progressCallback;
let errorCallback;

// AI 模式: 'chrome' | 'local'
let aiMode = null;
let chromeSession = null;

// 检测 Chrome 内置 AI 是否可用
export async function checkChromeAI() {
    if (typeof chrome !== 'undefined' && chrome.ai && chrome.ai.languageModel) {
        try {
            const capabilities = await chrome.ai.languageModel.capabilities();
            return capabilities.available === 'readily' || capabilities.available === 'after-download';
        } catch {
            return false;
        }
    }
    return false;
}

// 初始化 sandbox iframe（内含 Web Worker）
function initSandbox() {
    const sandboxUrl = chrome.runtime.getURL('src/sandbox/sandbox.html');
    console.log('[WorkerClient] initSandbox() - URL:', sandboxUrl);

    // 如果已经初始化过，直接返回
    if (sandboxFrame) {
        console.log('[WorkerClient] Sandbox already initialized');
        return Promise.resolve();
    }

    sandboxFrame = document.createElement('iframe');
    sandboxFrame.src = sandboxUrl;
    sandboxFrame.style.display = 'none';
    document.body.appendChild(sandboxFrame);
    console.log('[WorkerClient] Sandbox iframe created');

    // 监听来自 sandbox 的消息
    window.addEventListener('message', handleSandboxMessage);
}

// 导出初始化 sandbox 函数（用于 settings 页面）
export async function initSandboxForSettings() {
    // 如果已经初始化过（可能从主页面继承），直接返回
    if (sandboxFrame) {
        console.log('[WorkerClient] Sandbox already initialized');
        return;
    }

    const sandboxUrl = chrome.runtime.getURL('src/sandbox/sandbox.html');
    console.log('[WorkerClient] initSandboxForSettings() - URL:', sandboxUrl);

    sandboxFrame = document.createElement('iframe');
    sandboxFrame.src = sandboxUrl;
    sandboxFrame.style.display = 'none';
    document.body.appendChild(sandboxFrame);
    console.log('[WorkerClient] Sandbox iframe created');

    // 注册消息监听器（settings 页面没有主页面初始化，需要自己注册）
    window.addEventListener('message', handleSandboxMessage);

    // 等待 sandbox iframe 就绪
    await new Promise((resolve) => {
        pending.set('__sandbox-ready__', resolve);
    });
    console.log('[WorkerClient] Sandbox iframe ready');

    // 发送初始化消息
    const modelsDir = chrome.runtime.getURL('models/');
    postToSandbox({ type: 'init', modelPath: '../models/all-MiniLM-L6-v2', modelsDir });

    // 等待模型加载完成
    await new Promise((resolve) => {
        pending.set('__init__', resolve);
    });
    console.log('[WorkerClient] Model ready');
}

// 统一的消息处理函数
function handleSandboxMessage(e) {
    if (!e.data || typeof e.data.type !== 'string') return;

    const { type, requestId, embedding, progress, error } = e.data;
    console.log('[WorkerClient] Message received:', type);

    if (type === 'sandbox-ready') {
        if (pending.has('__sandbox-ready__')) {
            pending.get('__sandbox-ready__')();
            pending.delete('__sandbox-ready__');
        }
        return;
    }

    if (type === 'progress' && progressCallback) {
        progressCallback(progress);
        return;
    }

    if (type === 'error' && errorCallback) {
        console.error('[WorkerClient] Sandbox error:', error);
        errorCallback(error);
        return;
    }

    if (type === 'ready') {
        console.log('[WorkerClient] Model ready event received');
        if (pending.has('__init__')) {
            pending.get('__init__')();
            pending.delete('__init__');
        }
        return;
    }

    if (type === 'result' && pending.has(requestId)) {
        pending.get(requestId)(embedding);
        pending.delete(requestId);
    }
}

// 重新导出 initSandbox
export { initSandbox };

// 向 sandbox 发送消息
function postToSandbox(data) {
    sandboxFrame.contentWindow.postMessage(data, '*');
}

// 初始化 Chrome AI Session
async function initChromeAI() {
    chromeSession = await chrome.ai.languageModel.create({
        systemPrompt: "你是一个向量嵌入模型。请直接将输入文本转为向量。不要有其他输出。"
    });
}

// 设置进度回调
export function setProgressCallback(cb) {
    progressCallback = cb;
}

// 设置错误回调
export function setErrorCallback(cb) {
    errorCallback = cb;
}

// 获取当前 AI 模式
export function getAIMode() {
    return aiMode;
}

// 获取 AI 模式描述
export function getAIModeText() {
    if (aiMode === 'chrome') return 'Chrome 内置 AI';
    return '本地模型';
}

// 等待初始化完成
export async function waitForReady() {
    console.log('[WorkerClient] waitForReady() called');

    // 优先使用 Chrome 内置 AI (用于对话/摘要)
    const hasChromeAI = await checkChromeAI();
    console.log('[WorkerClient] Chrome AI available:', hasChromeAI);

    if (hasChromeAI) {
        aiMode = 'chrome';
        progressCallback?.({
            status: 'init',
            progress: 0
        });
        await initChromeAI();
        console.log('[WorkerClient] Chrome AI session created');
        progressCallback?.({
            status: 'done',
            progress: 100
        });
        return;
    }

    // 回退到本地模型（sandbox iframe + worker）
    console.log('[WorkerClient] Falling back to local model');
    aiMode = 'local';
    initSandbox();

    // 等待 sandbox iframe 就绪
    await new Promise((resolve) => {
        pending.set('__sandbox-ready__', resolve);
    });
    console.log('[WorkerClient] Sandbox ready, sending init message');

    // 在扩展页面中计算完整的 modelsDir URL（sandbox 中无法用 new URL 解析 chrome-extension:// 协议）
    const modelsDir = chrome.runtime.getURL('models/');
    console.log('[WorkerClient] modelsDir:', modelsDir);
    postToSandbox({ type: 'init', modelPath: '../models/all-MiniLM-L6-v2', modelsDir });

    return new Promise((resolve) => {
        pending.set('__init__', resolve);
    });
}

// 文本嵌入 - 始终使用本地模型获取向量
export async function embed(text) {
    console.log('[WorkerClient] embed() called with text:', text.substring(0, 50));

    if (!sandboxFrame) {
        console.log('[WorkerClient] Sandbox not initialized, creating...');
        initSandbox();
        await new Promise((resolve) => {
            pending.set('__sandbox-ready__', resolve);
        });
        const modelsDir = chrome.runtime.getURL('models/');
        postToSandbox({ type: 'init', modelPath: '../models/all-MiniLM-L6-v2', modelsDir });
        await new Promise((resolve) => {
            pending.set('__init__', resolve);
        });
        console.log('[WorkerClient] Sandbox ready');
    }

    return new Promise((resolve) => {
        const requestId = id++;
        pending.set(requestId, resolve);
        postToSandbox({
            type: 'embed',
            text,
            requestId
        });
    });
}

// 使用 Chrome AI 生成对话响应（用于搜索结果格式化）
export async function chatWithChromeAI(prompt) {
    if (aiMode === 'chrome' && chromeSession) {
        const stream = chromeSession.promptStreaming(prompt);
        let response = '';
        for await (const chunk of stream) {
            response += chunk;
        }
        return response;
    }
    return null;
}

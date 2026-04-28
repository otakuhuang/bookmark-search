import { pipeline, env } from "@xenova/transformers";

// 配置：禁止从 HuggingFace 下载，使用本地模型
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.useBrowserCache = false;

let embedder;

// 判断运行环境：Worker 还是 sandbox iframe
const isWorker = typeof window === 'undefined';

// 简单的 ID 生成器（替代 import.meta.url）
let instanceId = 0;

// 发送消息的抽象
function sendMessage(data) {
    if (isWorker) {
        self.postMessage(data);
    } else {
        window.parent.postMessage(data, '*');
    }
}

// 进度回调
function progressCallback(info) {
    console.log('[Embedding] Progress:', info.status, info.progress);
    sendMessage({
        type: 'progress',
        progress: {
            status: info.status,
            progress: info.progress || 0,
            file: info.file || ''
        }
    });
}

// 处理消息
async function handleMessage(event) {
    const { type, text, requestId, modelPath, modelsDir } = event.data;

    if (type === 'init') {
        try {
            // modelsDir 始终从消息中传递，不再依赖 import.meta.url
            if (modelsDir) {
                env.localModelPath = modelsDir;
            }
            console.log('[Embedding] env.localModelPath:', env.localModelPath);

            const modelName = (modelPath || 'all-MiniLM-L6-v2').split('/').pop();
            console.log('[Embedding] Using model name:', modelName);

            embedder = await pipeline(
                "feature-extraction",
                modelName,
                { progress_callback: progressCallback }
            );
            console.log('[Embedding] Init complete');
            sendMessage({ type: 'ready', requestId });
        } catch (err) {
            console.error('[Embedding] Init error:', err);
            sendMessage({
                type: 'error',
                requestId,
                error: err.message
            });
        }
    }

    if (type === 'embed') {
        try {
            const output = await embedder(text, {
                pooling: 'mean',
                normalize: true,
            });

            sendMessage({
                type: 'result',
                requestId,
                embedding: Array.from(output.data)
            });
        } catch (err) {
            sendMessage({
                type: 'error',
                requestId,
                error: err.message
            });
        }
    }
}

// 根据环境注册消息监听
if (isWorker) {
    self.onmessage = handleMessage;
} else {
    // sandbox 模式：监听来自父页面的消息
    window.addEventListener('message', (e) => {
        // sandbox 中 window.parent 可能因跨 origin 无法直接比较
        // 只处理包含 type 字段的消息
        if (e.data && e.data.type) {
            handleMessage(e);
        }
    });
}

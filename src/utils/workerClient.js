let worker = new Worker(
    chrome.runtime.getURL('worker/embedding.worker.js'),
    { type: 'module' }
);

let id = 0;
const pending = new Map();

worker.postMessage({ type: 'init' });

worker.addEventListener('message', (e) => {
    const { type, requestId, payload, embedding } = e.data;

    // Handle init ready
    if (type === 'ready') {
        if (pending.has('__init__')) {
            pending.get('__init__')();
            pending.delete('__init__');
        }
        return;
    }

    // Handle embed result
    if (type === 'result' && pending.has(requestId)) {
        pending.get(requestId)(embedding || payload?.[0]);
        pending.delete(requestId);
    }
});

export function waitForReady() {
    return new Promise((resolve) => {
        pending.set('__init__', resolve);
        worker.postMessage({ type: 'init' });
    });
}

export function embed(text) {
    return new Promise((resolve) => {
        const requestId = id++;
        pending.set(requestId, resolve);
        worker.postMessage({
            type: 'embed',
            text,
            requestId
        });
    });
}
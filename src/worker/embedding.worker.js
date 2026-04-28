import { pipeline, env } from "@xenova/transformers";

env.allowLocalModels = true;
env.useBrowserCache = false;

let embedder;

self.onmessage = async (event) => {
    const { type, text, requestId } = event.data;

    if (type === 'init') {
        embedder = await pipeline("feature-extraction", "sentence-transformers/all-MiniLM-L6-v2");
        self.postMessage({ type: 'ready', requestId });
    }

    if (type === 'embed') {
        const output = await embedder(text, {
            pooling: 'mean',
            normalize: true,
        });

        self.postMessage({
            type: 'result',
            requestId,
            embedding: Array.from(output.data)
        });
    }
};
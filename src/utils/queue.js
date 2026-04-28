export class AsyncQueue {
    constructor(concurrency = 2) {
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }

    push(task) {
        return new Promise((resolve) => {
            this.queue.push({ task, resolve });
            this.next();
        });
    }

    async next() {
        if (this.running >= this.concurrency) return;
        if (this.queue.length === 0) return;

        const { task, resolve } = this.queue.shift();
        this.running++;

        try {
            const result = await task();
            resolve(result);
        } catch (err) {
            resolve(Promise.reject(err));
        }

        this.running--;
        this.next();
    }

    get size() {
        return this.queue.length;
    }

    get active() {
        return this.running;
    }
}
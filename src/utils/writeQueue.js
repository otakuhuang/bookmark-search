export class WriteQueue {
    constructor() {
        this.queue = Promise.resolve();
    }

    push(task) {
        this.queue = this.queue.then(task);
        return this.queue;
    }

    get size() {
        return this.queue.length;
    }
}
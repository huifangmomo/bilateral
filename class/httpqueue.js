'use strict';
module.exports = class HttpQueue {
    //构造函数 
    constructor(worker, options) {
        this.worker = worker;
        options = options || {};
        this.concurrency = options.concurrency || 1;
        this.every = options.every || 0;
        this.maxTasks = options.maxTasks || Infinity;

        //内构参数
        this._queue = [];
        this._done = false;
        //执行定时刷新任务
        let self = this
        setInterval(() => {
            this._done = true
            if (!!self._queue.length) {
                self._queue[0].forEach(element => {
                    self._process(element)
                });
                self._queue.shift()
            }
        }, this.every)
    }

    //获取当前区间任务数
    _getNowTasks() {
        if (!!this._queue.length == false)
            this._queue.push([])
        return this._queue[0].length
    }

    _getTotalTasks() {
        let total = 0;
        for (let index = 0; index < this._queue.length; index++) {
            total += (this._queue[index].length)
        }
        return total
    }


    /**
     * 添加任务到队列
     *
     * @param {Object} args...
     * @param {Function(!Error, ...)} callback
     */
    push() {
        let intransit = this._getNowTasks()
        let totaltasks = this._getTotalTasks()
        if (intransit < this.concurrency) {
            this._queue[0].push(null)
            this._process(arguments)
        } else {
            let index = Math.floor(totaltasks / this.concurrency)
            if (this._queue.length < index + 1)
                this._queue.push([])
            this._queue[index].push(arguments)
        }
    }


    /**
     * Starts a task
     *
     * @param {Object} arguments
     */
    _process(args) {
        if (!!args) {
            args = Array.prototype.slice.call(args);
            this.worker.apply(null, args);
        }
    }
};
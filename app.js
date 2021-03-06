'use strict';

const params = process.argv.slice(2); //一个交易对数组 [ 'eos', 'eth',"0.01" ]
const fs = require('fs');
const EventEmitter = require('events').EventEmitter;
const B = require("./class/huobi");
const A = require("./class/okex");
const Order = require('./class/order');
const ComConsumer = require('./class/comConsumer');
let exec = require('child_process').exec;
let str = 'pm2 stop bilateral_NEOBTC_fix';

const tradeString = params[0] + '/' + params[1];

const config = JSON.parse(fs.readFileSync(__dirname + '/config/config.json'));

let balances = config.balance;
let dropNum = 0;

let orderMap = new Map();

function main() {

    let event = new EventEmitter();

    for (let i = 0; i < config.orderOptions.normal; i++) {
        let order = new Order(tradeString, params[2], i, config, 0, event);
        order.isOn = false;
        if (i === 0) {
            balancesCompute(order);
            order.init();
            order.isOn = true;
        }
        orderMap.set(i, order)
    }

    for (let i = 0; i < config.orderOptions.toA; i++) {
        let index = i + config.orderOptions.normal;
        let order = new Order(tradeString, params[2], index, config, 1, event);
        order.isOn = false;
        if (i === 0) {
            balancesCompute(order);
            order.init();
            order.isOn = true;
        }
        orderMap.set(i + config.orderOptions.normal, order)
    }

    for (let i = 0; i < config.orderOptions.toB; i++) {
        let index = i + config.orderOptions.normal + config.orderOptions.toA;
        let order = new Order(tradeString, params[2], index, config, 2, event);
        order.isOn = false;
        if (i === 0) {
            balancesCompute(order);
            order.init();
            order.isOn = true;
        }
        orderMap.set(index, order)
    }

    let topics = config.topics;
    topics.push({"topic": "depth_" + config.A.name + "_" + params[0] + params[1], "partition": 0});
    topics.push({"topic": "depth_" + config.B.name + "_" + params[0] + params[1], "partition": 0});

    const comConsumer = new ComConsumer(event, config.KafkaClient, topics);
    let A_Depth = {};
    let B_Depth = {};

    const a = new A(null, config.A.AccessID, config.A.SecretKey, "5720120");
    const b = new B(null, config.B.AccessID, config.B.SecretKey, "5720120");

    event.on('depth_update', message => {
        console.log(message.topic)
        switch (message.topic) {
            case "depth_" + config.A.name + "_" + params[0] + params[1]:
                if (message == 3) {
                    return;
                }
                A_Depth = JSON.parse(message.value).depth;
                break;

            case "depth_" + config.B.name + "_" + params[0] + params[1]:
                B_Depth = JSON.parse(message.value).depth;
                break;
        }
        if (A_Depth.bids && B_Depth.bids) {
            for (let [key, value] of orderMap) {
                if (value.isOn === true) {
                    value.check(A_Depth, B_Depth, a, b)
                }
            }
        }

    });
    event.on('order_update', (orderStatus, orderInfo, topic) => {
        if (!orderInfo) {
            return;
        }
        if (orderInfo.market.toUpperCase() != (params[0] + params[1])) {
            return;
        }
        // if(orderInfo.price == 0 && !!orderInfo["order-price"]){
        //     orderInfo.price = orderInfo["order-price"];
        // }
        // if(parseInt(orderStatus)===1){
        //     let market = "A";
        //     if(topic===config.B.name){
        //         market = "B";
        //     }
        //
        //     if(parseInt(orderInfo.side)===1){ //卖出 -NEO
        //         balances[market][0] -= parseFloat(orderInfo.amount);
        //     }else{ //-BTC
        //         balances[market][1] -= parseFloat(orderInfo.price)*parseFloat(orderInfo.amount);
        //     }
        // }else if(parseInt(orderStatus)===3 ){
        //     if((orderInfo.deal_money === 0 || orderInfo.deal_money === '0')){
        //         let market = "A";
        //         if(topic===config.B.name){
        //             market = "B";
        //         }
        //         if(parseInt(orderInfo.side)===1){ //取消卖   +NEO
        //             balances[market][0] += parseFloat(orderInfo.amount);
        //         }else{ //取消买    +BTC
        //             balances[market][1] += parseFloat(orderInfo.price)*parseFloat(orderInfo.amount);
        //         }
        //
        //     }else {
        //         let market = "A";
        //         if(topic===config.B.name){
        //             market = "B";
        //         }
        //         if(parseInt(orderInfo.side)===1){ //卖出 +BTC
        //             balances[market][1] += parseFloat(orderInfo.price)*parseFloat(orderInfo.amount);
        //         }else{ //买到 +NEO
        //             balances[market][0] += parseFloat(orderInfo.amount);
        //         }
        //     }
        //
        // }
        for (let [key, value] of orderMap) {
            if (value.isOn === true) {
                value.order_update(orderStatus, orderInfo)
            }
        }
        orderMap.get(0).log.info("===============" + topic + "===" + orderStatus + "===============");
        orderMap.get(0).log.info(orderInfo);
        orderMap.get(0).log.info("==================================================");
    });
    event.on('woker_start', index => {
        console.log('woker_start' + index);
        if(dropNum<0){
            orderMap.get(index).timeoutObj = setTimeout(() => {
                let order = null;
                if (balances.A[0] > config.orderOptions.amount &&
                    balances.B[0] > config.orderOptions.amount &&
                    balances.A[1] > config.orderOptions.amount * config.orderOptions.maxPrice &&
                    balances.B[1] > config.orderOptions.amount * config.orderOptions.maxPrice) { //两边都能搬
                    for (let [key, value] of orderMap) {
                        if (value.isOn === false && value.bilaterType === orderMap.get(index).bilaterType) {
                            value.log.info("==============worker" + key);
                            order = value;
                            break;
                        }
                    }
                } else if (balances.A[1] > config.orderOptions.amount * config.orderOptions.maxPrice && balances.B[0] > config.orderOptions.amount && orderMap.get(index).bilaterType === 1) { //能搬到A
                    for (let [key, value] of orderMap) {
                        if (value.isOn === false && value.bilaterType === orderMap.get(index).bilaterType) {
                            value.log.info("==============worker" + key);
                            order = value;
                            break;
                        }
                    }
                } else if (balances.B[1] > config.orderOptions.amount * config.orderOptions.maxPrice && balances.A[0] > config.orderOptions.amount && orderMap.get(index).bilaterType === 2) { //能搬到B
                    for (let [key, value] of orderMap) {
                        if (value.isOn === false && value.bilaterType === orderMap.get(index).bilaterType) {
                            value.log.info("==============worker" + key);
                            order = value;
                            break;
                        }
                    }
                }

                if (order) {
                    balancesCompute(order);
                    order.init();
                    order.isOn = true;
                }

            }, 15000);
        }

    });
    event.on('woker_end', (index, type) => {  //type  0 第一个订单被撤销   1 搬砖结束    2 放弃
        orderMap.get(index).log.info('woker_end' + index + "_" + type);
        if (orderMap.get(index).timeoutObj) {
            clearTimeout(orderMap.get(index).timeoutObj);
            orderMap.get(index).timeoutObj = null;
        }

        if (type == 2) {
            dropNum++;
            // if (dropNum > (config.orderOptions.normal + config.orderOptions.toA + config.orderOptions.toB)) {  //如果连续被抛弃的单数大于总worker数 则结束进程
            //     cancelOrders();
            //     setTimeout(() => {
            //         exec(str, function (err, stdout, stderr) {
            //             if (err) {
            //                 console.log('error:' + stderr)
            //             } else {
            //                 console.log(stdout)
            //                 console.log(stderr)
            //             }
            //         });
            //     }, 5000);
            // }
        } else if (type == 1) {
            dropNum = 0;
        }

        let obj = orderMap.get(index).balances;
        balances.A[0] += obj.A[0];
        balances.A[1] += obj.A[1];
        balances.B[0] += obj.B[0];
        balances.B[1] += obj.B[1];

        orderMap.get(index).isOn = false;

        if(dropNum > 0 && !(isOver(0) && isOver(1) && isOver(2))){
            return;
        }

        if (balances.A[0] > config.orderOptions.amount &&
            balances.B[0] > config.orderOptions.amount &&
            balances.A[1] > config.orderOptions.amount * config.orderOptions.maxPrice &&
            balances.B[1] > config.orderOptions.amount * config.orderOptions.maxPrice) { //两边都能搬
            if (isOver(orderMap, 0) === true) {//目前没有正常的worker
                for (let [key, value] of orderMap) {
                    if (value.isOn === false && value.bilaterType === 0) {
                        value.log.info("==============worker" + key);
                        balancesCompute(value);
                        value.init();
                        value.isOn = true;
                        break;
                    }
                }
            }
        }

        if (balances.A[1] > config.orderOptions.amount * config.orderOptions.maxPrice && balances.B[0] > config.orderOptions.amount) { //能搬到A

            if (isOver(orderMap, 1) === true) {//目前没有搬到A的worker
                for (let [key, value] of orderMap) {
                    if (value.isOn === false && value.bilaterType === 1) {
                        value.log.info("==============worker" + key);
                        balancesCompute(value);
                        value.init();
                        value.isOn = true;
                        break;
                    }
                }
            }

        }

        if (balances.B[1] > config.orderOptions.amount * config.orderOptions.maxPrice && balances.A[0] > config.orderOptions.amount) { //能搬到B
            if (isOver(orderMap, 2) === true) { //目前没有搬到B的worker
                for (let [key, value] of orderMap) {
                    if (value.isOn === false && value.bilaterType === 2) {
                        value.log.info("==============worker" + key);
                        balancesCompute(value);
                        value.init();
                        value.isOn = true;
                        break;
                    }
                }
            }

        }
    });

    orderMap.get(0).log.info('==========balances==========');
    orderMap.get(0).log.info(balances);
    orderMap.get(0).log.info('==========balances==========');
}

function balancesCompute(worker) {
    let obj = {
        B: [0, 0],
        A: [0, 0]
    };
    if (worker.bilaterType == 0) {
        obj = {
            B: [config.orderOptions.amount, config.orderOptions.amount * config.orderOptions.maxPrice],
            A: [config.orderOptions.amount, config.orderOptions.amount * config.orderOptions.maxPrice]
        };
    } else if (worker.bilaterType == 1) {
        obj = {
            B: [config.orderOptions.amount, 0],
            A: [0, config.orderOptions.amount * config.orderOptions.maxPrice]
        };
    } else if (worker.bilaterType == 2) {
        obj = {
            B: [0, config.orderOptions.amount * config.orderOptions.maxPrice],
            A: [config.orderOptions.amount, 0]
        };
    }

    balances.A[0] -= obj.A[0];
    balances.A[1] -= obj.A[1];
    balances.B[0] -= obj.B[0];
    balances.B[1] -= obj.B[1];
}

function isOver(orderMap, type) {
    for (let [key, value] of orderMap) {
        if (value.isOn === true && value.bilaterType === type) {
            return false;
        }
    }
    return true;
}

function cancelOrders() {
    console.log("cancelOrders");
    for (let [key, value] of orderMap) {
        value.isOn = false;
        value.exit();
    }
}

function waitOver() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve("结束进程")
        }, 8000);
    })
}


async function exit() {
    cancelOrders();
    let result = await waitOver();
    if (!!result) {
        console.log(result);
        process.exit(0);
    }
}


//全局异常
process.on('uncaughtException', function (err) {
    console.log(err.stack);
});

process.on('SIGINT', function () {
    exit();
});

main();


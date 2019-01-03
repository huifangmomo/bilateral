'use strict';

const params = process.argv.slice(2); //一个交易对数组 [ 'eos', 'eth',"0.01" ]
const fs = require('fs');
const EventEmitter = require('events').EventEmitter;
const A = require("./class/huobi");
const B = require("./class/okex");
const Order = require('./class/order');
const ComConsumer = require('./class/comConsumer');

const tradeString = params[0] +'/'+ params[1];

const config = JSON.parse(fs.readFileSync(__dirname + '/config/config.json'));

let balances = config.balance;

function main() {
    let event = new EventEmitter();

    // const order = new Order(tradeString,params[2],0,event);
    let orderMap = new Map();

    for( let i = 0;i<config.orderOptions.normal;i++){
        let order = new Order(tradeString,params[2],i,config,0,event);
        order.isOn = false;
        if(i===0){
            order.isOn = true;
        }
        orderMap.set(i,order)
    }

    for( let i = 0;i<config.orderOptions.toA;i++){
        let index = i+config.orderOptions.normal;
        let order = new Order(tradeString,params[2],index,config,1,event);
        order.isOn = false;
        if(i===0){
            order.isOn = true;
        }
        orderMap.set(i+config.orderOptions.normal,order)
    }

    for( let i = 0;i<config.orderOptions.toB;i++){
        let index = i+config.orderOptions.normal+config.orderOptions.toA;
        let order = new Order(tradeString,params[2],index,config,2,event);
        order.isOn = false;
        if(i===0){
            order.isOn = true;
        }
        orderMap.set(index,order)
    }

    let topics = config.topics;
    topics.push({ "topic": "depth_"+config.A.name+"_" + params[0]+params[1], "partition": 0 });
    topics.push({ "topic": "depth_"+config.B.name+"_" + params[0]+params[1], "partition": 0 });

    const comConsumer = new ComConsumer(event,config.KafkaClient,topics);
    let A_Depth = {};
    let B_Depth = {};

    const a = new A(null, config.A.AccessID, config.A.SecretKey,"5720120");
    const b = new B(null, config.B.AccessID, config.B.SecretKey);

    event.on('depth_update', message => {
        switch (message.topic) {
            case "depth_"+config.A.name+"_" + params[0]+params[1]:
                if(message == 3){
                    return;
                }
                A_Depth = JSON.parse(message.value).depth;
                break;

            case "depth_"+config.B.name+"_" + params[0]+params[1]:
                B_Depth = JSON.parse(message.value).depth;
                break;
        }
        if (A_Depth.bids && B_Depth.bids) {
            for (let [key, value] of orderMap) {
                if(value.isOn===true){
                    value.check(A_Depth,B_Depth,a,b)
                }
            }
        }

    });
    event.on('order_update', (orderStatus,orderInfo,topic) => {
        if(!orderInfo){
            return;
        }
        if(orderInfo.market.toUpperCase() != (params[0]+params[1])){
            return;
        }
        for (let [key, value] of orderMap) {
            if(value.isOn===true){
                if(parseInt(orderStatus)===1){
                    let market = "A";
                    if(topic===config.B.name){
                        market = "B";
                    }
                    balances[market][0] -= parseFloat(orderInfo.amount);
                    balances[market][1] -= parseFloat(orderInfo.price)*parseFloat(orderInfo.amount);
                }else if(parseInt(orderStatus)===3 ){
                    if((orderInfo.deal_money === 0 || orderInfo.deal_money === '0')){
                        let market = "A";
                        if(topic===config.B.name){
                            market = "B";
                        }
                        balances[market][0] += parseFloat(orderInfo.amount);
                        balances[market][1] += parseFloat(orderInfo.price)*parseFloat(orderInfo.amount);
                    }else {
                        let market = "A";
                        let p = 1;
                        if(topic===config.B.name){
                            market = "B";
                        }
                        if(parseInt(orderInfo.side)===1){ //卖出
                            p = -1;
                        }
                        balances[market][0] += parseFloat(orderInfo.amount)*p;
                        balances[market][1] -= parseFloat(orderInfo.price)*parseFloat(orderInfo.amount)*p;
                    }

                }
                value.order_update(orderStatus,orderInfo)
            }
        }
    });
    event.on('woker_start',index => {
        console.log('woker_start'+index);
        orderMap.get(index).timeoutObj = setTimeout(() => {
            for (let [key, value] of orderMap) {
                if(value.isOn===false && value.bilaterType === orderMap.get(index).bilaterType ){
                    value.isOn = true;
                    console.log("==============worker"+key);
                    break;
                }
            }
        }, 15000);

    });
    event.on('woker_end',(index,type) => {
        console.log('woker_end'+index+"_"+type);
        if(orderMap.get(index).timeoutObj){
            clearTimeout(orderMap.get(index).timeoutObj);
            orderMap.get(index).timeoutObj = null;
        }
        if(orderMap.get(index).isOn===true){
            if(balances.A[0]>config.orderOptions.amount &&
                balances.B[0]>config.orderOptions.amount &&
                balances.A[1]>config.orderOptions.amount*0.003 &&
                balances.B[1]>config.orderOptions.amount*0.003){
                orderMap.get(index).init();
            }else{
                orderMap.get(index).isOn = false;
            }
        }
    });

}

//全局异常
process.on('uncaughtException', function (err) {
    console.log(err.stack);
});

main();


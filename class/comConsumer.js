'use strict';
const kafka = require('kafka-node');
const Consumer = kafka.Consumer;
let Offset = kafka.Offset;
let log = console.log
class ComConsumer {
    //构造函数
    constructor(event, kafkaParams, topics) {
        this.kafkaParams = kafkaParams
        this.event = event
        this.topics = topics
        this.createKafkaClient()
    }
    //封装获取最新的offset
    getLatestOffset(){
        return new Promise((resolve, reject) => {
            let offset = new Offset(this.client);
            let topicsList=[];
            this.topics.forEach((item,index)=>{
                topicsList.push(item.topic)
            })
            offset.fetchLatestOffsets(topicsList,(err,data)=>{
                if(!!err){
                    resolve(null,err)
                }else{
                    resolve(data)
                }
            });
        })
    }
    //创建连接
    async createKafkaClient() {
        this.client = new kafka.KafkaClient(this.kafkaParams);
        this.options = { autoCommit: true, fetchMaxWaitMs: 1000, fetchMaxBytes: 1024 * 1024 ,fromOffset:true};
        this.consumer = new Consumer(this.client, this.topics, this.options);
        let latestOffset = await this.getLatestOffset();
        if(!!latestOffset){
            //遍历topics
            this.topics.forEach((item,index)=>{
                let topicName = item.topic
                // console.log(latestOffset[topicName]['0'])
                this.consumer.setOffset(topicName,0,latestOffset[topicName]['0'])
            })
        }

        try {
            this.initEventHandle();
        } catch (e) {
            console.log(e)
            this.reconnect()
        }
    }
    //kafka事件捕获
    initEventHandle() {

        this.consumer.on('message', message=> {
            let topicType = message.topic.split("_")[0]
            if(topicType=="depth"){
                // let askArray = JSON.parse(message.value).depth.asks;
                // let bidArray = JSON.parse(message.value).depth.bids;
                // let data = {};
                // data.topic = message.topic;
                // data.asks = [];
                // data.bids = [];
                // askArray.forEach((item,index)=>{
                //     data.asks.push(parseFloat(Object.keys(item)[0]))
                // });
                // bidArray.forEach((item,index)=>{
                //     data.bids.push(parseFloat(Object.keys(item)[0]))
                // });
                this.event.emit('depth_update',message)
            }
            if(topicType=="order"){
                console.log(message);

                let orderStatus = JSON.parse(message.value).orderStatus
                let orderInfo = JSON.parse(message.value).orderInfo
                this.event.emit('order_update',orderStatus,orderInfo)

            }

        });

        this.consumer.on('error', function (err) {
            console.log('error', err);
        });

    }
    //断线重连
    reconnect() {
        if (!!this.lockReconnect)
            return
        this.lockReconnect = true //没连接上会一直重连，设置延迟避免请求过多
        setTimeout(() => {
            this.createKafkaClient(this.consumer)
            this.lockReconnect = false
        }, 1000)
    }
}
module.exports = ComConsumer


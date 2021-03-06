const fs = require('fs');
const mysql = require('mysql')
const moment = require('moment')
const A = require("./class/okex");
const B = require("./class/huobi");
const config = JSON.parse(fs.readFileSync(__dirname + '/config/config.json'));
const a = new A(null, config.A.AccessID, config.A.SecretKey,"5720120");
const b = new B(null, config.B.AccessID, config.B.SecretKey,"5720120");
const DB = require('./class/db');
let db = new DB();
class UpdataDB {
    constructor(time) {
        console.log(time.getTime());
        this.connection = this.initConnection();
        this.init();
    }

    init(){
        // this.connection.query("SELECT * FROM tbl_bilateral where profit = -2 or profit is NULL;", (err, data)=>{ //还没有收益的订单
        //     if(err)
        //         console.log('出错了', err);
        //     else{
        //         console.log('成功了');
        //         console.log(data);
        //         this.getOrdersInfo(data);
        //     }
        //
        // });
    }

    upDataUnknow() {
        this.connection.query("SELECT * FROM tbl_bilateral where orderStatus = 0 or orderStatus = 2;", (err, data)=>{ //还没有收益的订单
            if(err)
                console.log('出错了', err);
            else{
                console.log('成功了');
                console.log(data);
                this.getOrdersInfo(data,0);
            }

        });
    }

    upDataHalf() {
        this.connection.query("SELECT * FROM tbl_bilateral where orderStatus = 3;", (err, data)=>{ //还没有收益的订单
            if(err)
                console.log('出错了', err);
            else{
                console.log('成功了');
                console.log(data);
                this.getOrdersInfo(data,1);
            }

        });
    }

    upDataAll(){
        this.connection.query("SELECT * FROM tbl_bilateral where startTime between '2019-01-09' and '2019-01-13';", (err, data)=>{ //还没有收益的订单
            if(err)
                console.log('出错了', err);
            else{
                console.log('成功了');
                console.log(data);
                this.getAllOrdersInfo(data);
            }

        });
    }

    async getAllOrdersInfo(data){
        for (let i=0; i<data.length;i++) {
            let buyPrice = 0;
            let sellPrice = 0;
            let resultA = await a.getOrderInfo({
                market: data[i].marketKey,
                id:data[i].orderA
            });
            if(!!resultA){
                if(!!resultA.data){
                    resultA = resultA.data;
                }
                if((resultA.type).split('-')[0]=='buy'){
                    buyPrice = resultA.price;
                }
                if((resultA.type).split('-')[0]=='sell'){
                    sellPrice = resultA.price;
                }
            }else{
                resultA = await this.executeSql("SELECT * FROM tbl_deal where orderId = "+data[i].orderA+";");
                resultA = resultA[0];
                if(resultA.orderType=='buy'){
                    buyPrice = resultA.price;
                }
                if(resultA.orderType=='sell'){
                    sellPrice = resultA.price;
                }
            }

            if(!!data[i].orderB){ //有订单B
                let resultB = await b.getOrderInfo({
                    market: data[i].marketKey,
                    id:data[i].orderB
                });
                if(!!resultB){//订单B有结果
                    if(!!resultB.data){
                        resultB = resultB.data;
                    }

                    if((resultB.type).split('-')[0]=='buy'){
                        buyPrice = resultB.price;
                    }
                    if((resultB.type).split('-')[0]=='sell'){
                        sellPrice = resultB.price;
                    }
                    db.updateBuyPrice({id:data[i].id,buyPrice:''+buyPrice});
                    db.updateSellPrice({id:data[i].id,sellPrice:''+sellPrice});
                    if(resultB.status == "done"){
                        let value = (this.profitCompute(buyPrice,sellPrice,parseFloat(data[i].amount)));
                        db.saveBilateral({id:data[i].id,orderB:''+resultB.id,profit:value.profit});
                        db.updateCharge({id:data[i].id,charge:value.charge});
                        // db.saveDeal({orderId:''+resultB.id,
                        //     market:'huobi',
                        //     marketKey:data[i].marketKey,
                        //     orderType:(resultB.type).split('-')[0],
                        //     price:''+resultB.price,
                        //     bilateralId:data[i].id,
                        //     amount:data[i].amount});
                        db.updateStatus({id:data[i].id,orderStatus:1})
                    }

                    if(resultB.status == "canceled") {
                        db.updateCharge({id:data[i].id,charge:parseFloat(data[i].amount)*parseFloat(''+sellPrice)*config.orderOptions.feeA});
                        db.updateProfit({id:data[i].id,profit:0});
                        db.updateStatus({id:data[i].id,orderStatus:-1});
                    }

                    if(resultB.status == "part_deal") {
                        db.updateCharge({id:data[i].id,charge:parseFloat(data[i].amount)*parseFloat(''+sellPrice)*config.orderOptions.feeA});
                        db.updateProfit({id:data[i].id,profit:0});
                        db.updateStatus({id:data[i].id,orderStatus:3});
                    }
                }else{ //订单B没查到
                    db.updateStatus({id:data[i].id,orderStatus:0});
                    db.updateProfit({id:data[i].id,profit:0});
                }
            }else{//没有订单B
                db.updateStatus({id:data[i].id,orderStatus:0});
                db.updateProfit({id:data[i].id,profit:0});
            }
        }
    }

    async getOrdersInfo(data,type){
        for (let i=0; i<data.length;i++) {
            let buyPrice = 0;
            let sellPrice = 0;
            let resultA = await a.getOrderInfo({
                market: data[i].marketKey,
                id:data[i].orderA
            });
            console.log("***********************************"+i)
            console.log(resultA);
            console.log("startTime"+data[i].startTime);
            console.log("***********************************")
            if(!!resultA){
                if(!!resultA.data){
                    resultA = resultA.data;
                }
                if((resultA.type).split('-')[0]=='buy'){
                    buyPrice = resultA.price;
                }
                if((resultA.type).split('-')[0]=='sell'){
                    sellPrice = resultA.price;
                }
            }

            if(!!data[i].orderB){ //有订单B
                let resultB = await b.getOrderInfo({
                    market: data[i].marketKey,
                    id:data[i].orderB
                });
                console.log("================================"+i)
                console.log(resultB);
                console.log("startTime"+data[i].startTime);
                console.log("================================")
                if(!!resultB){//订单B有结果
                    if(!!resultB.data){
                        resultB = resultB.data;
                    }
                    if((resultB.type).split('-')[0]=='buy'){
                        buyPrice = resultB.price;
                    }
                    if((resultB.type).split('-')[0]=='sell'){
                        sellPrice = resultB.price;
                    }
                    db.updateBuyPrice({id:data[i].id,buyPrice:''+buyPrice});
                    db.updateSellPrice({id:data[i].id,sellPrice:''+sellPrice});
                    if(resultB.status == "done"){
                        let value = (this.profitCompute(buyPrice,sellPrice,parseFloat(''+resultB.deal_money)));
                        db.saveBilateral({id:data[i].id,orderB:''+resultB.id,profit:value.profit});
                        let addFee = parseFloat(''+data[i].amount)*parseFloat(''+sellPrice)*config.orderOptions.feeA+
                            parseFloat(''+resultB.deal_amount)*parseFloat(''+sellPrice)*config.orderOptions.feeB;
                        db.updateCharge({id:data[i].id,charge:addFee});
                        if(type==0){
                            db.saveDeal({orderId:''+resultB.id,
                                market:'huobi',
                                marketKey:data[i].marketKey,
                                orderType:(resultB.type).split('-')[0],
                                price:''+resultB.price,
                                bilateralId:data[i].id,
                                amount:data[i].amount});
                        }

                        if(parseFloat(''+resultB.deal_money)==0){  //被取消 需要补单
                            db.updateStatus({id:data[i].id,orderStatus:-1});
                        }else if(parseFloat(''+resultB.deal_money)==parseFloat(''+data[i].amount)){  //完全成交
                            db.updateStatus({id:data[i].id,orderStatus:1});
                        }else { //成交部分被取消  ,需要补单
                            db.updateStatus({id:data[i].id,orderStatus:-1});
                        }
                    }

                    if(resultB.status == "part_deal") { //成交部分 正挂着
                        db.updateCharge({id:data[i].id,charge:parseFloat(data[i].amount)*parseFloat(''+sellPrice)*config.orderOptions.feeA});
                        db.updateProfit({id:data[i].id,profit:0});
                        db.updateStatus({id:data[i].id,orderStatus:3});
                    }
                }else{ //订单B没查到
                    if(new Date().getTime() - data[i].startTime.getTime()>60*1000 && resultA.status == 'done'){  //第一单完成（完成成交或者部分成交被取消或者被取消）
                        let price = sellPrice;
                        if(sellPrice==0){
                            price = buyPrice+0.000001
                        }
                        db.updateCharge({id:data[i].id,charge:parseFloat(''+resultA.deal_amount)*parseFloat(''+price)*config.orderOptions.feeA});
                        db.updateStatus({id:data[i].id,orderStatus:-1});
                        db.updateProfit({id:data[i].id,profit:0});
                    }
                }
            }else{//没有订单B
                if(!!resultA){
                    if(new Date().getTime() - data[i].startTime.getTime()>60*1000 && resultA.status == 'done'){  //第一单完成（完成成交或者部分成交被取消或者被取消）
                        let price = sellPrice;
                        if(sellPrice==0){
                            price = buyPrice+0.000001
                        }
                        db.updateCharge({id:data[i].id,charge:parseFloat(''+resultA.deal_amount)*parseFloat(''+price)*config.orderOptions.feeA});
                        db.updateStatus({id:data[i].id,orderStatus:-1});
                        db.updateProfit({id:data[i].id,profit:0});
                    }else { //订单还挂着呢
                        db.updateStatus({id:data[i].id,orderStatus:-1});
                        db.updateProfit({id:data[i].id,profit:0});
                    }
                }else{
                    let price = data[i].sellPrice;
                    if(sellPrice==0){
                        price = data[i].buyPrice+0.000001
                    }
                    db.updateCharge({id:data[i].id,charge:parseFloat(''+data[i].amount)*parseFloat(''+price)*config.orderOptions.feeA});
                    db.updateStatus({id:data[i].id,orderStatus:-1});
                    db.updateProfit({id:data[i].id,profit:0});
                }
            }
        }
    }

    profitCompute(buyPrice,sellPrice,num){
        const profit = (parseFloat(sellPrice)-parseFloat(buyPrice))*num;
        const charge =  num*(config.orderOptions.feeA+config.orderOptions.feeB)*parseFloat(sellPrice);
        return {profit:profit,charge:charge}
    }

    initConnection() {
        //使用mysql连接池
        let connection = mysql.createPool({
            connectionLimit: 10,
            host: "rm-bp16kw7mmmo4t10do9o.mysql.rds.aliyuncs.com",
            user: "root",
            password: "Ljb139586",
            database: "bilateral"
        });
        return connection
    }

    executeSql(sql) {
        let connection = this.connection;
        return new Promise((resolve, reject) => {
            connection.query(sql, function (err, res) {
                if (!!err) {
                    console.log(err)
                    resolve(null,err)
                } else {
                    resolve(res)
                }
            })
        })
    }


}
module.exports = UpdataDB;


const updataDB = new UpdataDB(new Date());
updataDB.upDataUnknow();

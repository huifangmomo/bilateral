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
class StopLoss {
    constructor(time) {
        console.log(time.getTime());
        this.connection = this.initConnection();
        this.init();
    }

    init(){

        this.connection.query("SELECT * FROM tbl_bilateral where charge is NULL;", (err, data)=>{ //还没有收益的订单
            if(err)
                console.log('出错了', err);
            else{
                console.log('成功了');
                console.log(data);
                this.getOrdersInfo(data);
            }

        });
        //
//         this.connection.query("SELECT * FROM tbl_bilateral where profit = -1;", (err, data)=>{ //还没有收益的订单
//             if(err)
//                 console.log('出错了', err);
//             else{
//                 console.log('成功了');
//                 console.log(data);
//                 this.getOrdersInfo(data);
//             }
//        
//         });
    }



    profitCompute(buyPrice,sellPrice,num){
        const profit = (parseFloat(sellPrice)-parseFloat(buyPrice))*num;
        const charge =  num*(0.00052+0.000195)*parseFloat(sellPrice);
        return {profit:profit,charge:charge}
    }


    async getOrdersInfo(data){
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
            }

            if(!!data[i].orderB){
                let resultB = await b.getOrderInfo({
                    market: data[i].marketKey,
                    id:data[i].orderB
                });
                if(!!resultB){
                    if(!!resultB.data){
                        resultB = resultB.data;
                    }
                    if((resultB.type).split('-')[0]=='buy'){
                        buyPrice = resultB.price;
                        db.updateBuyPrice({id:data[i].id,buyPrice:''+buyPrice});
                    }
                    if((resultB.type).split('-')[0]=='sell'){
                        sellPrice = resultB.price;
                        db.updateSellPrice({id:data[i].id,sellPrice:''+sellPrice});
                    }
                    if(resultB.state == "done" || resultB.state == "filled"){
                        let value = (this.profitCompute(buyPrice,sellPrice,parseFloat(data[i].amount)));
                        db.saveBilateral({id:data[i].id,orderB:''+resultB.id,profit:value.profit,charge:value.charge});
                        db.saveDeal({orderId:''+resultB.id,
                            market:'huobi',
                            marketKey:data[i].marketKey,
                            orderType:(resultB.type).split('-')[0],
                            price:''+resultB.price,
                            bilateralId:data[i].id,
                            amount:data[i].amount});
                    }
                }
            }
        }
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


}
module.exports = StopLoss;


const stopLoss = new StopLoss(new Date());

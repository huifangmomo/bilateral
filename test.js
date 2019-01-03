'use strict';
// const fs = require('fs');
// const CoinEx = require("./class/coinex");
// const HuoBi = require("./class/huobi");
//
// const config = JSON.parse(fs.readFileSync(__dirname + '/config/config.json'));

// const coinex = new CoinEx(null, config.A.AccessID, config.A.SecretKey);
// const huobi = new HuoBi(null, "a0abfc0b-55125de2-ed3f1aff-abedb", "f6041f13-29ceed20-c2bc80fd-02224","5720120");
//
// async function getInfo(){
//     let A_B = await coinex.getOrderInfo({
//         market: 'XRPBTC',
//         id:2980963410
//     })
//
//     console.log(A_B)
//
// }
//
// getInfo();
// console.log(huobi)
// huobi.limitOrder({
//     market: "NEO/BTC",
//     type: "buy",
//     price: 0.002020 + "",
//     amount: 0.1+""
// }).then(limitOrderResult=>{
//     if(!!limitOrderResult){
//         console.log(limitOrderResult);
//         // this.status = "pending";
//         // this.orderList[0].info = limitOrderResult.data;
//     }else{
//         console.log(limitOrderResult);
//     }
// });

// huobi.get_balance().then(result => {
//         console.log(result);
//     }
// );



// let UUID = require('uuid');
// const DB = require('./class/db');
// let db = new DB();
// db.insertOrgin({id:UUID.v1(),marketKey:'xrpbtc',orderA:'24689975434',amount:'1'});
// db.updateBilateral({id:'1e350280-0a76-11e9-917e-ad293fdea87d',orderB:'rtyuioougrer'});
// db.saveBilateral({id:'1e350280-0a76-11e9-917e-ad293fdea87d',orderB:'6899433',profit:0.00005477,charge:0.00008532});
// db.saveDeal({orderId:'6899433',market:'huobi',marketKey:'xrpbtc',orderType:'buy',price:'0.00009753',bilateralId:'50520f30-0a74-11e9-bdb5-4d63199a08f1',amount:'1'});


// function profitCompute(buyPrice,sellPrice,num){
//     const profit = (parseFloat(sellPrice)-parseFloat(buyPrice))*num;
//     const charge =  num*(0.0004+0.00052)*parseFloat(sellPrice);
//     return {profit:profit,charge:charge}
// }
//
// var data = (profitCompute(0.00009521,0.00009543,1));
// console.log(data.profit.toFixed(8));
// console.log(data.charge.toFixed(8));

// const mysql = require('mysql')
// const moment = require('moment')
// function initConnection() {
//     //使用mysql连接池
//     let connection = mysql.createPool({
//         connectionLimit: 10,
//         host: "rm-bp16kw7mmmo4t10do9o.mysql.rds.aliyuncs.com",
//         user: "root",
//         password: "Ljb139586",
//         database: "bilateral"
//     })
//     return connection
// }
//
// const connection = initConnection();
// connection.query('select * from tbl_bilateral where profit > 0.00000023;', function (err, res) {
//     if (!!err) {
//         console.log(err)
//     } else {
//         console.log(res)
//     }
// })

let s = 0.000088
//let len=s.split('.')[1].length;
console.log(s.toFixed(5))


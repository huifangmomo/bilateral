'use strict';
const fs = require('fs');
const B = require("./class/huobi");
const A = require("./class/okex");
const DB = require('./class/db');
let db = new DB();

const config = JSON.parse(fs.readFileSync(__dirname + '/config/config.json'));

const a = new A(null, config.A.AccessID, config.A.SecretKey,"5720120");
const b = new B(null, config.B.AccessID, config.B.SecretKey,"5720120");

async function getInfo(){
    let A_B = await b.getOrderInfo({
        market: 'NEO/BTC',
        id:22052184290
    })

    console.log(A_B)

}

getInfo();
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
//     const charge =  num*(0.00052+0.000195)*parseFloat(sellPrice);
//     return {profit:profit,charge:charge}
// }
//
// var data = (profitCompute('0.00230501','0.0023070',0.1));
// console.log(data.profit.toFixed(13));
// console.log(data.charge.toFixed(13));

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
//
// let s = 0.00001111111111
// //let len=s.split('.')[1].length;
// console.log(Math.ceil(s*Math.pow(10,8))/Math.pow(10,8))

// if(parseFloat('0.00600')==parseFloat("0.006")){
//     console.log(true)
// }

// let a = null;
// console.log(!a)

console.log(("sell").split('-')[0])

const fs = require('fs');
const mysql = require('mysql')
const moment = require('moment')
const A = require("./class/okex");
const B = require("./class/huobi");
const config = JSON.parse(fs.readFileSync(__dirname + '/config/config.json'));

class StopLoss {
    constructor(time) {
        console.log(time.getTime());
        this.connection = this.initConnection();
        this.init();
    }

    init(){
        this.connection.query("SELECT * FROM `tbl_bilateral`;", (err, data)=>{
            if(err)
                console.log('出错了', err);
            else{
                console.log('成功了');
                console.log(JSON.stringify(data));
                for (let i=0; i<data.length;i++) {
                    console.log(data[i].startTime.getTime());
                }
            }
        });

        // this.connection.query("SELECT * FROM tbl_bilateral where profit is NULL;", (err, data)=>{ //还没有收益的订单
        //     if(err)
        //         console.log('出错了', err);
        //     else{
        //         console.log('成功了');
        //         console.log(JSON.stringify(data));
        //         for (let i=0; i<data.length;i++) {
        //             if(!data[i].orderB){ //没有订单二
        //
        //             }
        //         }
        //     }
        //
        // });
        //
        // this.connection.query("SELECT * FROM tbl_bilateral where profit < 0;", (err, data)=>{ //还没有收益的订单
        //     if(err)
        //         console.log('出错了', err);
        //     else{
        //         console.log('成功了');
        //         console.log(JSON.stringify(data));
        //         for (let i=0; i<data.length;i++) {
        //
        //         }
        //     }
        //
        // });
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

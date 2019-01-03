const mysql = require('mysql')
const moment = require('moment')

class db {
    constructor() {
        this.connection = this.initConnection();
        this.sqlQueue = new Set()
    }

    initConnection() {
        //使用mysql连接池
        let connection = mysql.createPool({
            connectionLimit: 10,
            host: "127.0.0.1", // "rm-bp16kw7mmmo4t10do9o.mysql.rds.aliyuncs.com",
            user: "root",
            password: "snipeglee",
            database: "cetpool"
        })
        return connection
    }

    end() {
        this.connection.end()
    }

    //存储起始订单
    saveOrgin(data) {
        let sql = "insert into tbl_triangle(id,A,B,F,amountA,orderA,starttime) values(?,?,?,?,?,?,?)"
        let params = [data.id,data.A, data.B, data.F, data.amountA, data.orderA, moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')];
        this.sqlQueue.add(mysql.format(sql,params))
    }

    //存储订单
    saveDeal(data) {
        let sql = "insert into tbl_deal(orderId,market,triangleId) values(?,?,?)";
        let params = [data.orderId, data.market,data.triangleId];
        this.sqlQueue.add(mysql.format(sql,params))
    }
    //遍历set中的sql语句并执行
    async executeSqlQueue(){
        for (let item of this.executeSqlQueue().keys()){
            let executeResult = await this.executeSql(item)
            if(!!executeResult){
                this.executeSqlQueue().delete(item)
            }
        }
    }
    //执行sql函数
    executeSql(sql) {
        let connection = this.connection
        return new Promise((resolve, reject) => {
            connection.query(sql, function (err, res) {
                if (!!err) {
                    resolve(null,err)
                } else {
                    if(res.affectedRows===1){
                        resolve(res)
                    }else{
                        resolve(null)
                    }
                }
            })
        })
    }
}
module.exports = db;

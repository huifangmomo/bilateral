const mysql = require('mysql')
const moment = require('moment')

class db {
    constructor() {
        this.connection = this.initConnection();
        this.sqlQueue = new Set()
        this.timeoutObj = setInterval(() => {
            if(this.sqlQueue.size!=0){
                clearInterval(this.timeoutObj);
                this.timeoutObj = null;
                this.executeSqlQueue();
            }
        }, 1000);
    }

    initConnection() {
        //使用mysql连接池
        let connection = mysql.createPool({
            connectionLimit: 10,
            host: "rm-bp16kw7mmmo4t10do9o.mysql.rds.aliyuncs.com",
            user: "root",
            password: "Ljb139586",
            database: "bilateral"
        })
        return connection
    }

    end() {
        this.connection.end()
    }

    //存储起始订单
    insertOrgin(data) {
        let sql = "insert into tbl_bilateral(id,marketKey,orderA,amount,startTime) values(?,?,?,?,?)"
        let params = [data.id,data.marketKey, data.orderA, data.amount, moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')];
        this.sqlQueue.add(mysql.format(sql,params))
        // console.log(this.sqlQueue);
    }
    //更新buyPrice
    updateBuyPrice(data) {
        let sql = "update tbl_bilateral set buyPrice=? where id = ?";
        let params = [data.buyPrice,data.id];
        this.sqlQueue.add(mysql.format(sql,params))
        // console.log(this.sqlQueue);
    }
    //更新sellPrice
    updateSellPrice(data) {
        let sql = "update tbl_bilateral set sellPrice=? where id = ?";
        let params = [data.sellPrice,data.id];
        this.sqlQueue.add(mysql.format(sql,params))
        // console.log(this.sqlQueue);
    }

    //更新charge
    updateCharge(data) {
        let sql = "update tbl_bilateral set charge=? where id = ?";
        let params = [data.charge,data.id];
        this.sqlQueue.add(mysql.format(sql,params))
        // console.log(this.sqlQueue);
    }
    //profit
    updateProfit(data) {
        let sql = "update tbl_bilateral set profit=? where id = ?";
        let params = [data.profit,data.id];
        this.sqlQueue.add(mysql.format(sql,params))
        // console.log(this.sqlQueue);
    }
    //status
    updateStatus(data) {
        let sql = "update tbl_bilateral set orderStatus=? where id = ?";
        let params = [data.orderStatus,data.id];
        this.sqlQueue.add(mysql.format(sql,params))
        // console.log(this.sqlQueue);
    }
    //更新搬砖订单
    updateBilateral(data) {
        let sql = "update tbl_bilateral set orderB=? where id = ?";
        let params = [data.orderB,data.id];
        this.sqlQueue.add(mysql.format(sql,params))
        // console.log(this.sqlQueue);
    }
    //储存搬砖订单
    saveBilateral(data) {
        let sql = "update tbl_bilateral set orderB=?,profit=?,endTime=? where id = ?";
        let params = [data.orderB,data.profit,moment(Date.now()).format('YYYY-MM-DD HH:mm:ss'),data.id];
        this.sqlQueue.add(mysql.format(sql,params))
        // console.log(this.sqlQueue);
    }
    //存储订单
    saveDeal(data) {
        let sql = "insert into tbl_deal(orderId,market,marketKey,orderType,price,bilateralId,amount,saveTime) values(?,?,?,?,?,?,?,?)";
        let params = [data.orderId, data.market,data.marketKey,data.orderType,data.price,data.bilateralId,data.amount,moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')];
        this.sqlQueue.add(mysql.format(sql,params))
        // console.log(this.sqlQueue);
    }
    //遍历set中的sql语句并执行
    executeSqlQueue(){
        if(this.sqlQueue.size == 0){
            this.timeoutObj = setInterval(() => {
                if(this.sqlQueue.size!=0){
                    clearInterval(this.timeoutObj);
                    this.timeoutObj = null;
                    this.executeSqlQueue();
                }
            }, 1000);
        }else{
            for (let item of this.sqlQueue.keys()){
                console.log(item);
                this.executeSql(item).then(resolve => {
                    if(!!resolve){
                        this.sqlQueue.delete(item)
                    }
                    this.executeSqlQueue();
                });
                break;
            }
        }
    }
    //执行sql函数
    executeSql(sql) {
        let connection = this.connection
        return new Promise((resolve, reject) => {
            connection.query(sql, function (err, res) {
                if (!!err) {
                    console.log(err)
                    resolve(null,err)
                } else {
                    if(res.affectedRows==1){
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

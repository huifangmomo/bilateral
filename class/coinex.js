/**
 * CoinEx交易所API类
 */
const md5 = require('md5');
const TimeQueue = require('timequeue');
const HttpQueue = require('./httpqueue')
const request = require('request')

class CoinEx {
    //构造函数
    constructor(_proxy, _AccessID, _SecretKey) {
        //交易所通证
        this.proxy = _proxy
        this.AccessID = _AccessID
        this.SecretKey = _SecretKey
        this.networkqueue = new HttpQueue(this.worker.bind(this), {
            concurrency: 10,
            every: 1000,
            maxTasks: Infinity
        });
    }

    //网络消息队列工作
    worker(type, params, cb) {
        let self = this
        switch (type) {
            case 'limitOrder':
                self.limitOrder(params, cb)
                break;
            case 'cancelOrder':
                self.cancelOrder(params, cb)
                break;
            case 'getOrderInfo':
                self.getOrderInfo(params, cb)
                break;
            case 'marketOrder':
                self.marketOrder(params, cb)
                break;
            default:
                break;
        }
    }

    //限价单
    limitOrder(params) {
        return new Promise((resolve,reject)=>{
            let self = this
            let market = params.market.split('/')[0]+params.market.split('/')[1]
            let type = params.type
            let price = params.price
            let amount = params.amount
            let tonce = Date.now();
            var authorization = "access_id=" + self.AccessID + "&amount=" + amount + "&market=" + market + "&price=" + price + "&tonce=" + tonce + "&type=" + type + "&secret_key=" + self.SecretKey;
            authorization = md5(authorization).toUpperCase();
            var options = {
                url: 'https://api.coinex.com/v1/order/limit',
                method: 'POST',
                // timeout: 2000,
                headers: {
                    'AUTHORIZATION': authorization,
                    'Content-Type': 'application/json; charset=utf-8',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36'
                },
                body: JSON.stringify({
                    access_id: self.AccessID,
                    amount: amount + '',
                    market: market,
                    price: price,
                    tonce: parseInt(tonce),
                    type: type,
                })
            };
            if (!!self.proxy) {
                options.proxy = self.proxy
            }
            request(options, function (error, response, body) {
                try {
                    body = JSON.parse(body);
                    if (body.code == 0) {
                        console.log("limitOrderSuccess")
                        resolve(body)
                    } else {
                        // reject('limitOrderFail')
                        console.log("limitOrderFail")
                        console.log(body)
                        resolve(null)

                    }
                } catch (e) {
                    console.log("limitOrderERROR")

                    console.log(e)
                    resolve(null)
                }
            });
        })

    }

    //市价单
    marketOrder(params) {
        return new Promise((resolve,reject)=>{
            let self = this
            let market = params.market.split('/')[0]+params.market.split('/')[1]
            let amount = params.amount
            let type = params.type
            let tonce = Date.now();
            let authorization = "access_id=" + self.AccessID + "&amount=" + amount + "&market=" + market + "&tonce=" + tonce + "&type=" + type + "&secret_key=" + self.SecretKey;
            authorization = md5(authorization).toUpperCase();
            let options = {
                url: 'https://api.coinex.com/v1/order/market',
                method: 'POST',
                // timeout: 2000,
                headers: {
                    'AUTHORIZATION': authorization,
                    'Content-Type': 'application/json; charset=utf-8',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36'
                },
                body: JSON.stringify({
                    access_id: self.AccessID,
                    amount: amount + '',
                    market: market,
                    tonce: parseInt(tonce),
                    type: type,
                })
            };
            if (!!self.proxy) {
                options.proxy = self.proxy
            }
            request(options, function (error, response, body) {
                body = JSON.parse(body);
                if (body.code == 0) {
                    resolve(body)
                } else {
                    reject('marketOrderFail')
                }
            });
        })

    }

    //获取订单信息
    getOrderInfo(params) {
        return new Promise((resolve, reject) => {
            let self = this
            let tonce = Date.now()
            let market = params.market
            let id = params.id
            let authorization = "access_id=" + self.AccessID + "&id=" + id + "&market=" + market + "&tonce=" + tonce + "&secret_key=" + self.SecretKey
            let urladd = "access_id=" + self.AccessID + "&id=" + id + "&market=" + market + "&tonce=" + tonce
            authorization = md5(authorization).toUpperCase();
            let options = {
                url: 'https://api.coinex.com/v1/order/status?' + urladd,
                method: 'GET',
                // timeout: 500,
                headers: {
                    'AUTHORIZATION': authorization,
                    'Content-Type': 'application/json; charset=utf-8',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36'
                },
            };
            if (!!self.proxy) {
                options.proxy = self.proxy
            }
            request(options, function (error, response, body) {
                try {
                    body = JSON.parse(body)
                    if (body.code == 0) {
                        resolve(body)
                    } else {
                        // reject("getOrderInfoFail")
                        console.log("getOrderInfo fail")
                        console.log(body)
                        resolve(null)
                    }
                } catch (e) {
                    console.log("getOrderInfo error")
                    console.log(e)
                    resolve(null)

                }
            });
        })

    }

    //取消订单
    cancelOrder(params) {
        return new Promise((resolve, reject) => {
            let self = this
            let id = params.id
            let market = params.market;
            let tonce = Date.now();
            let authorization = "access_id=" + self.AccessID + "&id=" + id + "&market=" + market + "&tonce=" + tonce + "&secret_key=" + self.SecretKey;
            let urladd = "access_id=" + self.AccessID + "&id=" + id + "&market=" + market + "&tonce=" + tonce;
            authorization = md5(authorization).toUpperCase();
            let options = {
                url: 'https://api.coinex.com/v1/order/pending?' + urladd,
                method: 'DELETE',
                // timeout: 2000,
                headers: {
                    'AUTHORIZATION': authorization,
                    'Content-Type': 'application/json; charset=utf-8',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36'
                },
                fields: JSON.stringify({
                    id: parseInt(id),
                    market: market
                })
            };
            if (!!self.proxy) {
                options.proxy = self.proxy
            }
            request(options, function (error, response, body) {
                try {
                    body = JSON.parse(body);
                    if (parseInt(body.code) == 0) {
                        resolve(body)
                    } else {
                        console.log("cancelOrder fail")
                        console.log(body)
                        resolve(null)
                    }
                } catch (e) {
                    console.log("cancelOrder error")
                    console.log(e)
                    resolve(null)
                }
            });
        })
    }
    //查询余额
    balance() {
        return new Promise((resolve, reject) => {
            let self = this
            let options = {
                url: 'https://api.coinex.com/v1/balance?access_id=' + this.AccessID + "&tonce=" + Date.now(),
                method: 'GET',
                // timeout: 500,
                headers: {
                    'AUTHORIZATION': this.sign({
                        access_id: this.AccessID
                    }),
                    'Content-Type': 'application/json; charset=utf-8',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36'
                },
            };
            if (!!self.proxy) {
                options.proxy = self.proxy
            }
            request(options, function (error, response, body) {
                body = JSON.parse(body);
                resolve(body)
            });
        })

    }

    //API参数签名
    sign(signarr) {
        //判断是否需要加时间戳
        if (!!signarr.tonce == false)
            signarr.tonce = Date.now()
        //先排序后md5
        let keys = Object.keys(signarr).sort()
        for (let i in keys) {
            let key = keys[i]
            keys[i] = key + '=' + signarr[key]
        }
        //添加secretkey & 转化为大写
        keys.push('secret_key=' + this.SecretKey)
        return md5(keys.join('&')).toUpperCase()
    }
}
module.exports = CoinEx

/**
 * CoinEx交易所API类
 */
const md5 = require('md5');
const request = require('request')

class OKex {
    //构造函数
    constructor(_proxy, _AccessID, _SecretKey) {
        //交易所通证
        this.proxy = _proxy
        this.AccessID = _AccessID
        this.SecretKey = _SecretKey
        this.baseURL = 'https://www.okex.com/api/v1/'
    }
    //获取订单信息
    getOrderInfo(params) {
        return new Promise((resolve,reject)=>{
            let self = this
            let market = params.market.split('/')[0].toLowerCase()+'_'+params.market.split('/')[1].toLowerCase()
            let orderid = parseFloat(params.id)
            let pars = {
                order_id: orderid,
                api_key: this.AccessID,
                symbol: market,
            }
            Object.keys(pars)
            pars.sign = this.sign(this.SecretKey,pars)
            let options = {
                url: this.baseURL+'order_info.do',
                method: 'POST',
                headers: {
                    'content-type': 'application/x-www-form-urlencoded'
                    // 'Accept': 'application/json',
                },
                body: JSON.stringify(pars)
            };
            if (!!self.proxy) {
                options.proxy = self.proxy
            }
            request(options, function (error, response, body) {
                try {
                    body = JSON.parse(body);

                } catch (e) {
                    console.log("limitOrderERROR")
                    console.log(e)
                    resolve(null)
                }
            });
        })

    }
    //限价单 20次/2秒
    limitOrder(params) {
        return new Promise((resolve,reject)=>{
            let self = this
            let market = params.market.split('/')[0].toLowerCase()+'_'+params.market.split('/')[1].toLowerCase()
            let type = params.type
            let price = params.price
            let amount = params.amount
            let pars = {
                amount: amount,
                api_key: this.AccessID,
                price: price,
                symbol: market,
                type: type
            }
            pars.sign = this.sign(this.SecretKey,pars)
            let data = this.handleRequestData(pars)
            let options = {
                url: this.baseURL+'trade.do',
                method: 'POST',
                headers: {
                    'Content-type': 'application/x-www-form-urlencoded'
                },
                body: data
            };
            if (!!self.proxy) {
                options.proxy = self.proxy
            }
            request(options, (error, response, body)=>{
                try {
                    body = JSON.parse(body);
                    if(body.result){
                        let result = this.handleLimitOrderResult(pars,body.order_id)
                        resolve(result)
                    }else{
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
    handleLimitOrderResult(postBody,res){
        let result= {}
        let data = {}
        result.code=0
        data.id=res
        if(!!postBody.amount&&!!postBody.symbol&&!!postBody.type){
            data.amount=postBody.amount
            data.market=postBody.symbol.split('_')[0].toUpperCase()+postBody.symbol.split('_')[1].toUpperCase()
            data.price = postBody.price
            data.type = postBody.type
        }
        result.data=data
        return result
    }
    //API参数签名
    sign(secretKey,data) {
        let pars = [];
        //将参数值 encode
        for (let item in data) {
            pars.push(item + "=" + encodeURIComponent(data[item]));
        }
        let p = pars.sort();
        p.push("secret_key="+secretKey)
        let par = pars.join('&');
        return md5(par).toUpperCase()
    }
    //requestdata
    handleRequestData(params){
        let tempArr = [];
        //将参数值 encode
        for (let item in params) {
            tempArr.push(item + "=" + encodeURIComponent(params[item]));
        }
        let p = tempArr.sort();
        let par = p.join('&');
        return par
    }
    //取消订单
    cancelOrder(params) {
        return new Promise((resolve, reject) => {
            let self = this
            let id = params.id
            let market = params.market.split('/')[0].toLowerCase()+'_'+params.market.split('/')[1].toLowerCase()
            let pars = {
                api_key: this.AccessID,
                symbol: market,
                order_id: id
            }
            pars.sign = this.sign(this.SecretKey,pars)
            let data = this.handleRequestData(pars)
            let options = {
                url: this.baseURL+'cancel_order.do',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: data
            };
            if (!!self.proxy) {
                options.proxy = self.proxy
            }
            request(options, (error, response, body)=>{
                try {
                    body = JSON.parse(body);
                    if(body.result){
                        let result = this.handleLimitOrderResult(pars,body.order_id)
                        resolve(result)
                    }else{
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

}
module.exports = OKex

let CryptoJS = require('crypto-js');
let Promise = require('bluebird');
const HttpQueue = require('./httpqueue')
let moment = require('moment');
let HmacSHA256 = require('crypto-js/hmac-sha256')
let http = require('../framework/httpClient');
const URL_HUOBI_PRO = 'api.huobipro.com';
// const URL_HUOBI_PRO = 'api.huobi.pro'; //备用地址

const DEFAULT_HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36"
}

class Huobi {
    //构造函数
    constructor(_proxy, _AccessID, _SecretKey, _Account_id) {
        //交易所通证
        this.proxy = _proxy
        this.AccessID = _AccessID
        this.SecretKey = _SecretKey
        this.AccountId = _Account_id
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
    get_auth() {
        var sign = '';
        var md5 = CryptoJS.MD5(sign).toString().toLowerCase();
        let ret = encodeURIComponent(JSON.stringify({
            assetPwd: md5
        }));
        return ret;
    }
    sign_sha(method, baseurl, path, data) {
        var pars = [];
        for (let item in data) {
            pars.push(item + "=" + encodeURIComponent(data[item]));
        }
        var p = pars.sort().join("&");
        var meta = [method, baseurl, path, p].join('\n');
        var hash = HmacSHA256(meta, this.SecretKey);
        var osig = CryptoJS.enc.Base64.stringify(hash);
        var Signature = encodeURIComponent(osig);
        p += `&Signature=${Signature}`;
        return p;
    }
    get_body() {
        return {
            AccessKeyId: this.AccessID,
            SignatureMethod: "HmacSHA256",
            SignatureVersion: 2,
            Timestamp: moment.utc().format('YYYY-MM-DDTHH:mm:ss'),
        };
    }

    handleLimitOrderResult(postBody,res){
        let result= {}
        let data = {}
        if(res.status=="ok"){
            result.code=0
        }else{
            result.code=999
        }
        data.id=res.data
        if(!!postBody.amount&&!!postBody.symbol&&!!postBody.type){
            data.amount=postBody.amount
            data.market=postBody.symbol.toString().toUpperCase()
            data.price = postBody.price
            if(postBody.type == "sell-limit"){
                data.type = "sell"
            }else if(postBody.type == "buy-limit"){
                data.type = "buy"
            }
        }

        result.data=data
        return result
    }
    call_api(method, path, payload, body) {
        return new Promise(resolve => {
            let url = `https://${URL_HUOBI_PRO}${path}?${payload}`;
            let headers = DEFAULT_HEADERS;
            headers.AuthData = this.get_auth();
            if (method == 'GET') {
                http.get(url, {
                    timeout: 1000,
                    headers: headers
                }).then(data => {
                    let json = JSON.parse(data);
                    // console.log("================================")
                    // console.log(json)
                    // console.log("================================")
                    if (json.status == 'ok') {
                        let result = this.handleOrderInfo(json.data)
                        resolve(result);
                    } else {
                        console.log('调用错误', json);
                        resolve(null);
                    }
                }).catch(ex => {
                    console.log(method, path, '异常', ex);
                    resolve(null);
                });
            } else if (method == 'POST') {
                http.post(url, body, {
                    timeout: 1000,
                    headers: headers
                }).then(data => {
                    let json = JSON.parse(data);
                    if (json.status == 'ok') {
                        let result = this.handleLimitOrderResult(body,json)
                        resolve(result);
                    } else {
                        console.log('调用错误', json);
                        resolve(null);
                    }
                }).catch(ex => {
                    console.log(method, path, '异常', ex);
                    resolve(null);
                });
            }
        });
    }
    get_account() {
        let path = '/v1/account/accounts';
        let body = this.get_body();
        let payload = this.sign_sha('GET', URL_HUOBI_PRO, path, body);
        return this.call_api('GET', path, payload, body);
    }
    get_balance () {
        let account_id = this.AccountId;
        let path = `/v1/account/accounts/${account_id}/balance`;
        let body = this.get_body();
        let payload = this.sign_sha('GET', URL_HUOBI_PRO, path, body);
        return this.call_api('GET', path, payload, body);
    }
    get_order (order_id) {
        let path = `/v1/order/orders/${order_id}`;
        let body = this.get_body();
        let payload = this.sign_sha('GET', URL_HUOBI_PRO, path, body);
        return this.call_api('GET', path, payload, body);
    }
    handleOrderInfo(params){
        let result= {}
        let data = {}
        result.code=0
        data.amount=params.amount
        data.avg_price=params.price
        data.create_time=params['created-at']
        data.deal_amount=params['field-amount']
        data.deal_money=parseFloat(data.deal_amount)*parseFloat(data.avg_price)
        data.id=params.id
        data.left=parseFloat(data.amount)-parseFloat(data.deal_amount)
        data.market=params.symbol.toUpperCase()
        data.price = params.price
        if(params.state=='submitting'){
            data.status = params.status
        }else if(params.state=='submitted'){
            data.status = params.status
        }else if(params.state=='partial-filled'){
            data.status = 'part_deal'
        }else if(params.state=='partial-canceled'){
            data.status = 'part_deal'
        }else if(params.state=='filled'){
            data.status = 'done'
        }else if(params.state=='canceled'){
            data.status = 'canceled'
        }
        if(params.type=='buy-market'||params.type=='buy-limit'||params.type=='buy-ioc'){
            data.type = 'buy'
        }else if(params.type=='sell-market'||params.type=='sell-limit'||params.type=='sell-ioc'){
            data.type = 'sell'
        }
        result.data=data
        return result
    }
    buy_limit (symbol, amount, price) {
        let path = '/v1/order/orders/place';
        let body = this.get_body();
        let payload = this.sign_sha('POST', URL_HUOBI_PRO, path, body);

        body["account-id"] = this.AccountId;
        body.type = "buy-limit";
        body.amount = amount;
        body.symbol = symbol;
        body.price = price;

        return this.call_api('POST', path, payload, body);
    }
    sell_limit (symbol, amount, price) {
        let path = '/v1/order/orders/place';
        let body = this.get_body();
        let payload = this.sign_sha('POST', URL_HUOBI_PRO, path, body);
        body["account-id"] = this.AccountId;
        body.type = "sell-limit";
        body.amount = amount;
        body.symbol = symbol;
        body.price = price;
        return this.call_api('POST', path, payload, body);
    }
    limitOrder(params) {
        let path = '/v1/order/orders/place';
        let body = this.get_body();
        let payload = this.sign_sha('POST', URL_HUOBI_PRO, path, body);
        body["account-id"] = this.AccountId;
        if(params.type=="sell"){
            body.type = "sell-limit";
        }else if(params.type=="buy"){
            body.type = "buy-limit";
        }
        body.amount = params.amount;
        body.symbol = params.market.split('/')[0].toLowerCase()+params.market.split('/')[1].toLowerCase()
        body.price = params.price;
        return this.call_api('POST', path, payload, body);
    }
    //取消订单
    cancelOrder(params) {
        let path = '/v1/order/orders/'+params.id+'/submitcancel';
        let body = this.get_body();
        let payload = this.sign_sha('POST', URL_HUOBI_PRO, path, body);
        return this.call_api('POST', path, payload, body);
    }
    getOrderInfo(params){
        let path = `/v1/order/orders/`+params.id;
        let body = this.get_body();
        let payload = this.sign_sha('GET', URL_HUOBI_PRO, path, body);
        return this.call_api('GET', path, payload, body);
    }

}
module.exports = Huobi

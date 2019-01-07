//idle:初始化;sending:发单中;pending:挂单中;bilateralStart:搬砖开始;bilateralEnd:搬砖结束;
let UUID = require('uuid');
let Log = require("./log");
const DB = require('./db');
let db = new DB();
const ALL_STATUS = ['idle', 'sending', 'pending','bilateralSending', 'bilateralPending', 'bilateralEnd','endAuto'];

let fee = 0;
let rate = 0;  //已乘2倍

class Order {

    /**
     * 构造函数
     */
    constructor(key,fix,index,config,bilaterType,event) {
        //初始化
        this.key = key;
        this.fix = parseFloat(fix);
        this.event = event;
        this.ordersMap = new Map();
        this.index = index;
        this.log = new Log("bilateral-"+this.key.replace("/",""));
        this.config = config;

        fee = config.orderOptions.feeA + config.orderOptions.feeB;
        rate = config.orderOptions.rate*2;
        this.bilaterType = bilaterType;  //0策略搬  1搬到A，就是A买  2搬到B，就是B买
        this.init();
    }
    //初始化
    init() {
        this.status =  'idle';
        this.orderList = [];
        this.orderList[0] = {};
        this.orderList[1] = {};
        this.ordersMap.clear();
        this.bilaterId = UUID.v1();
    }

    check(A_Depth,B_Depth,api_A,api_B){
        this.log.info("worker"+this.index+"当前状态: "+this.status);
        this.log.info("a0="+JSON.stringify(A_Depth.bids[0]));
        this.log.info("a0="+JSON.stringify(A_Depth.asks[0]));
        this.log.info("b0="+JSON.stringify(B_Depth.bids[0]));
        this.log.info("b0="+JSON.stringify(B_Depth.asks[0]));

        const c_bMax_p = parseFloat(Object.keys(A_Depth.bids[0])[0]);  //c最高买价
        const c_bMax_n = parseFloat(Object.values(A_Depth.bids[0])[0]); //c最高买数量
        const c_aMin_p = parseFloat(Object.keys(A_Depth.asks[0])[0]); //c最低卖价
        const c_aMin_n = parseFloat(Object.values(A_Depth.asks[0])[0]); //c最低卖数量

        const h_bMax_p = parseFloat(Object.keys(B_Depth.bids[0])[0]); //h最高买价
        const h_bMax_n = parseFloat(Object.values(B_Depth.bids[0])[0]); //h最高买价
        const h_aMin_p = parseFloat(Object.keys(B_Depth.asks[0])[0]); //h最高买价
        const h_aMin_n = parseFloat(Object.values(B_Depth.asks[0])[0]); //h最高买价

        let api = {A:api_A,B:api_B};
        let result = this.priceCompute({bMax_p:c_bMax_p,bMax_n:c_bMax_n,aMin_p:c_aMin_p,aMin_n:c_aMin_n},
            {bMax_p:h_bMax_p,bMax_n:h_bMax_n,aMin_p:h_aMin_p,aMin_n:h_aMin_n},this.orderList[0].arguments);
        if(result){ //第一个订单挂着的时候调整第二个订单的价格
            if(result.first === result.buy.market){
                this.orderList[1].arguments = result.sell;
                this.orderList[1].arguments.api = api[result.sell.market];
                if(!this.orderList[0].arguments){
                    this.orderList[0].arguments = result.buy;
                    this.orderList[0].arguments.api = api[result.buy.market];
                }
            }else{
                this.orderList[1].arguments = result.buy;
                this.orderList[1].arguments.api = api[result.buy.market];
                if(!this.orderList[0].arguments){
                    this.orderList[0].arguments = result.sell;
                    this.orderList[0].arguments.api = api[result.sell.market];
                }
            }
        }else{//当前没有盈利空间的时候

        }
        switch (this.status) {
            case 'idle':
                if(result){
                    this.status = "sending";
                    this.bilateralLimitOrder();
                }
                break;
            case 'sending':
                if(this.orderList[0].status === 1){ //已发送
                    let order = this.ordersMap.get(parseInt(this.orderList[0].info.id));
                    if(order){
                        if (parseInt(order.status)===1){
                            this.orderList[0].status = 1 ;
                            this.status = 'pending';
                        }else if (parseInt(order.status)===2){  //第一单成交部分 存数据库
                            this.orderList[0].status = 2 ;
                            this.status = 'pending';
                        }else if (parseInt(order.status)===3){  //第一单成交 存数据库
                            this.orderList[0].status = 3 ;
                            if(order.info.deal_money!=='0'){ //发起第二单
                                this.log.deal(order);
                                this.status = "bilateralSending";
                                this.ordersMap.delete(parseInt(this.orderList[0].info.id));
                                this.bilateralLimitOrder();
                            }else{
                                //this.init();  //第一个订单被撤销后重新搬砖
                                this.status = "bilateralEnd";
                                this.event.emit('woker_end',this.index,0);
                                return;
                            }
                        }
                    }
                }
                break;
            case 'pending':{
                let order = this.ordersMap.get(parseInt(this.orderList[0].info.id));
                if(order){
                    if (parseInt(order.status)===2){  //第一单成交部分 存数据库
                        this.orderList[0].status = 2;
                        this.status = 'pending';
                    }else if (parseInt(order.status)===3){  //第一单成交 存数据库
                        if(order.info.deal_money!=='0'){ //发起第二单
                            this.orderList[0].status = 3;
                            this.log.deal(order);
                            this.status = "bilateralSending";
                            this.ordersMap.delete(parseInt(this.orderList[0].info.id));
                            this.bilateralLimitOrder();
                        }else{
                            this.orderList[0].status = 3;
                            //this.init();  //第一个订单被撤销后重新搬砖
                            this.status = "bilateralEnd";
                            this.event.emit('woker_end',this.index,0);
                            return;
                        }
                    }
                }

                if(this.orderList[0].status === 1){
                    let differ = 0;
                    let depthIndex = 0;
                    let point = this.config.orderOptions[this.orderList[0].arguments.market+"Point"];
                    let depthFix = parseFloat(Math.pow(0.1,point).toFixed(point));
                    if(this.orderList[0].arguments.type === 'buy'){
                        if(this.orderList[0].arguments.market === 'A'){
                            differ = this.floatCompute(this.orderList[0].arguments.price,Object.keys(A_Depth.bids[0])[0],depthFix);
                            depthIndex = this.depthCompute(A_Depth.bids,this.orderList[0].arguments.price);
                        }else{
                            differ = this.floatCompute(this.orderList[0].arguments.price,Object.keys(B_Depth.bids[0])[0],depthFix);
                            depthIndex = this.depthCompute(B_Depth.bids,this.orderList[0].arguments.price);
                        }
                    }else{
                        if(this.orderList[0].arguments.market === 'A'){
                            differ = this.floatCompute(this.orderList[0].arguments.price,Object.keys(A_Depth.asks[0])[0],depthFix);
                            depthIndex = this.depthCompute(A_Depth.asks,this.orderList[0].arguments.price);
                        }else{
                            differ = this.floatCompute(this.orderList[0].arguments.price,Object.keys(B_Depth.asks[0])[0],depthFix);
                            depthIndex = this.depthCompute(B_Depth.asks,this.orderList[0].arguments.price);
                        }
                    }
                    if(!result || differ > 5 || depthIndex > 3){//没有盈利空间或者第一单的价格与市场深度1相差5个精确度单位或者深度在4以后
                        this.orderList[0].status = 0;
                        this.orderList[0].arguments.api.cancelOrder({
                            market: this.key,
                            id: this.orderList[0].info.id
                        }).then(cancelOrderResult=>{
                            if(!!cancelOrderResult){
                                this.log.info("取消第一个订单成功"+this.orderList[0].info.id);
                                this.log.http({arguments:this.orderList[0].arguments,msg:"取消第一个订单成功"+this.orderList[0].info.id});
                                this.orderList[0].status = 3;
                            }else{
                                this.orderList[0].status = 1;
                                this.log.exception({arguments:this.orderList[0].arguments,msg:'取消第一个订单失败了'+this.orderList[0].info.id});
                            }
                        })
                    }
                }
            }
                break;
            case 'bilateralSending':
                if(this.orderList[1].status==null){
                    this.bilateralLimitOrder();
                }
                if(this.orderList[1].status === 1){ //已发送
                    let order = this.ordersMap.get(parseInt(this.orderList[1].info.id));
                    if(order){
                        this.orderList[1].status = parseInt(order.status) ;
                        if (parseInt(order.status)===1){
                            this.status = 'bilateralPending';
                        }else if (parseInt(order.status)===2){  //第二单成交部分 存数据库
                            this.status = 'bilateralPending';
                        }else if (parseInt(order.status)===3){
                            if(order.info.deal_money!=='0'){ //搬砖结束 存数据库 重新开始
                                this.log.deal(order);
                                this.status = "bilateralEnd";
                                //this.init();
                                this.event.emit('woker_end',this.index,1);
                            }else{ //第二个订单被撤销  重新发送
                                this.ordersMap.delete(parseInt(this.orderList[1].info.id));
                                this.bilateralLimitOrder();
                            }
                        }
                    }
                }
                break;
            case 'bilateralPending': {
                let order = this.ordersMap.get(parseInt(this.orderList[1].info.id));
                if (order) {
                    if (parseInt(order.status) === 2) {  //第二单成交部分 存数据库
                        this.orderList[1].status = 2;
                        this.status = 'bilateralPending';
                    } else if (parseInt(order.status) === 3) {
                        this.orderList[1].status = 3;
                        if (order.info.deal_money !== '0') { //搬砖结束 存数据库 重新开始
                            this.log.deal(order);
                            this.status = "bilateralEnd";
                            //this.init();
                            this.event.emit('woker_end', this.index, 1);
                        } else { //第二个订单被撤销  重新发送
                            this.status = "bilateralSending";
                            this.ordersMap.delete(parseInt(this.orderList[1].info.id));
                            this.bilateralLimitOrder();
                        }
                    }
                }

                this.log.info("订单二状态"+this.orderList[1].status);
                if (this.orderList[1].status === 1) {
                    let differ = 0;
                    let depthIndex = 0;
                    let point = this.config.orderOptions[this.orderList[1].arguments.market+"Point"];
                    let depthFix = parseFloat(Math.pow(0.1,point).toFixed(point));
                    if (this.orderList[1].arguments.type === 'buy') {
                        if (this.orderList[1].arguments.market === 'A') {
                            differ = this.floatCompute(this.orderList[1].arguments.price,Object.keys(A_Depth.bids[0])[0],depthFix);
                            depthIndex = this.depthCompute(A_Depth.bids,this.orderList[1].arguments.price);
                        } else {
                            differ = this.floatCompute(this.orderList[1].arguments.price,Object.keys(B_Depth.bids[0])[0],depthFix);
                            depthIndex = this.depthCompute(B_Depth.bids,this.orderList[1].arguments.price);
                        }
                    } else {
                        if (this.orderList[1].arguments.market === 'A') {
                            differ = this.floatCompute(this.orderList[1].arguments.price,Object.keys(A_Depth.asks[0])[0],depthFix);
                            depthIndex = this.depthCompute(A_Depth.asks,this.orderList[1].arguments.price);
                        } else {
                            differ = this.floatCompute(this.orderList[1].arguments.price,Object.keys(B_Depth.asks[0])[0],depthFix);
                            depthIndex = this.depthCompute(B_Depth.asks,this.orderList[1].arguments.price);
                        }
                    }

                    this.log.info("订单二精度差"+differ);
                    this.log.info("订单二深度"+depthIndex);

                    if (result && (differ > 5|| depthIndex>3) ) { //第二单的价格与市场深度1相差5个精确度单位或者在深度4之后  并且 深度1有盈利空间
                        this.orderList[1].status = 0;
                        this.orderList[1].arguments.api.cancelOrder({
                            market: this.key,
                            id: this.orderList[1].info.id
                        }).then(cancelOrderResult => {
                            if (!!cancelOrderResult) {
                                this.log.info("取消第二个订单成功" + this.orderList[1].info.id);
                                this.log.http({
                                    arguments: this.orderList[1].arguments,
                                    msg: "取消第二个订单成功" + this.orderList[1].info.id
                                });
                                this.orderList[1].status = 3;
                            } else {
                                this.orderList[1].status = 1;
                                this.log.exception({
                                    arguments: this.orderList[1].arguments,
                                    msg: '取消第二个订单失败了' + this.orderList[1].info.id
                                });
                            }
                        })
                    } else if (!result && depthIndex>9) { //第二单的价格在深度9以后  并且 深度1无盈利空间  做止损
                        this.status = "endAuto";
                    }
                }
            }
                break;
            case 'endAuto': {
                if (this.orderList[1].status == null) {
                    this.bilateralLimitOrder();
                }

                let order = this.ordersMap.get(parseInt(this.orderList[1].info.id));
                if (order) {
                    // this.orderList[1].status = parseInt(order.status) ;
                    if (parseInt(order.status) === 3) {
                        if (order.info.deal_money !== '0') {

                        } else { //第二个订单被撤销  重新发送
                            this.ordersMap.delete(parseInt(this.orderList[1].info.id));
                            this.bilateralLimitOrder();
                        }
                    }
                }

                if (this.orderList[1].arguments.type === 'buy') {
                    this.orderList[1].arguments.price = ((1 - fee - rate) * this.orderList[0].arguments.price).toFixed(8);
                } else {
                    this.orderList[1].arguments.price = (this.orderList[0].arguments.price / (1 - fee - rate)).toFixed(8);
                }
                if(this.orderList[1].status === 1){
                    this.orderList[1].status = 0;
                    this.orderList[1].arguments.api.cancelOrder({
                        market: this.key,
                        id: this.orderList[1].info.id
                    }).then(cancelOrderResult => {
                        if (!!cancelOrderResult) {
                            this.log.info("取消第二个订单成功" + this.orderList[1].info.id);
                            this.log.http({
                                arguments: this.orderList[1].arguments,
                                msg: "取消第二个订单成功" + this.orderList[1].info.id
                            });
                            this.orderList[1].status = 3;
                        } else {
                            this.orderList[1].status = 1;
                            this.log.exception({
                                arguments: this.orderList[1].arguments,
                                msg: '取消第二个订单失败了' + this.orderList[1].info.id
                            });
                        }
                    });
                }
            }
                break;
        }
    }

    floatCompute(a,b,depthFix){ //返回的值为相差的精度
        depthFix = this.config.orderOptions.depthFix;
        let m = parseFloat(a)*100000000;
        let n = parseFloat(b)*100000000;
        let result = Math.abs(m-n)/depthFix*100000000 ;//Math.abs(m-n)-depthFix*100000000*10;
        return result;
    }

    depthCompute(depth,price){ //返回的值price的深度
        for(let i=0;i<depth.length;i++){
            if(parseFloat(Object.keys(depth[i])[0])==parseFloat(price)){
                return i;
            }
        }
    }

    priceCompute(A_Depth,B_Depth,data){  //type ,price, market, num
        let result = {};
        result["buy"] = {};
        result["sell"] = {};
        if(data){
            if(data.type=="buy"){
                result["buy"] = data;
                if(data.market == "A"){
                    if(parseFloat(B_Depth.bMax_p*(1-fee-rate)) > parseFloat(data.price) && this.config.orderOptions.largest == false){  //B卖
                        result["sell"].type = "sell";
                        result["sell"].price = B_Depth.bMax_p.toFixed(8);
                        result["sell"].market = "B";
                        result["sell"].num = data.num;
                        result.first = "A";
                        result.msg = "B卖";
                        this.log.info(result);
                        return result;
                    }
                    if(parseFloat(data.price )< parseFloat((B_Depth.aMin_p-this.fix)*(1-fee-rate))){  //B挂卖
                        result["sell"].type = "sell";
                        result["sell"].price = (B_Depth.aMin_p - this.fix).toFixed(8);
                        result["sell"].market = "B";
                        result["sell"].num = data.num;
                        result.first = "A";
                        result.msg = "B挂卖";
                        this.log.info(result);
                        return result;
                    }
                }else{
                    if(parseFloat(A_Depth.bMax_p*(1-fee-rate)) > parseFloat(data.price) && this.config.orderOptions.largest == false){  //A卖
                        result["sell"].type = "sell";
                        result["sell"].price = A_Depth.bMax_p.toFixed(8);
                        result["sell"].market = "A";
                        result["sell"].num = data.num;
                        result.first = "B";
                        result.msg = "A卖";
                        this.log.info(result);
                        return result;
                    }
                    if(parseFloat(data.price) < parseFloat((A_Depth.aMin_p - this.fix)*(1-fee-rate))){  //A挂卖
                        result["sell"].type = "sell";
                        result["sell"].price = (A_Depth.aMin_p - this.fix).toFixed(8);
                        result["sell"].market = "A";
                        result["sell"].num = data.num;
                        result.first = "B";
                        result.msg = "A挂卖";
                        this.log.info(result);
                        return result;
                    }
                }
            }else{
                result["sell"] = data;
                if(data.market == "B") {
                    if(parseFloat(data.price*(1-fee-rate)) > parseFloat(A_Depth.aMin_p) && this.config.orderOptions.largest == false){  //在A买
                        result["buy"].type = "buy";
                        result["buy"].price = A_Depth.aMin_p.toFixed(8);
                        result["buy"].market = "A";
                        result["buy"].num = data.num;
                        result.get = (profit-charge)/(data.num*result["buy"].price)*2;
                        result.first = "B";
                        result.msg = "在A买";
                        this.log.info(result);
                        return result;
                    }
                    if(parseFloat(data.price*(1-fee-rate)) > parseFloat((A_Depth.bMax_p + this.fix))){  //在A挂买
                        result["buy"].type = "buy";
                        result["buy"].price = (A_Depth.bMax_p + this.fix).toFixed(8);
                        result["buy"].market = "A";
                        result["buy"].num = data.num;
                        result.first = "B";
                        result.msg = "在A挂买";
                        this.log.info(result);
                        return result;
                    }
                }else{
                    if(parseFloat(data.price*(1-fee-rate)) > parseFloat(B_Depth.aMin_p) && this.config.orderOptions.largest == false){  //在B买
                        result["buy"].type = "buy";
                        result["buy"].price = B_Depth.aMin_p.toFixed(8);
                        result["buy"].market = "B";
                        result["buy"].num = data.num;
                        result.first = "A";
                        result.msg = "在B买";
                        this.log.info(result);
                        return result;
                    }
                    if(parseFloat(data.price*(1-fee-rate)) > parseFloat((B_Depth.bMax_p + this.fix))){  //在B挂买
                        result["buy"].type = "buy";
                        result["buy"].price = (B_Depth.bMax_p + this.fix).toFixed(8);
                        result["buy"].market = "B";
                        result["buy"].num = data.num;
                        result.first = "A";
                        result.msg = "在B挂买";
                        this.log.info(result);
                        return result;
                    }
                }
            }
        }else{
            data = {};
            data.type = "buy";
            if(parseFloat(A_Depth.bMax_p*(1-fee-rate)) > parseFloat(B_Depth.aMin_p) && this.bilaterType!==1 && this.config.orderOptions.largest == false){  //在B买A卖
                data.price = B_Depth.aMin_p.toFixed(8);
                data.market = "B";
                data.num = Math.abs(A_Depth.bMax_n,B_Depth.aMin_n);
                result["buy"] = data;
                result["sell"].type = "sell";
                result["sell"].price = A_Depth.bMax_p.toFixed(8);
                result["sell"].market = "A";
                result["sell"].num = data.num;
                result.first = "A";
                result.msg = "在B买A卖";
                this.log.info(result);
                return result;
            }
            if(parseFloat(B_Depth.bMax_p*(1-fee-rate)) > parseFloat(A_Depth.aMin_p) && this.bilaterType!==2 && this.config.orderOptions.largest == false){  //在A买B卖
                data.price = A_Depth.aMin_p.toFixed(8);
                data.market = "A";
                data.num = Math.abs(B_Depth.bMax_n,A_Depth.aMin_n);
                result["buy"] = data;
                result["sell"].type = "sell";
                result["sell"].price = B_Depth.bMax_p.toFixed(8);
                result["sell"].market = "B";
                result["sell"].num = data.num;
                result.first = "A";
                result.msg = "在A买B卖";
                this.log.info(result);
                return result;
            }
            if(parseFloat(A_Depth.aMin_p) <parseFloat((B_Depth.aMin_p - this.fix)*(1-fee-rate)) && this.bilaterType!==2 && this.config.orderOptions.largest == false){  //在A买B挂卖
                data.price = A_Depth.aMin_p.toFixed(8);
                data.market = "A";
                data.num = Math.abs(A_Depth.aMin_n,B_Depth.aMin_n);
                result["buy"] = data;
                result["sell"].type = "sell";
                result["sell"].price = (B_Depth.aMin_p - this.fix).toFixed(8);
                result["sell"].market = "B";
                result["sell"].num = data.num;
                result.first = "A";
                result.msg = "在A买B挂卖";
                this.log.info(result);
                return result;
            }
            if(parseFloat(B_Depth.aMin_p) < parseFloat((A_Depth.aMin_p - this.fix)*(1-fee-rate)) && this.bilaterType!==1 && this.config.orderOptions.largest == false){  //在B买A挂卖
                data.price = B_Depth.aMin_p.toFixed(8);
                data.market = "B";
                data.num = Math.abs(A_Depth.aMin_n,B_Depth.aMin_n);
                result["buy"] = data;
                result["sell"].type = "sell";
                result["sell"].price = (A_Depth.aMin_p - this.fix).toFixed(8);
                result["sell"].market = "A";
                result["sell"].num = data.num;
                result.first = "B";
                result.msg = "在B买A挂卖";
                this.log.info(result);
                return result;
            }
            if((A_Depth.aMin_p - B_Depth.bMax_p)>=(B_Depth.aMin_p - A_Depth.bMax_p)  && this.bilaterType!==1){  //B挂买A挂卖
                if(parseFloat((A_Depth.aMin_p - this.fix)*(1-fee-rate))>parseFloat((B_Depth.bMax_p + this.fix))){
                    data.price = (B_Depth.bMax_p + this.fix).toFixed(8);
                    data.market = "B";
                    data.num = Math.abs(A_Depth.aMin_n,B_Depth.bMax_n);
                    result["buy"] = data;
                    result["sell"].type = "sell";
                    result["sell"].price = (A_Depth.aMin_p - this.fix).toFixed(8);
                    result["sell"].market = "A";
                    result["sell"].num = data.num;
                    result.first = "A";
                    result.msg = "B挂买A挂卖";
                    this.log.info(result);
                    return result;
                }
            }
            if((B_Depth.aMin_p - A_Depth.bMax_p)>=(A_Depth.aMin_p - B_Depth.bMax_p) && this.bilaterType!==2){  //A挂买B挂卖
                if(parseFloat((B_Depth.aMin_p - this.fix)*(1-fee-rate))>parseFloat((A_Depth.bMax_p + this.fix))) {
                    data.price = (A_Depth.bMax_p + this.fix).toFixed(8);
                    data.market = "A";
                    data.num = Math.abs(B_Depth.aMin_n, A_Depth.bMax_n);
                    result["buy"] = data;
                    result["sell"].type = "sell";
                    result["sell"].price = (B_Depth.aMin_p - this.fix).toFixed(8);
                    result["sell"].market = "B";
                    result["sell"].num = data.num;
                    result.first = "A";
                    result.msg = "A挂买B挂卖";
                    this.log.info(result);
                    return result;
                }
            }
        }
        return null;
    }

    profitCompute(buyPrice,sellPrice,num){
        const profit = (parseFloat(sellPrice)-parseFloat(buyPrice))*num;
        const charge =  num*fee*parseFloat(sellPrice);
        return {profit:profit,charge:charge}
    }

    order_update(orderStatus,orderInfo){
        this.log.info("===============worker"+this.index+"order_update"+orderStatus+"===============");
        this.log.info(orderInfo);
        this.log.info("==================================================");
        if(orderInfo.deal_money === 0){
            orderInfo.deal_money = '0';
        }
        if(orderInfo.market.toUpperCase() == this.key.replace("/","")){
            this.ordersMap.set(parseInt(orderInfo.id),{status:orderStatus,info:orderInfo});
            let type = ['','sell','buy'];
            if(!!this.orderList[0].info){
                if(parseInt(orderInfo.id)===parseInt(this.orderList[0].info.id)){
                    if(this.orderList[0].status ==1 &&(parseInt(orderStatus)===2 ||(parseInt(orderStatus)===3 && orderInfo.deal_money!=='0'))){
                        db.insertOrgin({id:this.bilaterId,marketKey:this.key,orderA:''+orderInfo.id,amount:orderInfo.amount});
                        if(parseInt(orderInfo.side)==1){
                            db.updateSellPrice({id:this.bilaterId,sellPrice:''+orderInfo.price});
                        }else{
                            db.updateBuyPrice({id:this.bilaterId,buyPrice:''+orderInfo.price});
                        }
                    }
                    if(parseInt(orderStatus)===3 && orderInfo.deal_money!=='0'){
                        db.saveDeal({orderId:''+orderInfo.id,
                            market:this.config[this.orderList[0].arguments.market].name,
                            marketKey:this.key,
                            orderType:type[parseInt(orderInfo.side)],
                            price:''+orderInfo.price,
                            bilateralId:this.bilaterId,
                            amount:orderInfo.amount});
                    }
                }
            }
            if(!!this.orderList[1].info){
                if(parseInt(orderInfo.id)===parseInt(this.orderList[1].info.id)){
                    if(parseInt(orderStatus) === 1 || parseInt(orderStatus) === 2){
                        db.updateBilateral({id:this.bilaterId,orderB:'' + orderInfo.id});
                        if(parseInt(orderInfo.side)==1){
                            db.updateSellPrice({id:this.bilaterId,sellPrice:''+orderInfo.price});
                        }else{
                            db.updateBuyPrice({id:this.bilaterId,buyPrice:''+orderInfo.price});
                        }
                    }
                    if(parseInt(orderStatus)===3 && orderInfo.deal_money ==='0') {
                        db.updateBilateral({id:this.bilaterId,orderB:''});
                    }
                    if(parseInt(orderStatus)===3 && orderInfo.deal_money!=='0'){
                        let buyPrice = this.orderList[0].arguments.price;
                        let sellPrice = orderInfo.price;
                        if(this.orderList[0].arguments.type==="sell"){
                            buyPrice = orderInfo.price;
                            sellPrice = this.orderList[0].arguments.price;
                        }
                        let profitData = this.profitCompute(buyPrice,sellPrice,parseFloat(orderInfo.amount));
                        let profit = profitData.profit;
                        let charge = profitData.charge;
                        db.saveBilateral({id:this.bilaterId,orderB:''+orderInfo.id,profit:profit,charge:charge});
                        if(parseInt(orderInfo.side)==1){
                            db.updateSellPrice({id:this.bilaterId,sellPrice:''+orderInfo.price});
                        }else{
                            db.updateBuyPrice({id:this.bilaterId,buyPrice:''+orderInfo.price});
                        }
                        db.saveDeal({orderId:''+orderInfo.id,
                            market:this.config[this.orderList[1].arguments.market].name,
                            marketKey:this.key,
                            orderType:type[parseInt(orderInfo.side)],
                            price:''+orderInfo.price,
                            bilateralId:this.bilaterId,
                            amount:orderInfo.amount});
                    }
                }
            }
        }

    }

    bilateralLimitOrder(){
        switch (this.status) {
            case 'sending':
                this.orderList[0].status = 0;
                this.orderList[0].arguments.api.limitOrder({
                    market: this.key,
                    type: this.orderList[0].arguments.type,
                    price: parseFloat(this.orderList[0].arguments.price).toFixed(this.config.orderOptions[this.orderList[0].arguments.market+"Point"]),
                    amount: this.config.orderOptions.amount//Math.min(this.orderList[0].arguments.num,1)+""
                }).then(limitOrderResult=>{
                    if(!!limitOrderResult){
                        this.orderList[0].status = 1;
                        this.orderList[0].info = limitOrderResult.data;
                        this.log.info("订单一发送成功"+this.orderList[0].info.id);
                        this.log.http({arguments:this.orderList[0].arguments,msg:"订单一发送成功"+this.orderList[0].info.id});
                    }else{
                        //this.init(); //第一个订单发送失败  重新开始
                        this.status = "bilateralEnd";
                        this.event.emit('woker_end',this.index,0);
                        this.log.exception({arguments:this.orderList[0].arguments,msg:"订单一发送失败"})
                    }
                });
                break;
            case 'bilateralSending':
                this.orderList[1].status = 0;
                this.orderList[1].arguments.api.limitOrder({
                    market: this.key,
                    type: this.orderList[1].arguments.type,
                    price: parseFloat(this.orderList[1].arguments.price).toFixed(this.config.orderOptions[this.orderList[1].arguments.market+"Point"]),
                    amount: this.config.orderOptions.amount//Math.min(this.orderList[1].arguments.num,1)+""
                }).then(limitOrderResult=>{
                    if(!!limitOrderResult){
                        this.event.emit('woker_start',this.index);
                        this.orderList[1].status = 1;
                        this.orderList[1].info = limitOrderResult.data;
                        this.log.http({arguments:this.orderList[1].arguments,msg:"订单二发送成功"+this.orderList[1].info.id});
                    }else{
                        this.orderList[1].status = null;
                        //第二个订单发失败了  继续发
                        this.log.exception({arguments:this.orderList[1].arguments,msg:"订单二发送失败"})
                    }
                });
                break;
            case 'endAuto':
                this.orderList[1].status = 0;
                this.orderList[1].arguments.api.limitOrder({
                    market: this.key,
                    type: this.orderList[1].arguments.type,
                    price:parseFloat(this.orderList[1].arguments.price).toFixed(this.config.orderOptions[this.orderList[1].arguments.market+"Point"]),
                    amount: this.config.orderOptions.amount//Math.min(this.orderList[1].arguments.num,1)+""
                }).then(limitOrderResult=>{
                    if(!!limitOrderResult){
                        this.orderList[1].status = 1;
                        this.orderList[1].info = limitOrderResult.data;
                        this.log.http({arguments:this.orderList[1].arguments,msg:"订单二发送成功，结束自动"+this.orderList[1].info.id});
                        db.saveBilateral({id:this.bilaterId,orderB:''+this.orderList[1].info.id,profit:-1,charge:-1});
                        this.status = "bilateralEnd";
                        this.event.emit('woker_end',this.index,2);
                    }else{
                        this.orderList[1].status = null;
                        //第二个订单发失败了  继续发
                        this.log.exception({arguments:this.orderList[1].arguments,msg:"订单二发送失败"})
                    }
                });
                break;
        }

    }

}
module.exports = Order;
//全局异常
process.on('uncaughtException', function (err) {
    console.log(err)
    //this.log.exception(err.stack)
});

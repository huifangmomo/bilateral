const CoinEx = require("./class/coinex")
const fs = require('fs')
const config = JSON.parse(fs.readFileSync(__dirname + '/config/config.json'))
const AccessID = config.AccessID
const SecretKey = config.SecretKey
const coinex = new CoinEx(null, AccessID, SecretKey)


const info="CET\tBTC\tUSDT\t1000\t2972652809\t2972810585\t2972810578"
let infoArr = info.split("\t")
const A=infoArr[0]
const B=infoArr[1]
const F=infoArr[2]
const A_B_ID=infoArr[4]
const B_F_ID=infoArr[5]
const A_F_ID=infoArr[6]
async function getInfo(){
    let status
    let A_B = await coinex.getOrderInfo({
        market: A+B,
        id:A_B_ID
    })
    let B_F = await coinex.getOrderInfo({
        market: B+F,
        id:B_F_ID
    })
    let A_F = await coinex.getOrderInfo({
        market: A+F,
        id:A_F_ID
    })
    if(A_B.data.status!='done'||A_F.data.status!='done'||B_F.data.status!='done'){
        console.log('A_B.status: '+A_B.data.status+' B_F.status: '+B_F.data.status+' A_F.status: '+A_F.data.status)
        return
    }
    if(A_B.data.type=='sell'){
        status=1
    }
    if(A_B.data.type=='buy'){
        status=-1
    }
    let profitA =status*(parseFloat(A_F.data.amount)-parseFloat(A_B.data.amount))-parseFloat(A_B.data.amount) * 0.001 * 0.5 * 0.8 * 0.8 * 3
    let profitB =status*(parseFloat(A_B.data.deal_money)-parseFloat(B_F.data.amount))
    let profitF =status*(parseFloat(B_F.data.deal_money)-parseFloat(A_F.data.deal_money))
    console.log("profitA:"+profitA)
    console.log("profitB:"+profitB)
    console.log("profitF:"+profitF)
    return
}
async function checkIsDeal() {
    let A_B = await coinex.getOrderInfo({
        market: A+B,
        id:A_B_ID
    })
    console.log("================================")
    console.log(A_B.data.status)
    console.log("================================")
    if(A_B.data.status!="done"){
        console.log(A_B.data)
    }
    return

}
if(!!B_F_ID){
    getInfo()
}else{
    checkIsDeal()
}




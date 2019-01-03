let pomelo = require('pomelo-logger')
let fs = require("fs");

class Log {
    constructor(name) {
        this.confirmPath('./logs/' + name)
        pomelo.configure('./config/log.json', {
            name: name
        })
        this.infoLog = pomelo.getLogger('info')
        this.exceptionLog = pomelo.getLogger('exception')
        this.httpLog = pomelo.getLogger('http')
        this.dealLog = pomelo.getLogger('deal')
    }

    confirmPath(pathStr) {
        if (!fs.existsSync(pathStr)) {
            fs.mkdirSync(pathStr);
        }
    }

    checktext(text) {
        return typeof text == "object" ? JSON.stringify(text) : text
    }

    info(text) {
        text = this.checktext(text)
        this.infoLog.info(text)
    }

    exception(text) {
        text = this.checktext(text)
        this.exceptionLog.error(text)
    }

    http(text) {
        text = this.checktext(text)
        this.httpLog.info(text)
    }

    deal(text) {
        text = this.checktext(text)
        this.dealLog.info(text)
    }

}

module.exports = Log

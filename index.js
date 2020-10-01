const Redis = require('ioredis');
const Base64 = require('js-base64')

async function register(server, options) {
    if (!Object.keys(options).length)
        return;

    options.prefix = options.prefix ? options.prefix : 'hapi-request-logs'

    const logger = (info) => {
        try {
            var handler;
            if (options.redis) {
                handler = new Redis(options.redis)
            }
            let log = JSON.stringify(info)

            handler.lpush(options.prefix, log)
        } catch (e) { console.error(e) }
    }

    server.decorate('request', 'llog', logger)

    server.ext('onRequest', (request, h) => {
        try {

            // 不记录options
            if (request.method == "options") return h.continue

            // 不记录忽略
            for (let p in options.ignore.path) {
                if (request.path.indexOf(options.ignore.path[p]) > -1) return h.continue
            }

            let info = {}
            info.remote = request.headers.x_forwarded_for || request.headers['x-real-ip'] || request.headers['x-forwarded-for'] || request.info.remoteAddress
            info.host = request.headers.host
            info.path = request.path
            info.method = request.method
            info.proxy = request.headers['x-nginx-proxy']
            info.referer = request.headers.referer
            info.token = request.headers.authorization != undefined && request.headers.authorization != "undefined" ? request.headers.authorization : ""

            try {
                if (info.token.indexOf('.') > -1) {
                    let userinfo = Base64.decode(request.headers.authorization.split('.')[1])
                    info.user = JSON.parse(userinfo)
                }
            } catch (e) { console.error(e) }

            request.llog(info)
        } catch (e) {
            console.error(e)
        }

        return h.continue
    })
}

module.exports = {
    register,
    name: 'hapi-request-logs'
}

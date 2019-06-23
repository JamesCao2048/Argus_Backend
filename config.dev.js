// 功能：用户搜索：python请求后将结果处理成commodity格式，再将结果返回
// 用户将商品添加listen列表：增加 coomodity item, hook item
// 用户查看已有listen列表：获得全部hook信息

// 轮询商品价格：隔断时间遍历hook item中商品信息，并check价格有无变化，若变化，更新商品信息，并发送邮件提醒

// 将商品移除listen列表: 移除hook item
// 查询某商品详细信息(以便查看历史价格走势):返回commodity item

module.exports = {
    mailgun: {
        "mailgun_apikey": "key-e4e97a86b017d3d3d99de4c4071e70ad",
        "mailgun_domain": "appetizer.io",
    },
    fixedUser: {
        uid: "yaopengniao",
        password: "yaopengniao",
        email:"junmingcao@foxmail.com"
    },
    mongoose: {
        connect: {
            url: 'mongodb://218.193.191.42:27017/argus'
        },
        options: {
            user: 'cjm',
            pass: 'cjm2019',
            reconnectTries: Number.MAX_VALUE,
            reconnectInterval: 5000
        }
    },
    mongoCommoditySchema: {
        cid: String,
        uid: String,
        imgurl: String,
        url: String,
        commodityName: String,
        price: [Number],
        price_dates: [String],
        source: String,
        detail:String
    },
    mongoUserSchema: {
        uid: String,
        email: String,
        password: String
    },

    mongoScriptionSchema:{
        uid:String,
        openid:String
    },


    logAddress: {
        filename: __dirname + '/log/access-%DATE%.log',
        frequency: 'daily',
        verbose: false,
        date_format: "YYYY-MM-DD"
    },
    statsUpdateTime: 21600000, //ms
    refreshTokenTime: 5400000, //ms
};

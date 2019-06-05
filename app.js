// 功能：用户搜索：python请求后将结果处理成commodity格式，再将结果返回
// 用户将商品添加listen列表：增加 coomodity item, hook item
// 用户查看已有listen列表：获得全部hook信息

// 轮询商品价格：隔断时间遍历hook item中商品信息，并check价格有无变化，若变化，更新商品信息，并发送邮件提醒

// 将商品移除listen列表: 移除hook item
// 查询某商品详细信息(以便查看历史价格走势):返回commodity item
const express = require('express');
const request = require("request");
const puppeteer = require('puppeteer');
const CREDS = require("./creds");
const app = express();
const config = require('./config.dev');
const moment = require('moment');
moment.locale('zh-CN'); // 中文日期
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
require('body-parser-xml')(bodyParser);
const xmlParser = bodyParser.xml();
const xml2js = new (require('xml2js').Builder)();
const shortidgenerator = require('js-shortid'); //time+salt
const morgan = require('morgan');
const fs = require('fs');
const logDirectory = __dirname + '/log';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const hooksSchema = new Schema(config.mongoHooksSchema, {collection: 'hooks'});
const commoditySchema = new Schema(config.mongoCommoditySchema, {collection: 'commodities'});
const commodityModel = mongoose.model('commodities', commoditySchema);
const hooksModel = mongoose.model('hooks', hooksSchema);
const accessLogStream = require('file-stream-rotator').getStream(config.logAddress);


fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);
process.stdout.write = accessLogStream.write.bind(accessLogStream); // redirect console.log(stdout) to process.stderr
app.use(morgan('short', {stream: accessLogStream}));


async function run(query) {
    const browser = await puppeteer.launch({headless: false})
    let page = await browser.newPage()
    await page.goto('https://s.taobao.com/search?q='+query)

    const switchbutton_selector = "#J_Quick2Static"
    const username_selector = "#TPL_username_1"
    const password_selector = "#TPL_password_1"
    const loginbutton_selector = "#J_SubmitStatic"

    await page.click(switchbutton_selector)
    await page.click(username_selector)
    await page.keyboard.type(CREDS.username,{delay: Math.random()*50+100})
    await page.click(password_selector)
    await page.keyboard.type(CREDS.password, {delay:Math.random()*50+100})
    page = await mouse_slide(page)

    await page.click(loginbutton_selector)
    await save_cookie(page)
    await page.waitForNavigation()

    //await page.screenshot({ path: 'screenshots/query.png' });
    //browser.close();
}

async function mouse_slide(page){
    try{
    await page.hover("#nc_1_n1z")
    await page.mouse.down()
    await page.mouse.move(2000,0,{"delay":Math.random()*1000+1000})
    await page.mouse.up()
    console.log("slide success");
    return page
    }
    catch (err){
        console.log("slide error")
        return page
    }
}

async function save_cookie(page){
    try{
        cookie_list = page.cookies()
        var cookies = ''
        for (cookie in cookie_list){
            str_cookie = '{0}={1};'
            str_cookie = str_cookie.format(cookie.get('name'), cookie.get('value'))
            cookies += str_cookie
        }
        console.log("cookie success")
        print(cookies)
    }
    catch (err){
        console.log("cookie error")
        return page
    }
}

app.post('/commodity/search',jsonParser, (req, res) => {
    const query  = req.body.query
    const website = req.body.website
    console.log( 'query: ' + query);
    console.log('website: ' + website);

    let  options = {
        method: 'get',
        url: "https://s.taobao.com/search?q="+query,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };
    run(query)
    res.sendStatus(200);
});



app.post('/commodity/add', jsonParser, (req, res) => {
    const commodity =
        {
            uid: req.uid,
            commodityName: req.body.commodityName,
            source: req.body.source
        };
    const commodityEntity = new commodityModel(commodity);
    commodityEntity.save(err => {
        if (err) {
            res.sendStatus(400);
        } else {
            res.sendStatus(200);
        }
    });
});

app.get('/commodity/all', (req, res) => {
    console.log(req.uid + ' uid');
    commodityModel.find({'uid': req.uid}, '_id commodityName source', (err, commodities) => {
        if (err) return console.log(err);
        const result = commodities.map(commodity => {
            let commodityjson = JSON.parse(JSON.stringify(commodity));
            let formatted = {};
            formatted['id'] = commodityjson._id;
            formatted['commodityName'] = commodityjson.commodityName;
            formatted['source'] = commodityjson.source;
            return formatted;
        });
        res.status(200).send(result);
    });
});


app.post('/commodity/delete', jsonParser, (req, res) => {
    commodityModel.deleteOne({_id: req.oid});
    res.status(200).send({success: true});
});

app.post('/hooks/create', jsonParser, (req, res) => {
    const payload = req.body.payload;
    storeHookId(req.uid).then(hid => { // 存储这个用户的hook信息
        const hook = {
            hid: hid,
            uid: req.uid,
            name: req.body.name || '',
            type: req.body.type || '',
            detail: payload || ''
        };
        const hooksEntity = new hooksModel(hook);
        hooksEntity.save(err => {
            if (err) {
                res.sendStatus(400);
            } else {
                res.sendStatus(200);
            }
        });
    });
});

app.post('/hooks/delete', jsonParser, (req, res) => {
    const hid = req.body.hid;
    hooksModel.findOne({hid: hid}, 'uid', (err, result) => {
        if (err) return res.status(400);
        if (result.uid === req.uid) {
            hooksModel.deleteOne({hid: hid}, (err, writeOpResult) => {
                if (err) return res.sendStatus(400);
                return res.sendStatus(200);
            });
        } else {
            return res.status(400);
        }
    });
});

/**
 * hook总入口
 * */
app.post('/h/:hid', jsonParser, (req, res) => {
    const kind = req.body.kind;
    const destHid = req.params.hid;
    switch (kind) {
        case "slack":
            transferToSlack(req.body, destHid, res);
            break;
        case "wx":
            sendTemplateMessage(req.body, destHid, res);
            break;
        case "email":
            sendEmail(req.body, destHid, res);
            break;
        default:
            sendTemplateMessage();
    }
});


app.get('/hooks', (req, res) => {
    hooksModel.find({'uid': req.uid}, 'hid  name type detail').then(querriedHooks => {
        const formatted = querriedHooks.map(hooks => {
            let hook = JSON.parse(JSON.stringify(hooks));
            let formatted = {};
            formatted['hid'] = hook.hid;
            formatted['name'] = hook.name;
            formatted['type'] = hook.type;
            formatted['detail'] = hook.detail;
            return formatted;
        });
        res.send(formatted);
    });
});


async function prepareEmailContent(reqBody, destHid) {
    const emailDoc = await hooksModel.findOne({'hid': destHid}, 'detail').exec();
    return {
        from: `AppetizerIO <noreply@appetizer.io>`,
        to: [emailDoc.detail], // [user's email address]
        subject: reqBody.subject,
        html: reqBody.html || 'none',
    };

}

async function sendEmail(reqBody, destHid, res) {
    const mg = require('mailgun-js')({apiKey: config.mailgun.mailgun_apikey, domain: config.mailgun.mailgun_domain});
    const emailContent = await prepareEmailContent(reqBody, destHid);
    mg.messages().send(emailContent, (sendError, body) => {
        if (sendError) {
            res.send('400');
        } else {
            res.send('200');
        }
    });
}

/**
 * 存储hookid和openid的映射
 * */
async function storeHookId(uid, callback) {
    let hookid = shortidgenerator.gen();
    const existedHookid = await hooksModel.findOne({'uid': uid}, 'hid').exec();
    if (!existedHookid) hookid = shortidgenerator.gen(); //如果hookid重复，在随机产生一次
    return hookid;
}

/**
 * 检查是否有hookid
 * **/
function hasHookId(openid) {
    return hooksModel.findOne({'openid': openid}, 'hid', (err, hooksModel) => {
        if (err) {
            res.status(400);
        }
        return hooksModel !== null && hooksModel.hid.length !== 0;
    });
}

/**
 * 验证hookid是否合法，是否[A-Za-z0-9]并且长度小于10
 * */
function isValidHookid(hookid) {
    // TODO 长度小于10？？
    return /^[A-Za-z0-9]+$/.test(hookid);
}

/**
 * 取关后注销hookid
 * */
async function destroyHooks(openid) {
    const result = await hooksModel.where('openid', openid).updateMany({$set: {hid: ''}}).exec();
    return result.hid === '';
}


// catch 404
app.use(function (err, req, res, next) {
    next(err);
    res.status(400).end();
});

// entry point
const port = +process.argv[2] || 8088;
app.listen(port, function () {
    console.log('unified-notifier listening on port ' + port);
    mongoose.connect(config.mongoose.connect.url, config.mongoose.options).then(
        () => {
            console.log("数据库连接成功");
        },
        err => {
            console.log("数据库连接失败:", err);
        }
    );
});

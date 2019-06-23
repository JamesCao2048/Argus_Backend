// 功能：用户搜索：python请求后将结果处理成commodity格式，再将结果返回
// 用户将商品添加listen列表：增加 coomodity item, hook item
// 用户查看已有listen列表：获得全部hook信息

// 轮询商品价格：隔断时间遍历hook item中商品信息，并check价格有无变化，若变化，更新商品信息，并发送邮件提醒

// 将商品移除listen列表: 移除hook item
// 查询某商品详细信息(以便查看历史价格走势):返回commodity item
const express = require('express');
const format = require('string-format')
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
const commoditySchema = new Schema(config.mongoCommoditySchema, {collection: 'commodities'});
const commodityModel = mongoose.model('commodities', commoditySchema);
const accessLogStream = require('file-stream-rotator').getStream(config.logAddress);

fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);
process.stdout.write = accessLogStream.write.bind(accessLogStream); // redirect console.log(stdout) to process.stderr
app.use(morgan('short', {stream: accessLogStream}));

Date.prototype.Format = function(fmt) { //author: meizz
    var o = {
        "M+": this.getMonth() + 1, //月份
        "d+": this.getDate(), //日
        "h+": this.getHours(), //小时
        "m+": this.getMinutes(), //分
        "s+": this.getSeconds(), //秒
        "S": this.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}

let amazonPage = get_website_page("https://www.amazon.cn/")
let jdPage = get_website_page("https://www.jd.com/")
async function get_website_page(url){
    const browser = await puppeteer.launch({headless: false})
    let page = await browser.newPage()
    //let Page = await browser.newPage()
    await page.goto(url)
    //await amazonPage.waitForNavigation()
    return page
}

async function amazon_search(query, num){
    let page = await amazonPage

    let searchSelector = "#twotabsearchtextbox"
    await page.click(searchSelector)

    await page.keyboard.down('ControlLeft')
    await page.keyboard.down('a')
    await page.keyboard.press('Backspace')
    await page.keyboard.up('a')
    await page.keyboard.up('ControlLeft')

    await page.keyboard.type(query)
    let querySelector = "#nav-search > form > div.nav-right > div > input"
    const navigationPromise = page.waitForNavigation();
    await page.click(querySelector)
    await navigationPromise

    let item_selector_temp = "#search > div.sg-row > div.sg-col-20-of-24.sg-col-28-of-32.sg-col-16-of-20.sg-col.s-right-column.sg-col-32-of-36.sg-col-8-of-12.sg-col-12-of-16.sg-col-24-of-28 > div > span:nth-child(4) > div.s-result-list.s-search-results.sg-row > div:nth-child({}) > div > div > div > div:nth-child(2)"
    let i = 1
    let itemList = []
    for (i; i <= num; i++) {
        let item_selector = format(item_selector_temp, i)
        try {
            const imageurl = await page.$eval(item_selector + " > div:nth-child(1) > div > div > span > a > div > img", el => el.src)
            const name = await page.$eval(item_selector + " > div:nth-child(2) > div > div > h2 > a > span", el => el.innerHTML)
            const price_int = await page.$eval(item_selector + " > div:nth-child(3) > div > div.a-section.a-spacing-none.a-spacing-top-small > div > div > a > span > span:nth-child(2) > span.a-price-whole", el => el.innerHTML)
            const price_double = await page.$eval(item_selector + " > div:nth-child(3) > div > div.a-section.a-spacing-none.a-spacing-top-small > div > div > a > span > span:nth-child(2) > span.a-price-fraction", el => el.innerHTML)
            const url = await page.$eval(item_selector+ " > div:nth-child(1) > div > div > span > a",  el => el.href)
            console.log("item: " + i)
            console.log(url)
            console.log(imageurl)
            console.log(name)
            console.log(price_int.replace(/<\/?.+?\/?>/g,"")+price_double)
            console.log((new Date()).Format("yyyy-MM-dd hh:mm:ss"))
            itemList.push({
                "commodityName": name,
                "url": url,
                "price": price_int.replace(/<\/?.+?\/?>/g,"")+price_double,
                "imageUrl":imageurl,
                "source":"amazon",
                "price_date":(new Date()).Format("yyyy-MM-dd hh:mm:ss")
        })
        }
        catch (e) {
            console.error(e)
        }
    }
    return itemList
}

async function jd_search(query, num){
    let page = await jdPage

    let searchSelector = "#key"
    await page.click(searchSelector)

    await page.keyboard.down('ControlLeft')
    await page.keyboard.down('a')
    await page.keyboard.press('Backspace')
    await page.keyboard.up('a')
    await page.keyboard.up('ControlLeft')

    await page.keyboard.type(query)
    let querySelector = "#search > div > div.form > button"
    const navigationPromise = page.waitForNavigation();
    try {await page.click(querySelector)}
    catch (e){
        await page.click("#search-2014 > div > button")
    }
    finally {
        await navigationPromise

        let item_selector_temp = "#J_goodsList > ul > li:nth-child({})"
        let i = 1
        let itemList = []
        for (i; i <= num; i++) {
            let item_selector = format(item_selector_temp, i)

                const imageurl = await page.$eval(item_selector + " > div > div.p-img > a > img", el => el.src)
                const price = await page.$eval(item_selector + " > div > div.p-price > strong > i", el => el.innerHTML)
                const url = await page.$eval(item_selector + " > div > div.p-img > a", el => el.href)
                console.log("item: " + i)
                console.log(url)
                console.log(imageurl)
                console.log(price)
                console.log((new Date()).Format("yyyy-MM-dd hh:mm:ss"))
            try {
                const name = await page.$eval(item_selector + " > div > div.p-name.p-name-type-2 > a", el => el.title)
                console.log(name)
                itemList.push({
                    "commodityName": name,
                    "url": url,
                    "price": price,
                    "imageUrl": imageurl,
                    "source": "jd",
                    "price_date": (new Date()).Format("yyyy-MM-dd hh:mm:ss")
                })
            }
            catch (e) {
                console.error(e)
                const name = await page.$eval(item_selector + " > div > div.p-name > a", el => el.title)
                itemList.push({
                    "commodityName": name,
                    "url": url,
                    "price": price,
                    "imageUrl": imageurl,
                    "source": "jd",
                    "price_date": (new Date()).Format("yyyy-MM-dd hh:mm:ss")
                })
            }
        }
        return itemList
    }
}

app.post('/commodity/search',jsonParser, (req, res) => {
    const query  = req.body.query
    const website = req.body.website
    console.log( 'query: ' + query);
    console.log('website: ' + website);
    if(website == "amazon"){
        amazon_search(query, 5).then(
            result =>{
                res.status(200).send(result)
            }
        )
    }
    else if(website == "jd"){
        jd_search(query, 5).then(
            result =>{
                res.status(200).send(result)
            }
        )
    }
    else if (website == "all"){
        amazon_search(query, 5).then(
            amazon_result =>{
                jd_search(query, 5).then(
                    jd_result =>{
                        res.status(200).send(amazon_result.concat(jd_result))
                    }
                )
            }
        )
    }
    else{
        res.status(400).send("illegal website option")
    }
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

app.post('/mail', jsonParser, (req, res) => {
    console.log("mail: " + req.body.mail)
    console.log("commodityName: " + req.body.commodityName)
    const mg = require('mailgun-js')({apiKey: config.mailgun.mailgun_apikey, domain: config.mailgun.mailgun_domain})
    const content = "Dear user: \n" + req.body.commodityName + "(" + req.body.url +") from " + req.body.source + " is on sale."
    prepareEmailContent(content, req.body.mail).then(
        result => {
            console.log(result)
            mg.messages().send(result, (sendError, body) => {
                if (sendError) {
                    res.send('400');
                } else {
                    res.send('200');
                }
            });
        }
    )
});

async function prepareEmailContent(content, destMail) {
    return {
        from: `AppetizerIO <noreply@appetizer.io>`,
        to: [destMail], // [user's email address]
        subject: "[Argus] Decrease Notification",
        html: content  || 'none',
    };
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


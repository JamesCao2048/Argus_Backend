// 功能：用户搜索：python请求后将结果处理成commodity格式，再将结果返回
// 用户将商品添加listen列表：增加 coomodity item, hook item
// 用户查看已有listen列表：获得全部hook信息

// 轮询商品价格：隔断时间遍历hook item中商品信息，并check价格有无变化，若变化，更新商品信息，并发送邮件提醒

// 将商品移除listen列表: 移除hook item
// 查询某商品详细信息(以便查看历史价格走势):返回commodity item
const express = require('express');
const format = require('string-format')
const puppeteer = require('puppeteer');
const cors = require('cors');
const CREDS = require("./creds");
const app_search_amazon = express();
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
app_search_amazon.use(morgan('short', {stream: accessLogStream}));
// app_search_amazon.use(cors());
app_search_amazon.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    )
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PATCH, DELETE, OPTIONS, PUT'
    )
    next()
  })
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
async function get_website_page(url){
    const browser = await puppeteer.launch()
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

app_search_amazon.post('/commodity/search',jsonParser, (req, res) => {
    const query  = req.body.query
    const website = req.body.website
    console.log( 'query: ' + query);
    console.log('website: ' + website);
    amazon_search(query, 5).then(
        result =>{
            res.status(200).send(result)
            }
        )
});

// catch 404
app_search_amazon.use(function (err, req, res, next) {
    next(err);
    res.status(400).end();
});

// entry point
const port = +process.argv[2] || 8088;
app_search_amazon.listen(port, function () {
    console.log('unified-notifier listening on port ' + port);
});


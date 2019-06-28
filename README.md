# Argus_Backend
Backend of Argus

## Usage
First of all, run ```yarn install``` to install all the dependencies.
As microservices architechture has been adopted, you should run
```
node app_mail
```
```
node app_search_amazon
```
```
node app_search_jd
```
to start microservices seperately.
Then services could be accessed in `http://localhost:8087`,`http://localhost:8088`, and `http://localhost:8089`
## Test
Once services are all started, you could run 
```
node test.js
``` 
to test the api, and get the report html in `htmlResults.html` by default.


## commodity
**Post** /commodity/search

根据检索语句，返回购物网站中的相关commodity。
```
{query: "d7200",
}
```
```
{data:[{
    imgurl: String,
    url: String,
    commodityName: String,
    price: Number,
    price_date: String,
    source: String},
]
}

```
**Get** /commodity/all

列出已添加在监控列表中的所有commodity
```
{[{cid： String,
 url: String,
 imgurl: String,
 commodityName: String,
 prices: [Number],
 price_dates: [String],
 source: String
 }，
 ]
}
```

**Get** /commodity?cid=c1

返回已在监控列表中的某个commodity的详细信息
```
{[{cid： String,
 url: String,
 imgurl: String,
 commodityName: String,
 prices: [Number],
 price_dates: [String],
 source: String
 }，
 ]
}
```

**Post** /commodity/add

将某个commodity加入监控列表。url来区别不同commodity，若之前没有，添加新的。若已有，更新prices何price_dates
```
{imgurl: String,
    url: String,
    commodityName: String,
    price: Number,
    price_date: String,
    source: String
}
```
```
{cid： String,
 url: String,
 imgurl: String,
 commodityName: String,
 prices: [Number],
 price_dates: [String],
 source: String
 }
```


## mail
**Post** /mail

向指定邮箱发送商品的降价消息

```
{    
    commodityName: String,
    url: String,
    source: String,
    mail: String
}
```
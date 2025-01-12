import Koa from 'koa' // 使用 import 才有类型提示，require 不行
import onerror from 'koa-onerror'
import bodyparser from 'koa-bodyparser'
import json from 'koa-json'
import logger from 'koa-logger'
import cors from 'koa2-cors'
import sslify from 'koa-sslify'

import { jwtVerify } from './middlewares/jwtVerify'
import index from './routes'
import { notDev } from './utils/env'
import path from 'path'

import koaStatic from 'koa-static'

const app = new Koa()

onerror(app)

if (notDev) {
  // 线上环境使用 HTTPS
  app.use(sslify())
}

// middlewares
// app.use(
//   cors({
//     origin: function (ctx) {
//       // 允许跨域的白名单
//       const whiteList = [
//         'http://attendance.qingkong.xyz',
//         'https://attendance.qingkong.xyz',

//       ]
//       if (ctx.header.referer) {
//         // 去掉 referer 结尾的 /
//         const url = ctx.header.referer.substring(
//           0,
//           ctx.header.referer.length - 1
//         )
//         if (whiteList.includes(url)) {
//           return url
//         }
//       }
//       return 'http://localhost:3000'
//     },
//     // maxAge指定本次预请求的有效期，单位为秒 (Access-Control-Max-Age)
//     // 由于跨域，如果不设置maxAge, 前端每次都会发两个请求，其中一个是预请求，请求类型是options
//     // 设置了maxAge, 只有过期了才需要重新发送预请求
//     maxAge: 3600,
//     // Access-Control-Expose-Headers, 自定义响应头
//     // 允许服务器指示那些响应头可以暴露给浏览器中运行的脚本，以响应跨源请求
//     // 没配置的话，前端axios response.headers 里没有 Authorization
//     exposeHeaders: ['Authorization']
//   })
// )
// 配置静态文件中间件
const staticPath = path.join(__dirname, '../upload')
app.use(koaStatic(staticPath))
app.use(
  cors({
    origin: '*', // 或者指定具体的域名
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept']
  })
)
app.use(
  bodyparser({
    enableTypes: ['json', 'form', 'text']
  })
)
app.use(json()) // 把json字符串转为json对象
app.use(logger())

// logger
app.use(async (ctx: Koa.Context, next: Koa.Next) => {
  const start = new Date()
  await next()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ms = (new Date() as any) - (start as any)
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`)
})

app.use(
  jwtVerify([
    /^\/api\/teacher\/login$/,
    /^\/api\/teacher\/register$/,
    /^\/api\/student\/login$/
  ])
)

// routes
app.use(index.routes()).use(index.allowedMethods())

// error-handling
app.on('error', (err, ctx) => {
  console.error('server error', err, ctx)
})

module.exports = app

import { BrowserWindow } from 'electron'
const request = require('request-promise')
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const lowercaseKeys = require('lowercase-keys')
const parseDomain = require('parse-domain')
let whitelistDomains = []

function ExpressApp (expressServerSettings) {
  let expressServer
  let { port, behindProxy, proxy } = expressServerSettings
  const app = express()
  whitelistDomains = [...expressServerSettings.whitelistDomains]

  const checkDomain = (req, res, next) => {
    let origin = req.get('origin')
    if (!origin) return next() // directly accessed from browser
    let parsedDomain = parseDomain(origin)
    if (!parsedDomain) return next() // localhost
    let domain = parsedDomain.domain + '.' + parsedDomain.tld
    if (whitelistDomains.indexOf(domain) === -1) return res.status(403).send(`Domain : ${domain} is not WhiteListed.`)
    next()
  }
  app.use(cors())
  app.use(checkDomain)
  app.use(bodyParser.json())

  app.get('/', (req, res) => res.send('Bypass CORS is up and running!'))

  app.post('/', (req, res) => {
    let { headers, url, post, fullPageRender, javascript, scrollInterval, debug, cookies } = req.body
    let origin = req.get('origin')
    if (!/^http(s)?:\/\/localhost:/.test(origin)) debug = false
    if (!url) return res.status(500).send('Url is required!')
    if (!headers) return res.status(500).send('Headers are required!')
    if (post && fullPageRender) return res.status(500).send(`Can't combine post and fullPageRender`)

    headers = lowercaseKeys(headers)

    if (fullPageRender) {
      return newBrowserWindow({ headers, url, javascript, scrollInterval, debug, cookies })
        .then(response => res.send(response))
        .catch(error => res.status(500).send(error.message))
    }

    const cookieJar = request.jar()
    if (cookies && cookies.length > 0) setRequestCookies(cookies, cookieJar, url)

    let gzip = !!(headers['accept-encoding'] && /gzip/i.test(headers['accept-encoding']))

    Promise.resolve()
      .then(() => {
        // console.log(headers)
        if (post) {
          return request.post({
            url,
            headers,
            gzip,
            form: post.form,
            followRedirect: false,
            proxy: behindProxy ? proxy : false,
            jar: cookieJar,
            resolveWithFullResponse: true
          })
        }
        return request({
          url,
          headers,
          gzip,
          proxy: behindProxy ? proxy : false,
          jar: cookieJar,
          resolveWithFullResponse: true
        })
      })
      .then(fullResponse => {
        cookies = cookieJar ? cookieJar.getCookies(url) : null
        res.json({ html: fullResponse.body, cookies, fullResponse })
      })
      .catch(error => {
        console.log(error)
        res.status(500).send('Request Failed!')
      })
  })

  expressServer = app.listen(port, () => {
    console.log(`ByPass CORS listening on port ${port}!`)
    let googleRequest = request({ url: 'https://www.google.com/', gzip: true, proxy: behindProxy ? proxy : false })
    let promiseTimeout = new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error('Timeout of ')), 10000)
    })
    Promise.race([googleRequest, promiseTimeout])
      .then(response => expressServer.emit('success'))
      .catch(error => expressServer.emit('error', error.message))
  })
  return expressServer
}

function newBrowserWindow ({ headers, url, javascript, scrollInterval, debug, cookies }) {
  if (scrollInterval !== 0) scrollInterval = scrollInterval || 500
  return new Promise((resolve, reject) => {
    let win = new BrowserWindow({
      width: 1000,
      height: 1000,
      webPreferences: {
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        contextIsolation: true
      },
      show: !!debug
    })
    let userAgent = headers['user-agent']

    let extraHeaders = ''
    for (let headerName in headers) {
      if (headerName !== 'user-agent') {
        extraHeaders += headerName + ':' + headers[headerName] + '\n'
      }
    }
    win.webContents.openDevTools()
    const ses = win.webContents.session
    Promise.resolve()
      .then(() => {
        if (cookies) return setElectronCookies(cookies, ses)
      })
      .then(() => {
        win.loadURL(url, {
          userAgent,
          extraHeaders
        })
      })
      .catch(error => reject(error))

    win.webContents.once('did-finish-load', () => {
      javascript = `(function(){
        ${javascript}
        })()
      function delay(t) {
        return new Promise(function (resolve) {
          setTimeout(resolve, t)
        })
      }
      `
      Promise.race([timeOutReject(10000), win.webContents.executeJavaScript(javascript)])
        .then(result => win.webContents.executeJavaScript(
          `
          (function(){
            return new Promise((resolve,reject)=>{
              totalHeight = document.body.scrollHeight
              for (let i = 0; i<totalHeight ; i+= 1000  ) {
                setTimeout(()=> {
                    window.scrollTo({ top: i, behavior: 'smooth' })
                    if( i + 1000 > totalHeight ) resolve(document.documentElement.innerHTML)
                }, ${scrollInterval} * i/1000)
              }
            })
          })()
        `)
          .then(html => {
            ses.cookies.get({}, (error, cookies) => {
              if (error) return reject(error)
              resolve({ html, cookies })
              ses.clearStorageData()
            })
          })
        )
        .catch(error => {
          reject(error)
        })
        .then(() => {
          if (!debug) {
            win.destroy()
            win = null
          }
        })
    })
  })
}

function timeOutReject (t) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error('Javascript execution timeout.'))
    }, t)
  })
}

function setElectronCookies (cookies, ses) {
  return new Promise((resolve, reject) => {
    cookies = cookies.filter(cookie => cookie.key || cookie.name)
    cookies.forEach(cookie => {
      if (cookie.key) {
        cookie.name = cookie.key
        delete cookie.key
      }
      const scheme = cookie.secure ? 'https' : 'http'
      const host = cookie.domain[0] === '.' ? cookie.domain.substr(1) : cookie.domain
      cookie.url = scheme + '://' + host
      ses.cookies.set(cookie, setCookieCb)
    })
    let cbCntr = 0
    function setCookieCb (error) {
      if (error) {
        console.log(cbCntr, error)
        return reject(error)
      }
      cbCntr++
      if (cbCntr === cookies.length) {
        resolve()
      }
    }
  })
}

function setRequestCookies (cookies, cookieJar, url) {
  cookies.forEach(cookie => {
    if (cookie.name) {
      cookie.key = cookie.name
      delete cookie.name
    }
    const requestCookie = request.cookie(`${cookie.key}=${cookie.value}`)
    cookieJar.setCookie(requestCookie, url)
  })
}

export { ExpressApp }

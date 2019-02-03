const request = require('request-promise')
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

module.exports = function (port,whitelistDomains) {
  const app = express()
  var corsOptions = {
    origin: function (origin, callback) {
      // when user access directly in his browser the bypass cors url, origin is undefined
      if(!origin) return callback(null, true)
      if (whitelistDomains.indexOf(origin) !== -1) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    }
  }
  app.use(cors(corsOptions))
  app.use(bodyParser.json())

  app.get('/', (req, res) => res.send('Bypass CORS is up and running!'))

  app.post('/', (req, res) => {
    let { headers, url } = req.body
    if(!url) return res.status(500).send('Url is required!')
    if(!headers) return res.status(500).send('Headers are required!')
    let gzip = headers['Accept-Encoding'] && headers['Accept-Encoding'].indexOf('gzip') !== -1 ? true : false
    request({ url, headers, gzip, resolveWithFullResponse: true })
      .then(response => res.json(response))
      .catch(error => res.send(error))
  })

  let expressServer = app.listen(port, () => console.log(`ByPass CORS listening on port ${port}!`))
  return expressServer
}
var http = require('http')
var util = require('util')
var path = require('path')
var fs = require('fs')

var express = require('express')
var validator = require('express-validator')
var bodyParser = require('body-parser')
var formidable = require('formidable')
var Promise = require('bluebird')
var uuid = require('uuid')
var AWS = require('aws-sdk')

var logger = require('../../util/logger')

module.exports = function(options) {
  var log = logger.createLogger('storage:s3')
  var app = express()
  var server = http.createServer(app)
  log.info(options)
  var s3 = new AWS.S3({
    apiVersion: '2006-03-01'
    , accessKeyId: options.awsAccessKeyId
    , secretAccessKey: options.awsSecretAccessKey
    , region: options.awsRegion
  })

  app.set('strict routing', true)
  app.set('case sensitive routing', true)
  app.set('trust proxy', true)

  app.use(bodyParser.json())
  app.use(validator())

  function putObject(plugin, file) {
    return new Promise(function(resolve, reject) {
      var id = uuid.v4()
      var params = {
        Bucket: options.bucket
        , Key: id
        , ACL: 'public-read'
        , ContentType: 'application/octet-stream'
        , Metadata: {
            plugin: plugin
          , name: file.name
        }
        , Body: fs.createReadStream(file.path)
      }
      s3.upload(params, function(err) {
        log.error(err)
        if (err) {
          log.error(
            'Unable to store "%s" as "%s/%s"'
          , file.path
          , options.bucket
          , id
          , err.stack
          )
          reject(err)
          return
        }
        log.info('Stored "%s" as "%s/%s"', file.name, options.bucket, id)
        resolve(id)
      })
    })
  }

  function getHref(plugin, id, name) {
    return util.format(
      '/s/%s/%s%s'
    , plugin
    , id
    , name ? '/' + path.basename(name) : ''
    )
  }

  app.post('/s/upload/:plugin', function(req, res) {
    var form = new formidable.IncomingForm()
    var plugin = req.params.plugin
    Promise.promisify(form.parse, form)(req)
      .spread(function(fields, files) {
        var requests = Object.keys(files).map(function(field) {
          var file = files[field]
          log.info('Uploading "%s" from "%s"', file.name, file.path)
          return putObject(plugin, file)
            .then(function(id) {
              return {
                field: field
              , id: id
              , name: file.name
              , temppath: file.path
              }
            })
        })
        return Promise.all(requests)
      })
      .then(function(storedFiles) {
        res.status(201).json({
          success: true
        , resources: (function() {
            var mapped = Object.create(null)
            storedFiles.forEach(function(file) {
              mapped[file.field] = {
                date: new Date()
              , plugin: plugin
              , id: file.id
              , name: file.name
              , href: getHref(plugin, file.id, file.name)
              }
            })
            return mapped
          })()
        })
        return storedFiles
      })
      .then(function(storedFiles) {
        return Promise.all(storedFiles.map(function(file) {
          return Promise.promisify(fs.unlink, fs)(file.temppath)
            .catch(function(err) {
              log.warn('Unable to clean up "%s"', file.temppath, err.stack)
              return true
            })
        }))
      })
      .catch(function(err) {
        log.error('Error storing resource', err.stack)
        res.status(500)
          .json({
            success: false
          , error: 'ServerError'
          })
      })
  })

  app.get('/s/blob/:id/:name', function(req, res) {
    var params = {
      Key: req.params.id
    , Bucket: options.bucket
    }

    s3.getObject(params, function(err, data) {
      if (err) {
        log.error('Unable to retrieve "%s"', path, err.stack)
        res.sendStatus(404)
        return
      }

      res.set({
        'Content-Type': data.ContentType
      })

      res.send(data.Body)
    })
  })

  server.listen(options.port)
  log.info('Listening on port %d', options.port)
}

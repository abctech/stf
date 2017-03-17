module.exports.command = 'storage-s3'

module.exports.describe = 'Start an S3 storage unit.'

module.exports.builder = function(yargs) {
  return yargs
    .env('STF_STORAGE_S3')
    .strict()
    .option('bucket', {
      describe: 'S3 bucket name.'
    , type: 'string'
    , demand: true
    })
    .option('aws-access-key-id', {
      describe: 'AWS Access Key.'
    , type: 'string'
    , demand: true
    })
    .option('aws-secret-access-key', {
      describe: 'AWS Secret.'
    , type: 'string'
    , demand: true
    })
    .option('aws-region', {
      describe: 'AWS region.'
    , type: 'string'
    , default: 'ap-southeast-1'
    })
    .option('port', {
      alias: 'p'
    , describe: 'The port to bind to.'
    , type: 'number'
    , default: process.env.PORT || 7100
    })
    .epilog('Each option can be be overwritten with an environment variable ' +
      'by converting the option to uppercase, replacing dashes with ' +
      'underscores and prefixing it with `STF_STORAGE_S3_` (e.g. ' +
      '`STF_STORAGE_S3_PROFILE`).')
}

module.exports.handler = function(argv) {
  return require('../../units/storage/s3')({
    port: argv.port
  , bucket: argv.bucket
  , awsAccessKeyId: argv.awsAccessKeyId
  , awsSecretAccessKey: argv.awsSecretAccessKey
  , awsRegion: argv.awsRegion
  })
}

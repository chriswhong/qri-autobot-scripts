const fs = require('fs-extra')
const util = require('util')
const { spawn } = require('child_process')
const fetch = require('node-fetch')
const FormData = require('form-data')
const streamPipeline = util.promisify(require('stream').pipeline)


require('dotenv').config()

fs.ensureDirSync('./data')

const downloadLatest = async ({ username, dsname, filePath, qriHost }) => {
  return new Promise(async (resolve, reject) => {
    console.log('download')
    const response = await fetch(`https://s3.amazonaws.com/nyc-mta-elevator-outages/mta_elevator_outages.csv`)
    if (!response.ok) {
      fs.createWriteStream(filePath).write(headerRow)
    } else {
      await streamPipeline(response.body, fs.createWriteStream(filePath))
    }
    resolve()
  })
}

const qriSaveAndPublish = async (options) => {
  return new Promise( async (resolve, reject) => {
    try {
      const { username, dsname, filePath, qriHost } = options
      console.log(fs.createReadStream(filePath))

      // create/update the qri dataset using a cloud-hosted qri instance
      let formData = new FormData()
      formData.append('body', fs.createReadStream(filePath))
      formData.append('peername', username)
      formData.append('name', dsname)

      // save
      console.log(`saving qri dataset ${username}/${dsname}...`)
      await fetch(`${qriHost}/save`, {
        method: 'POST',
        body: formData
      })
        .then((res) => {
          console.log(res)
          return res
        })
        .then(res => res.json())
        .then(json => console.log(json))

      // push
      console.log(`pushing qri dataset ${username}/${dsname}...`)
      await fetch(`${qriHost}/push/${username}/${dsname}`, {
        method: 'POST'
      })

      resolve()
    } catch(e) {
      reject(e)
    }

  })
}


(async () => {
  const options = {
    username: 'qri-autobot',
    dsname: 'nyc-subway-elevators',
    filePath: 'data/elevators.csv',
    qriHost: 'http://qri-autobot.chriswhong.com:2503'
  }
  try {
    // save the current dataset body as a CSV
    await downloadLatest(options)

    // commit and push to qri cloud
    await qriSaveAndPublish(options)
  } catch(e) {
    console.log('Something went wrong', e)
  }
})().catch(err => {
    console.error(err);
});

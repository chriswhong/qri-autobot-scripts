const fs = require('fs-extra')
const util = require('util')
const { spawn } = require('child_process')
const fetch = require('node-fetch')
const FormData = require('form-data')
const streamPipeline = util.promisify(require('stream').pipeline)


require('dotenv').config()

const delay = ms => new Promise(res => setTimeout(res, ms));

const headerRow = 'timestamp, name, main, description, temp, feels_like, pressure, humidity, visibility, wind_speed, wind_degrees\n'

fs.ensureDirSync('./data')

const downloadLatest = async ({ username, dsname, filePath, qriHost }) => {
  return new Promise(async (resolve, reject) => {
    console.log('download')
    const response = await fetch(`${qriHost}/body/${username}/${dsname}?download=true`)
    if (!response.ok) {
      fs.createWriteStream(filePath).write(headerRow)
    } else {
      await streamPipeline(response.body, fs.createWriteStream(filePath))
    }
    resolve()
  })
}

const updateCSV = async ({ filePath }) => {
  return new Promise(async (resolve, reject) => {
    // call to openweathermap api, Brooklyn NY city id is 5110302
    const apiCall = `https://api.openweathermap.org/data/2.5/weather?id=5110302&appid=${process.env.OPENWEATHERMAP_API_KEY}`

    const response = await fetch(apiCall)
     .then(res => res.json())

    console.log(response)

    const { dt, name, weather, main, wind, visibility } = response
    const [{ main: mainWeather, description }] = weather
    const { temp, feels_like, pressure, humidity } = main
    const { speed: wind_speed, deg: wind_degrees } = wind

    // append a line to the CSV
    const newLine = `"${new Date(dt * 1000).toISOString()}","${name}","${mainWeather}","${description}",${temp},${feels_like},${pressure},${humidity},${visibility},${wind_speed},${wind_degrees}\n`
    fs.appendFileSync(filePath, newLine)
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
    dsname: 'brooklyn-hourly-weather',
    filePath: 'data/brooklyn.csv',
    qriHost: 'http://qri-autobot.chriswhong.com:2503'
  }
  try {
    // save the current dataset body as a CSV
    await downloadLatest(options)

    // append a row with current weather data
    await updateCSV(options)

    // commit and push to qri cloud
    await qriSaveAndPublish(options)
  } catch(e) {
    console.log('Something went wrong')
  }
})().catch(err => {
    console.error(err);
});

const fs = require('fs-extra')
const util = require('util')
const { spawn } = require('child_process')
const fetch = require('node-fetch')
const FormData = require('form-data')
const streamPipeline = util.promisify(require('stream').pipeline)


require('dotenv').config()

const delay = ms => new Promise(res => setTimeout(res, ms));

const headerRow = 'response_time,recorded_at_time,line_ref,direction_ref,vehicle_ref,block_ref,longitude,latitude,passenger_count,passenger_capacity\n'

fs.ensureDirSync('./data')

const downloadLatest = async ({ username, dsname, filePath, qriHost }) => {
  return new Promise(async (resolve, reject) => {
    console.log('download')
    const response = await fetch(`${qriHost}/get/${username}/${dsname}/body.csv?all=true`)
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
    // call mta SIRI api
    const apiCall = `http://bustime.mta.info/api/siri/vehicle-monitoring.json?key=${process.env.MTA_API_KEY}&version=2`

    const response = await fetch(apiCall)
     .then(res => res.json())

    const {
      VehicleMonitoringDelivery: vehicleMonitoringDelivery
    } = response.Siri.ServiceDelivery

    console.log(vehicleMonitoringDelivery)

    const vmd = vehicleMonitoringDelivery[0].VehicleActivity
    const response_time = vehicleMonitoringDelivery[0].ResponseTimestamp

    const observations = vmd.map((d) => {
      const {
        MonitoredVehicleJourney,
        // ResponseTimestamp: response_timestamp,
        RecordedAtTime: recorded_at_time
      } = d

      const {
        LineRef: line_ref,
        DirectionRef: direction_ref,
        OriginRef: origin_ref,
        DesintationRef: destination_ref,
        VehicleLocation,
        VehicleRef: vehicle_ref,
        BlockRef: block_ref,
        MonitoredCall
      } = MonitoredVehicleJourney

      const {
        Longitude: longitude,
        Latitude: latitude
      } = VehicleLocation

      let passenger_count = null
      let passenger_capacity = null

      if (MonitoredCall && MonitoredCall.Extensions && MonitoredCall.Extensions.Capacities) {
        passenger_count = MonitoredCall.Extensions.Capacities.EstimatedPassengerCount
        passenger_capacity = MonitoredCall.Extensions.Capacities.EstimatedPassengerCapacity
      }

      const observation = {
        response_time,
        recorded_at_time,
        line_ref,
        direction_ref,
        vehicle_ref,
        block_ref,
        longitude,
        latitude,
        passenger_count,
        passenger_capacity
      }

      return observation
    })

    console.log(observations)

    // append new lines to CSV
    const newLines = observations.map((d) => {
      const values = []
      Object.keys(d).forEach((key) => { values.push(d[key]) })
      console.log(values)

      return values.join(',')
    })

    console.log(newLines)

    fs.appendFileSync(filePath, newLines.join('\n'))
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
    dsname: 'nyc-bus-capacity',
    filePath: 'data/buses.csv',
    qriHost: 'http://autobot.qri.cloud'
  }
  try {
    // save the current dataset body as a CSV
    console.log('downloading latest version of the dataset')
    await downloadLatest(options)

    // append a row with current weather data
    await updateCSV(options)

    // // commit and push to qri cloud
    await qriSaveAndPublish(options)
  } catch(e) {
    console.log('Something went wrong')
  }
})().catch(err => {
    console.error(err);
});

# qri_weather_bot

Nodejs script for automated update of a qri weather dataset

## How It Works

This repo contains a nodejs script `weather.js` that does the following:

1. Pull the latest version of the qri dataset [`qri-autobot/brooklyn-hourly-weather`](https://qri.cloud/qri-autobot/brooklyn-hourly-weather), save it to CSV

2. Hit the openweathermap api, getting current weather data for Brooklyn, NY.

3. Append a new row of data to the CSV from #1.

4. Commit a new version of the dataset and publish it to qri cloud.

## CircleCI

We make use of circleci scheduled workflows to run this script once an hour. See `.circleci/config.yaml` to see how the job `build` is defined, and then run hourly using cron syntax.

## Environment variables

Ensure that `OPENWEATHERMAP_API_KEY` is set to your openweathermap api key and available in your circleci project.  To run locally, create a `.env` file in the root of this repo with `OPENWEATHERMAP_API_KEY=somereallylongkey`


## Cloud Qri Instance

The script makes use of a qri instance hosted in the cloud.  The node code communicates with the qri instance via an http API.  This approach means that we don't need to worry about building or spinning up qri in the CI container.  As long as we can get to the internet, we can get/commit/push the dataset from an ephemeral container.

# qri_weather_bot

Node scripts and a dockerfile for automatically committing new rows to a Qri dataset.

## How It Works

`start.sh` is fired every X minutes using a cron job.  It starts the qri docker container, runs `weather.js`, and stops the container.

`weather.js` calls the openweathermap api and gets current data for Brooklyn.  It parses the JSON response and creates a single new row, appending it to `brooklyn.csv`.
Next, it calls `qri save --body ./brooklyn.csv me/brooklyn` to create a new commit based on the latest data.  It then calls `qri publish me/brooklyn', pushing the new commit to Qri Cloud.

## Build the Docker Container

`docker build . -t qri_weather_bot` in this directory will build the image, installing qri from source and running `qri init`.  This sets up the ipfs node and qri repo with a programmatically generated peername.

## Run the Container

When running the container, a volume is used to provide a different `config.yaml` than the one created when the image is built.  (Volumes are mounted for the .qri directory and the scripts directory)

`docker run -d -v ~/qri_weather_bot/.qri:/root/.qri -v ~/qri_weather_bot/js:/root/js --name qri_weather_bot qri_weather_bot`


## Registry Handshake

There is a manual step necessary to create a custom peername (versus the auto-generated one that will exist when first running the container) and register a new user with qri.cloud

The config.yaml was created by manually running `qri init --peername qri_weather_bot` and then registering with qri.cloud using curl:

```
curl 'http://localhost:2503/registry/profile/new' -H 'Accept: application/json' -H 'Content-Type: application/json' --data-binary '{"username":"qri_weather_bot","email":"qri_weather_bot@qri.io","password":"somepassword"}'

```

// ====================================================
// ./src/engine.js
// ====================================================

// ====================================================
// import the roadshow-demo-generator module dependencies
// ====================================================
require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const csv = require('csvtojson');
const Bottleneck = require("bottleneck");
const axiosRetry = require("axios-retry");
const dse = require('dse-driver');
const TimeUuid = require('dse-driver').types.TimeUuid;

// ====================================================
// define the express app
// ====================================================
const app = express();
app.use(express.json());
app.set("views", path.join(__dirname, "views"));

// ====================================================
// function to read in data csv file
// ====================================================
function getFile(){
  return new Promise (function(resolve,reject){
    // read the csv file into a json object
    csv().fromFile(csvFilePath)
    .then(jsonObj => resolve(jsonObj))
    .catch(error => console.log('error reading file', error));
  })
};

// ====================================================
// function to generate random transactions for the shop
// ====================================================
function generateTrx(jsonObj){
  return new Promise (function(resolve,reject){
    let number_firstname = Math.floor(Math.random() * jsonObj.length);
    let number_lastname = Math.floor(Math.random() * jsonObj.length);
    let number_lastnameXtra = Math.floor(Math.random() * 5);
    let number_domain = Math.floor(Math.random() * 10);
    let number_dotcom = Math.floor(Math.random() * 10);
    let number_prodDesc = Math.floor(Math.random() * 35);
    // for each row in the file get each comma seperated value using the random index value
    let timeuuid = TimeUuid.now();
    let firstname = (Object.values(jsonObj)[number_firstname].firstname);
    let lastname = (Object.values(jsonObj)[number_lastname].lastname);
    let lastnameXtra = (Object.values(jsonObj)[number_lastnameXtra].lastname_xtra);
    let domain = (Object.values(jsonObj)[number_domain].domain);
    let dotcom = (Object.values(jsonObj)[number_dotcom].dotcom);
    let prod_desc = (Object.values(jsonObj)[number_prodDesc].prod_desc);
    let email = firstname + "." + lastname + "-" + lastnameXtra + "@" + domain + "." + dotcom;
    // create a random price for this product
    let price = Math.floor(Math.random() * 500);
    // create the return json string
    let trx = {"timeuuid": timeuuid, "firstname": firstname,"lastname": lastname,"email": email,"prod_desc": prod_desc,"price": price};
    resolve(trx)
    .catch(error => console.log('error generating transaction',error));
  });
};

// ====================================================
// function used to add delay loop (to prevent the local machine from running out of memory)
// ====================================================
function timeout(ms){
  return new Promise (function(resolve,reject){
    try {
      setTimeout(resolve,ms)
    } catch{
      console.log('timeout error',err);
    }
  });
};

// ====================================================
// async function that awaits the result of the random transaction function and then posts it to the remote api
// ====================================================
async function postTransactions(jsonObj){
  console.log('STARTING: roadshow-demo-generator');
  for (let i = 0; i < dbWrites; i++) {
    //console.log('transaction number: '+ i + ' with ms loop delay of: ' + process.env.TRX_TIMEOUT_MS);
    let genTrx = await generateTrx(jsonObj);
    limiter.schedule(() => axios.post(process.env.API_IP_PORT + '/write/', genTrx))
    .then((result) => {console.log('Success writing: ' + i + ' ' + genTrx.email)})
    .then(await timeout(parseInt(process.env.TRX_TIMEOUT_MS)))
    .catch(error => console.log('limiter error',error));
  };
};

// ====================================================
// async function that awaits the file object and then calls the main loop to generate transaction POST api calls
// ====================================================
async function main(){
  const jsonObj = await getFile()
  .then(await timeout(2000))
  .then(console.log('csv file has been read'))
  .catch(error => console.log(error));
  const trx = postTransactions(jsonObj)
  .catch(error => console.log(error));
}

// ====================================================
// defineable parameters - set in .env
// if running this script via cluster.js - then process.env.DB_WRITES will be multiplied by available CPUs
// ====================================================
const dbWrites = process.env.DB_WRITES;
const csvFilePath= process.env.CSV_PATH;
const limiter = new Bottleneck({
  maxConcurrent: process.env.BOTTLENECK_MAXCONCURRENT,
  minTime: process.env.BOTTLENECK_MINTIME
});
if (process.env.AXIOS_RETRY = "exponentialDelay") {
  axiosRetry(axios,{ retryDelay: axiosRetry.exponentialDelay});
} else {
  axiosRetry(axios, {retries: parseInt(process.env.AXIOS_RETRY)});
}

// ====================================================
// GO!
// ====================================================
main();

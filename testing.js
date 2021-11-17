const Binance = require('node-binance-api');
const colors = require('colors');
const APIKEY = process.env.APIKEY;
const APISECRET = process.env.APISECRET;

const binance = new Binance().options({
  APIKEY,
  APISECRET,
  useServerTime: true,
  recvWindow: 60000,
  verbose: true
});

binance.balance((err, res) => {
  if (err) {
    console.log(err);
  } else {
    console.log(res);
    console.log('balance'.green);
  }
});

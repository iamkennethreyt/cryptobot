const Binance = require('node-binance-api');
const APISECRET = process.env.APISECRET; //API SECRET
const APIKEY = process.env.APIKEY; //API KEY
const SYMBOL = process.env.SYMBOL || 'SANTOSBUSD';
const loop = process.env.LOOP || 2400;
const quantity = process.env.QUANTITY || 45;
const milisecond = process.env.MILISECONDS || 50;
const price = process.env.PRICE || 5;

const binance = new Binance().options({
  APIKEY,
  APISECRET,
  useServerTime: true,
  recvWindow: 6000,
  verbose: true
});

const buy = () => {
  binance.useServerTime();
  for (let i = 1; i <= loop; i++) {
    setTimeout(() => {
      binance.buy(SYMBOL, quantity, price, { type: 'LIMIT' }, (err, res) => {
        if (err) {
          console.log(JSON.parse(err.body).msg, i);
        } else {
          console.log(res);
        }
      });
    }, i * milisecond);
  }
};

const sell = () => {
  const sellQty = 45; //40 SANTOS available balance
  const sellPrice = 20; //10 SANTOS

  binance.sell(SYMBOL, sellQty, sellPrice, (err, res) => {
    if (err) {
      console.log(JSON.parse(err.body).msg);
    } else {
      console.log(res);
    }
  });
};

buy();

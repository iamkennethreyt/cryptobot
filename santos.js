const Binance = require('node-binance-api');
const APISECRET = process.env.APISECRET; //API SECRET
const APIKEY = process.env.APIKEY; //API KEY
const SYMBOL = 'SANTOSBUSD';

const binance = new Binance().options({
  APIKEY,
  APISECRET,
  useServerTime: true,
  recvWindow: 60000,
  verbose: true
});

const loop = 12000;
const quantity = 45;
const milisecond = 10;
const price = 5;

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

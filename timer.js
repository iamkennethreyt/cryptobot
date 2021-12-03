const Binance = require('node-binance-api');
const APISECRET = process.env.APISECRET; //API SECRET
const APIKEY = process.env.APIKEY; //API KEY
const SYMBOL = process.env.SYMBOL || 'COCOSBUSD';
const loop = process.env.LOOP || 300;
const quantity = process.env.QUANTITY || 54;
const milisecond = process.env.MILISECONDS || 10;
const price = process.env.PRICE || 3.2; //PRICE TO BUY
const ETA = new Date(2021, 11, 03, 16, 59, 59).getTime() - Date.now();

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

setTimeout(() => {
  buy();
}, ETA);

const sell = () => {
  const sellQty = 15; //40 SANTOS available balance
  const sellPrice = 15; //10 SANTOS

  binance.sell(SYMBOL, sellQty, sellPrice, (err, res) => {
    if (err) {
      console.log(JSON.parse(err.body).msg);
    } else {
      console.log(res);
    }
  });
};

// sell();

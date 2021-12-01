const Binance = require('node-binance-api');
// const items = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'S'];
// for (let i = 1; i <= 60; i++) {
//   const item = items[Math.floor(Math.random() * items.length)];
//   setTimeout(() => {
//     console.log(item);
//   }, i * 1000);
// }
const APISECRET = process.env.APISECRET; //API SECRET
const APIKEY = process.env.APIKEY; //API KEY
const SYMBOL = process.env.SYMBOL || 'SANTOSBUSD'; //SYMBOL

const binance = new Binance().options({
  APIKEY,
  APISECRET,
  useServerTime: true,
  recvWindow: 60000,
  verbose: true
});

const quantity = 10;
const price = 5;

const buy = () => {
  binance.useServerTime();
  for (let i = 1; i <= 1000; i++) {
    // const item = items[Math.floor(Math.random() * items.length)];
    setTimeout(() => {
      binance.buy(SYMBOL, quantity, price, { type: 'LIMIT' }, (err, res) => {
        if (err) {
          console.log(JSON.parse(err.body).msg, i);
        } else {
          console.log(res);
        }
      });
    }, i * 300);
  }
};

const sell = () => {
  const sellQty = 40; //40 SANTOS available balance
  const sellPrice = 10; //10 SANTOS

  binance.sell(SYMBOL, sellQty, sellPrice, (err, res) => {
    if (err) {
      console.log(JSON.parse(err.body).msg);
    } else {
      console.log(res);
    }
  });
};

buy();

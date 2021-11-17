const Binance = require('node-binance-api');
const axios = require('axios');
const colors = require('colors');
const baseUrl = 'https://api.binance.com/api/v3/ticker/price';
const API = 'https://api3.binance.com/api/v3/klines?';

const APISECRET = process.env.APISECRET;
const APIKEY = process.env.APIKEY;
const SYMBOL = process.env.SYMBOL || 'SHIBBUSD';
const PERCENTCAPITAL = process.env.PERCENTCAPITAL || 100;
const INTERVAL = process.env.INTERVAL || '1m';
const LIMIT = process.env.LIMIT || 10;
const PERCENTBUY = process.env.PERCENTBUY;
const PERCENTSELL = process.env.PERCENTSELL;
const PRICELIMIT = process.env.PRICELIMIT;
const CRYPTO = process.env.CRYPTO || 'SHIB';

const binance = new Binance().options({
  APIKEY,
  APISECRET,
  useServerTime: true,
  recvWindow: 60000,
  verbose: true
});
const border =
  '\n=============================================================\n';

const avg = async (data, x) =>
  (await data.reduce((r, c) => r + parseFloat(c[x]), 0)) / data.length;

const currentPrice = async () => {
  const res = await axios.get(`${baseUrl}`, {
    params: { symbol: SYMBOL }
  });

  return res.data.price;
};

const fetch = async () => {
  const res = await axios.get(API, {
    params: {
      symbol: SYMBOL,
      interval: INTERVAL,
      limit: LIMIT
    }
  });
  return res.data;
};

const buy = async () => {
  const currPrice = await currentPrice();
  if (currPrice >= PRICELIMIT) {
    console.log('UNEABLE TO TRANSACT, PRICELIMIT EXCEDED');
    return;
  }

  const prevHighPer = await previousHighPercent();
  const data = await fetch();
  const open = await avg(data, 1);
  const low = await avg(data, 3);
  const high = await avg(data, 2);
  const aveHigh = PERCENTSELL || (await ((high / open) * 100 - 100));

  if (prevHighPer > aveHigh) {
    console.log('AVERAGE HIGH PERCENT IS GREATER THAT PREVIOUS HIGH PERCENT');
    return;
  }
  PERCENTBUY && console.log('PERCENT BUY PARAM EXIST : ', PERCENTBUY);

  const aveLow = PERCENTBUY || (await (100 - (100 * low) / open).toFixed(2));
  console.log(aveLow);

  console.log(prevHighPer);

  // binance.balance(async (err, bal) => {
  //   if (err) {
  //     console.log(err);
  //   } else {
  //     const currPrice = await currentPrice();
  //     const curBalance = bal.BUSD.available;
  //     const pricetoBuy = (
  //       ((100 - parseFloat(aveLow)) * currPrice) /
  //       100
  //     ).toFixed(8);
  //     const capital = curBalance * (PERCENTCAPITAL / 100);

  //     console.log(currPrice, 'currPrice');
  //     console.log(pricetoBuy, 'pricetoBuy');
  //     console.log(aveLow, 'aveLow');
  //     console.log(PERCENTCAPITAL, 'PERCENTCAPITAL');
  //     console.log(capital, 'capital');

  //     const amount = capital / pricetoBuy;
  //     const amountRnd = Math.floor(amount);

  //     await binance.buy(
  //       SYMBOL,
  //       amountRnd,
  //       pricetoBuy,
  //       { type: 'LIMIT' },
  //       (err, res) => {
  //         if (err) {
  //           console.error(err.body.red);
  //         } else {
  //           console.info(`Successfully added Buy \nPrice : ${res.price}`.green);
  //         }
  //       }
  //     );
  //     return;
  //   }
  //   return;
  // });
};

const sell = async () => {
  const data = await fetch();
  const open = await avg(data, 1);
  const high = await avg(data, 2);
  PERCENTSELL && console.log('PERCENT SELL PARAM EXIST : ', PERCENTSELL);
  const aveHigh = PERCENTSELL || (await ((high / open) * 100 - 100).toFixed(2));
  binance.balance(async (err, bal) => {
    if (err) {
      console.log(err);
    } else {
      await binance.trades(SYMBOL, (err, prevTransact) => {
        if (!err) {
          const prevBuy = prevTransact.slice(-1)[0].price;
          const curBalance = bal[CRYPTO].available;
          const pricetoSell = (
            ((100 + parseFloat(aveHigh)) * prevBuy) /
            100
          ).toFixed(8);
          const amountRnd = Math.floor(curBalance);
          console.log(prevBuy, 'prevBuy');
          console.log(pricetoSell, 'pricetoSell');
          console.log(aveHigh, 'aveHigh');
          binance.sell(
            SYMBOL,
            amountRnd,
            pricetoSell,
            { type: 'LIMIT' },
            (err, res) => {
              if (err) {
                console.error(err.body.red);
              } else {
                console.info(
                  `Successfully added Sell \nPrice : ${res.price}`.green
                );
              }
            }
          );
        }
      });

      return;
    }
    return;
  });
};

const previousHighPercent = async () => {
  const res = await axios.get(API, {
    params: {
      symbol: 'SHIBBUSD',
      interval: '1m',
      limit: 1
    }
  });
  const data = res.data[0];
  const output = (data[2] / data[1]) * 100 - 100;
  return output;
};

const myfunc = async () => {
  await binance.useServerTime();
  await binance.openOrders(false, (err, openOrders) => {
    if (err) {
      console.error(err);
    } else {
      console.error(border, openOrders, border);
      if (openOrders.length === 0) {
        console.log(border, 'BUY/SELL', border);
        binance.trades(SYMBOL, (err, res) => {
          if (err) {
            console.log(err);
            return;
          } else {
            if (res.slice(-1)[0].isBuyer) {
              sell();
              return;
            } else {
              buy();
              return;
            }
          }
        });
      } else {
        if (openOrders[0].side === 'SELL') {
          console.log(
            border,
            'PENDING TRANSACTION IS SELL, no trade available',
            border
          );
          return;
        } else {
          console.log(border, 'CANCEL ORDER', border);
          binance.cancelAll(SYMBOL, (err, res) => {
            if (err) {
              console.log(err);
              return;
            } else {
              console.info('Successfully cancel trade'.green);
              console.info(`Previous trade [${res[0].side}]`.blue);
              buy();
            }
          });
          console.log(border, 'BUY NEW', border);
        }
      }
    }
  });
};

// myfunc();
buy();

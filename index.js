const Binance = require('node-binance-api');
const axios = require('axios');
const colors = require('colors');
const APIKEY = process.env.APIKEY;
const APISECRET = process.env.APISECRET;
const baseUrl = 'https://api.binance.com/api/v3/ticker/price';

const SYMBOL = process.env.SYMBOL || 'SHIBBUSD';
const PERCENTBUY = process.env.PERCENTBUY || 1;
const PERCENTSELL = process.env.PERCENTSELL || 1;
const PERCENTCAPITAL = process.env.PERCENTCAPITAL || 25;

console.log('API-KEY', APIKEY);
console.log('API-SECRET', APISECRET);
const binance = new Binance().options({
  APIKEY,
  APISECRET,
  useServerTime: true,
  recvWindow: 60000,
  verbose: true
});
const border =
  '\n=============================================================\n';

const currentPrice = async () => {
  const res = await axios.get(`${baseUrl}`, {
    params: { symbol: SYMBOL }
  });

  return res.data.price;
};

const buy = () => {
  binance.balance(async (err, bal) => {
    if (err) {
      console.log(err);
    } else {
      const currPrice = await currentPrice();
      const curBalance = bal.BUSD.available;
      const pricetoBuy = (
        ((100 - parseFloat(PERCENTBUY)) * currPrice) /
        100
      ).toFixed(8);
      const capital = curBalance * (PERCENTCAPITAL / 100);

      console.log(currPrice, 'currPrice');
      console.log(pricetoBuy, 'pricetoBuy');
      console.log(PERCENTBUY, 'PERCENTBUY');
      console.log(PERCENTCAPITAL, 'PERCENTCAPITAL');
      console.log(capital, 'capital');

      const amount = capital / pricetoBuy;
      const amountRnd = Math.floor(amount);

      await binance.buy(
        SYMBOL,
        amountRnd,
        pricetoBuy,
        { type: 'LIMIT' },
        (err, res) => {
          if (err) {
            console.error(err.body.red);
          } else {
            console.info(`Successfully added Buy \nPrice : ${res.price}`.green);
          }
        }
      );
      return;
    }
    return;
  });
};

const sell = () => {
  binance.balance(async (err, bal) => {
    if (err) {
      console.log(err);
    } else {
      const currPrice = await currentPrice();
      const curBalance = bal.SHIB.available;
      const pricetoSell = (
        ((100 + parseFloat(PERCENTSELL)) * currPrice) /
        100
      ).toFixed(8);
      const amountRnd = Math.floor(curBalance);
      console.log(currPrice, 'currPrice');
      console.log(pricetoSell, 'pricetoSell');
      console.log(PERCENTSELL, 'PERCENTSELL');

      await binance.sell(
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
      return;
    }
    return;
  });
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

myfunc();

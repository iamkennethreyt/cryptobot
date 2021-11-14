const Binance = require('node-binance-api');
const axios = require('axios');
const colors = require('colors');

//ENVIRONMENT VARIABLES
const APIKEY = process.env.APIKEY;
const APISECRET = process.env.APISECRET;
const SYMBOL = process.env.SYMBOL || 'SHIBBUSD';
const PERCENTBUY = process.env.PERCENTBUY || 2;
const PERCENTCAPITAL = process.env.PERCENTCAPITAL || 100;

const baseUrl = 'https://api.binance.com/api/v3/ticker/price';

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

      console.log('Current Price : ', currPrice);
      console.log('Price to Buy  : ', pricetoBuy);
      console.log('Percent  Buy  : ', PERCENTBUY);
      console.log('Percent Capital ', PERCENTCAPITAL);
      console.log('Capital         ', capital, border);

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

const myfunc = async () => {
  await binance.useServerTime();
  await binance.openOrders(false, (err, openOrders) => {
    if (err) {
      console.error(err);
    } else {
      if (openOrders.length === 0) {
        console.log(border, 'BUY', border);
        binance.trades(SYMBOL, (err, res) => {
          if (err) {
            console.log(err);
            return;
          } else {
            if (res.slice(-1)[0].isBuyer) {
              console.log('no sell applicable');
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
          console.log(border, 'BUY', border);
        }
      }
    }
  });
};

myfunc();

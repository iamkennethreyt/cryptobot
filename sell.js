const Binance = require('node-binance-api');
const axios = require('axios');
const colors = require('colors');

//ENVIRONMENT VARIABLES
const APISECRET = process.env.APISECRET;
const APIKEY = process.env.APIKEY;
const SYMBOL = process.env.SYMBOL || 'SHIBBUSD';
const PERCENTSELL = process.env.PERCENTSELL || 1;

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
      console.log('Current Price : ', currPrice);
      console.log('Price to Sell : ', pricetoSell);
      console.log('Percent  Sell : ', PERCENTSELL, border);

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
              border,
              `Successfully added Sell \nPrice : ${res.price}`.green,
              border
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
      if (openOrders.length === 0) {
        binance.trades(SYMBOL, (err, res) => {
          if (err) {
            console.log(err);
            return;
          } else {
            if (res.slice(-1)[0].isBuyer) {
              sell();
              return;
            } else {
              console.log(border, 'NO SELL AVAILABLE', border);
              return;
            }
          }
        });
      } else {
        console.log(border, 'THERE IS PENDING ORDERS', border);
        return;
      }
    }
  });
};

myfunc();

const Binance = require('node-binance-api');
const axios = require('axios');
const colors = require('colors');
const baseUrl = 'https://api.binance.com/api/v3/ticker/price';
const kLinesAPI = 'https://api3.binance.com/api/v3/klines?';

const APISECRET = process.env.APISECRET; //API SECRET
const APIKEY = process.env.APIKEY; //API KEY
const SYMBOL = process.env.SYMBOL || 'SHIBBUSD'; //SYMBOL
const PERCENTCAPITAL = process.env.PERCENTCAPITAL || 100; //PERCENT CAPITAL
const INTERVAL = process.env.INTERVAL || '1m'; //INTERVAL WHEN FETCH THE AGGREGATE TRADES
const LIMIT = process.env.LIMIT || 20; //LIMIT WHEN FETCH THE AGGREGATE TRADES
const PERCENTBUY = process.env.PERCENTBUY; //IF NOT SET, THE AVERAGE OF THE PREVEIOS AGGREGATE TRADES
const PERCENTSELL = process.env.PERCENTSELL; //IF NOT SET, THE AVERAGE OF THE PREVEIOS AGGREGATE TRADES
const PRICELIMIT = process.env.PRICELIMIT; //END POINT OF THE PRICE SET
const SPREAD = process.env.SPREAD || 1.5;
const CRYPTO = process.env.CRYPTO || 'SHIB';
const CRYPTOTRANSACT = process.env.CRYPTO || 'BUSD';
const seAveHighLimit = process.env.SETAVEHIGHLIMIT || false;
const binance = new Binance().options({
  APIKEY,
  APISECRET,
  useServerTime: true,
  recvWindow: 60000,
  verbose: true
});
const border =
  '\n=============================================================\n';

//calculate the average of an array and properties
const avg = async (arr, prop) =>
  (await arr.reduce((r, c) => r + parseFloat(c[prop]), 0)) / arr.length;

//fetch current price
const fetchCurPrice = async () => {
  const res = await axios.get(`${baseUrl}`, {
    params: { symbol: SYMBOL }
  });

  return res.data.price;
};

//fetch the aggregate trades
const fetchAggTrades = async () => {
  const res = await axios.get(kLinesAPI, {
    params: {
      symbol: SYMBOL,
      interval: INTERVAL,
      limit: LIMIT
    }
  });
  return res.data;
};

const transactBuy = async () => {
  const currPrice = await fetchCurPrice();

  //check if the current price is not exceded to the set price limit
  if (PRICELIMIT) {
    if (currPrice >= PRICELIMIT) {
      console.log('UNEABLE TO TRANSACT, PRICELIMIT EXCEDED');
      return;
    }
  }

  const prevHighPer = await previousHighPercent();
  const arr = await fetchAggTrades();
  const open = await avg(arr, 1);
  const low = await avg(arr, 3);
  const high = await avg(arr, 2);
  const aveHigh = PERCENTSELL || (await ((high / open) * 100 - 100));

  if (seAveHighLimit) {
    if (prevHighPer > aveHigh) {
      console.log('AVERAGE HIGH PERCENT IS GREATER THAT PREVIOUS HIGH PERCENT');
      return;
    }
  }

  //if PERCENTBBUY is not set, the average low percentage will be replace
  PERCENTBUY && console.log('PERCENT BUY PARAM EXIST : ', PERCENTBUY);
  const aveLow = PERCENTBUY || (await (100 - (100 * low) / open).toFixed(2));

  const lowExec = SPREAD * aveLow;

  //check the balance
  binance.balance(async (err, bal) => {
    try {
      const currPrice = await fetchCurPrice();
      const curBalance = bal[CRYPTOTRANSACT].available;
      const pricetoBuy = (
        ((100 - parseFloat(lowExec)) * currPrice) /
        100
      ).toFixed(8);
      const capital = curBalance * (PERCENTCAPITAL / 100);

      console.log('currPrice', currPrice);
      console.log('pricetoBuy', pricetoBuy);
      console.log('aveLow', aveLow);
      console.log('lowExec', lowExec);
      console.log('PERCENTCAPITAL', PERCENTCAPITAL);
      console.log('capital', capital);

      const amount = capital / pricetoBuy;
      const amountRnd = Math.floor(amount);

      await binance.buy(
        SYMBOL,
        amountRnd,
        pricetoBuy,
        { type: 'LIMIT' },
        (err, res) => {
          try {
            console.info(`Successfully added Buy \nPrice : ${res.price}`);
          } catch (error) {
            throw err;
          }
        }
      );
      return;
    } catch (error) {
      throw err;
    }
  });
};

const sell = async () => {
  const arr = await fetchAggTrades();
  const open = await avg(arr, 1);
  const high = await avg(arr, 2);
  PERCENTSELL && console.log('PERCENT SELL PARAM EXIST : ', PERCENTSELL);
  const aveHigh = PERCENTSELL || (await ((high / open) * 100 - 100).toFixed(2));
  const highExec = SPREAD * aveHigh;
  binance.balance(async (err, bal) => {
    try {
      await binance.trades(SYMBOL, (err, prevTransact) => {
        if (!err) {
          const prevBuy = prevTransact.slice(-1)[0].price;
          const curBalance = bal[CRYPTO].available;
          const pricetoSell = (
            ((100 + parseFloat(highExec)) * prevBuy) /
            100
          ).toFixed(8);
          const amountRnd = Math.floor(curBalance);
          console.log('prevBuy', prevBuy);
          console.log('pricetoSell', pricetoSell);
          console.log('aveHigh', aveHigh);
          console.log('highExec', highExec);
          binance.sell(
            SYMBOL,
            amountRnd,
            pricetoSell,
            { type: 'LIMIT' },
            (err, res) => {
              try {
                console.info(`Successfully added Sell \nPrice : ${res.price}`);
              } catch (error) {
                throw err;
              }
            }
          );
        }
      });

      return;
    } catch (error) {
      throw err;
    }
  });
};

//fetch the previous percent of high trades
const previousHighPercent = async () => {
  const res = await axios.get(kLinesAPI, {
    params: {
      symbol: SYMBOL,
      interval: INTERVAL,
      limit: 1
    }
  });
  const data = res.data[0];
  const output = (data[2] / data[1]) * 100 - 100;
  return output;
};

//execute the function
const transact = async () => {
  await binance.useServerTime();

  //check the open orders first
  await binance.openOrders(false, (err, openOrders) => {
    try {
      if (openOrders.length === 0) {
        console.log(border, 'BUY/SELL', border);
        binance.trades(SYMBOL, (err, res) => {
          try {
            if (res.slice(-1)[0].isBuyer) {
              sell();
              return;
            } else {
              transactBuy();
              return;
            }
          } catch (error) {
            throw err;
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
            try {
              console.info('Successfully cancel trade');
              console.info(`Previous trade [${res[0].side}]`.blue);
              transactBuy();
            } catch (error) {
              throw err;
            }
          });
          console.log(border, 'BUY NEW', border);
        }
      }
    } catch (error) {
      throw err;
    }
  });
};

transact();

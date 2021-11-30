const Binance = require('node-binance-api');
const moment = require('moment');
const axios = require('axios');
const colors = require('colors');
const baseUrl = 'https://api.binance.com/api/v3/ticker/price';
const kLinesAPI = 'https://api3.binance.com/api/v3/klines?';

const APISECRET = process.env.APISECRET; //API SECRET
const APIKEY = process.env.APIKEY; //API KEY
const SYMBOL = process.env.SYMBOL || 'BNBBUSD'; //SYMBOL
const PERCENTCAPITAL = process.env.PERCENTCAPITAL || 100; //PERCENT CAPITAL
const INTERVAL = process.env.INTERVAL || '1h'; //INTERVAL WHEN FETCH THE AGGREGATE TRADES
const LIMIT = process.env.LIMIT || 22; //LIMIT WHEN FETCH THE AGGREGATE TRADES
const PERCENTBUY = process.env.PERCENTBUY; //IF NOT SET, THE AVERAGE OF THE PREVEIOS AGGREGATE TRADES
const PERCENTSELL = process.env.PERCENTSELL; //IF NOT SET, THE AVERAGE OF THE PREVEIOS AGGREGATE TRADES
const PRICELIMIT = process.env.PRICELIMIT; //END POINT OF THE PRICE SET
const SPREAD = process.env.SPREAD || 1.2;
const CRYPTO = process.env.CRYPTO || 'BNB';
const CRYPTOTRANSACT = process.env.CRYPTO || 'BUSD';

const binance = new Binance().options({
  APIKEY,
  APISECRET,
  useServerTime: true,
  recvWindow: 60000,
  verbose: true
});
const border =
  '\n=============================================================\n';
console.log(border);
console.log('Following Parameters :');
process.env.PERCENTCAPITAL &&
  console.log('PERCENTCAPITAL ', process.env.PERCENTCAPITAL);
process.env.LIMIT && console.log('LIMIT ', process.env.LIMIT);
process.env.INTERVAL && console.log('INTERVAL ', process.env.INTERVAL);
process.env.PRICELIMIT && console.log('PRICELIMIT ', process.env.PRICELIMIT);
process.env.SPREAD && console.log('SPREAD ', process.env.SPREAD);
console.log(border);

//calculate the average of an array and properties
const avg = async (arr, prop) =>
  (
    (await arr.reduce((r, c) => r + parseFloat(c[prop]), 0)) / arr.length
  ).toFixed(1);

//fetch current price
const fetchCurPrice = async () => {
  const res = await axios.get(`${baseUrl}`, {
    params: { symbol: SYMBOL }
  });

  return parseFloat(res.data.price);
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
  if (currPrice >= PRICELIMIT) {
    console.log('UNEABLE TO TRANSACT, PRICELIMIT EXCEDED');
    return;
  }

  const arr = await fetchAggTrades();
  const low = parseFloat(await avg(arr, 3));

  //if PERCENTBBUY is not set, the average low percentage will be replace
  PERCENTBUY && console.log('PERCENT BUY PARAM EXIST : ', PERCENTBUY);

  //check the balance
  binance.balance(async (err, bal) => {
    try {
      const currPrice = await fetchCurPrice();
      const curBalance = parseFloat(bal[CRYPTOTRANSACT].available);

      const price = currPrice > low ? low : currPrice - 2;
      const capital = parseFloat(
        (curBalance * (PERCENTCAPITAL / 100)).toFixed(2)
      );
      const quantity = parseFloat((capital / price).toFixed(3)) - 0.001;

      console.log('Current Price :', currPrice);
      console.log('Current Balance :', curBalance);
      console.log(`Average Low price for ${INTERVAL.blue} :`, low);
      console.log('Percent Capital :', PERCENTCAPITAL, '%');
      console.log('Capital', capital);

      await binance.buy(
        SYMBOL,
        quantity,
        price,
        { type: 'LIMIT' },
        (err, res) => {
          try {
            console.log(border);
            console.log('Quantity', quantity);
            console.log('Price to Buy', price);
            console.info(
              `Successfully added Buy \nPrice : ${parseFloat(res.price)}`
            );
          } catch (error) {
            console.log(err);
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
  const aveHigh =
    PERCENTSELL || (await parseFloat(((high / open) * 100 - 100).toFixed(2)));
  const highExec = SPREAD * aveHigh;
  binance.balance(async (err, bal) => {
    try {
      await binance.trades(SYMBOL, (err, prevTransact) => {
        if (!err) {
          const prevBuy = parseFloat(prevTransact.slice(-1)[0].price);
          const curBalance = bal[CRYPTO].available;
          const sell = (((100 + parseFloat(highExec)) * prevBuy) / 100).toFixed(
            1
          );
          const quantity = parseFloat(curBalance).toFixed(3) - 0.001;
          console.log('Previous Transaction :', prevBuy);
          console.log(
            `Average high in ${LIMIT} per ${INTERVAL.blue} :`,
            aveHigh
          );

          binance.sell(
            SYMBOL,
            quantity,
            sell,
            { type: 'LIMIT' },
            (err, res) => {
              try {
                console.log('Price to Sell :', sell);
                console.log('Quantity :', quantity);
                console.info(
                  `Successfully added Sell \nPrice : ${parseFloat(res.price)}`
                );
              } catch (error) {
                console.log(err);
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

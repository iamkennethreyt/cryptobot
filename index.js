const {
  SYMBOL,
  BASEASSET,
  QUOTEASSET,
  BASEDECIMALPLACES,
  BALANCECIMALPLACES,
  DECIMALPLACES,
} = require("./schema.json")[process.env.SYMBOL || "BNBBUSD"];

const Binance = require("node-binance-api");
const axios = require("axios");
const colors = require("colors");
const lodash = require("lodash");
const baseUrl = "https://api.binance.com/api/v3/ticker/price";
const kLinesAPI = "https://api3.binance.com/api/v3/klines?";

const APIKEY = process.env.APIKEY; //API KEY
const APISECRET = process.env.APISECRET; //API SECRET

const CAPITAL = process.env.CAPITAL || 50; // CAPITAL
const INTERVAL = process.env.INTERVAL || "4h"; //INTERVAL WHEN FETCH THE AGGREGATE TRADES
const LIMIT = process.env.LIMIT || 48; //LIMIT WHEN FETCH THE AGGREGATE TRADES
const PERCENTBUY = process.env.PERCENTBUY; //IF NOT SET, THE AVERAGE OF THE PREVEIOS AGGREGATE TRADES
const PERCENTSELL = process.env.PERCENTSELL; //IF NOT SET, THE AVERAGE OF THE PREVEIOS AGGREGATE TRADES
const SPREAD = process.env.SPREAD || 1.0;
const ISBASEDONAVERAGEPERCENTAGE =
  process.env.ISBASEDONAVERAGEPERCENTAGE || false;

const binance = new Binance().options({
  APIKEY,
  APISECRET,
  useServerTime: true,
  recvWindow: 60000,
  verbose: true,
});
const border =
  "\n=============================================================\n";
console.log(border);
console.log("Following Parameters :");
process.env.CAPITAL && console.log("CAPITAL ", process.env.CAPITAL);
process.env.LIMIT && console.log("LIMIT ", process.env.LIMIT);
process.env.INTERVAL && console.log("INTERVAL ", process.env.INTERVAL);
process.env.SPREAD && console.log("SPREAD ", process.env.SPREAD);
console.log(border);

//calculate the average of an array and properties
const avg = async (arr, prop) =>
  (
    (await arr.reduce((r, c) => r + parseFloat(c[prop]), 0)) / arr.length
  ).toFixed(BASEDECIMALPLACES);

//fetch current price
const fetchCurPrice = async () => {
  const res = await axios.get(`${baseUrl}`, {
    params: { symbol: SYMBOL },
  });

  return parseFloat(res.data.price);
};

//fetch the aggregate trades
const fetchAggTrades = async () => {
  const res = await axios.get(kLinesAPI, {
    params: {
      symbol: SYMBOL,
      interval: INTERVAL,
      limit: LIMIT,
    },
  });
  return res.data;
};

const transactBuy = async () => {
  const currPrice = await fetchCurPrice();

  const arr = await fetchAggTrades();

  const highValue = parseInt(lodash.maxBy(arr, (x) => x[2])[2]);

  //check if the current price is not exceded to the set price limit
  if (currPrice >= highValue) {
    console.log("UNEABLE TO TRANSACT, PRICELIMIT EXCEDED");
    return;
  }

  const averageLow = parseFloat(await avg(arr, 3));
  const averageOpen = parseFloat(await avg(arr, 1));

  //if PERCENTBBUY is not set, the average low percentage will be replace
  PERCENTBUY && console.log("PERCENT BUY PARAM EXIST : ", PERCENTBUY);

  const avePercentLow = await parseFloat(
    (100 - (100 * averageLow) / averageOpen).toFixed(2)
  );

  //check the balance
  binance.balance(async (err, bal) => {
    try {
      const currPrice = await fetchCurPrice();
      const curBalance = parseFloat(bal[QUOTEASSET].available);

      let price;
      if (ISBASEDONAVERAGEPERCENTAGE) {
        price = (currPrice - (avePercentLow * currPrice) / 100).toFixed(
          BASEDECIMALPLACES
        );
        console.log("price", price);
      } else {
        price = (
          currPrice > averageLow ? averageLow : currPrice * 0.99
        ).toFixed(BASEDECIMALPLACES);
      }
      const capital = CAPITAL;
      let quantity =
        Math.floor((capital / price) * DECIMALPLACES) / DECIMALPLACES;

      console.log("Current Price :", currPrice);
      console.log("Current Balance :", curBalance);
      console.log(
        `Average Low price for ${INTERVAL.blue} in ${LIMIT} limit:`,
        averageLow
      );
      console.log("Capital :", CAPITAL);

      await binance.buy(
        SYMBOL,
        quantity,
        price,
        { type: "LIMIT" },
        (err, res) => {
          try {
            console.log(border);
            console.log("Quantity", quantity);
            console.log("Price to Buy", price);
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

const transactSell = async () => {
  const arr = await fetchAggTrades();
  const averageOpen = await avg(arr, 1);
  const averageHigh = await avg(arr, 2);
  PERCENTSELL && console.log("PERCENT SELL PARAM EXIST : ", PERCENTSELL);
  const avePercentHigh =
    PERCENTSELL ||
    (await parseFloat(((averageHigh / averageOpen) * 100 - 100).toFixed(2)));
  const highExec = SPREAD * avePercentHigh;
  binance.balance(async (err, bal) => {
    try {
      await binance.trades(SYMBOL, (err, prevTransact) => {
        if (!err) {
          const prevBuy = parseFloat(
            prevTransact.filter((x) => x.isBuyer).slice(-1)[0].price
          );
          console.log("prevBuy", prevBuy);
          const curBalance = bal[BASEASSET].available;
          const sell = (((100 + parseFloat(highExec)) * prevBuy) / 100).toFixed(
            BASEDECIMALPLACES
          );
          console.log(
            "Current Balance :",
            parseFloat(curBalance).toFixed(BALANCECIMALPLACES)
          );
          let quantity = Math.floor(curBalance * DECIMALPLACES) / DECIMALPLACES;

          console.log("Previous Transaction :", prevBuy);
          console.log(
            `Average high in ${LIMIT} per ${INTERVAL.blue} :`,
            avePercentHigh
          );

          binance.sell(
            SYMBOL,
            quantity,
            sell,
            { type: "LIMIT" },
            (err, res) => {
              try {
                console.log("Price to Sell :", sell);
                console.log("Quantity :", quantity);
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
  await binance.openOrders(SYMBOL, (err, openOrders) => {
    const prevT = openOrders[openOrders.length - 1];
    try {
      if (openOrders.length === 0) {
        binance.trades(SYMBOL, (err, res) => {
          try {
            if (res.slice(-1)[0].isBuyer) {
              console.log(border, "SELL", border);
              transactSell();
              return;
            } else {
              console.log(border, "BUY", border);
              transactBuy();
              return;
            }
          } catch (error) {
            throw err;
          }
        });
      } else {
        if (prevT.side === "BUY") {
          binance.cancel(SYMBOL, prevT.orderId, (err) => {
            if (err) {
              console.log(err);
            } else {
              console.log("Previous order cancelled!");
            }
          });
        }
        transactBuy();
        transactSell();
      }
    } catch (error) {
      throw err;
    }
  });
};

transact();

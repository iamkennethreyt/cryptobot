const APIKEY = process.env.APIKEY; //API KEY
const APISECRET = process.env.APISECRET; //API SECRET
const XAPIKEY = process.env.XAPIKEY; // API KEY FOR coinwatch;

const Binance = require("node-binance-api");
const axios = require("axios");
const colors = require("colors");
const lodash = require("lodash");
const baseUrl = "https://api.binance.com/api/v3/ticker/price";
const kLinesAPI = "https://api3.binance.com/api/v3/klines?";
const exchangeInfoURL = "https://api.binance.com/api/v1/exchangeInfo";
const coinSingle = "https://api.livecoinwatch.com/coins/single";

const SYMBOL = process.env.SYMBOL || "BNBBUSD";
const CAPITAL = process.env.CAPITAL || 1300; // CAPITAL
const INTERVAL = process.env.INTERVAL || "4h"; //INTERVAL WHEN FETCH THE AGGREGATE TRADES
const LIMIT = process.env.LIMIT || 48; //LIMIT WHEN FETCH THE AGGREGATE TRADES
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
process.env.LIMIT && console.log("LIMIT ", process.env.LIMIT);
process.env.INTERVAL && console.log("INTERVAL ", process.env.INTERVAL);
process.env.SPREAD && console.log("SPREAD ", process.env.SPREAD);
console.log(border);

//count decimal places
const countDecimalPlaces = (number) =>
  (+number).toFixed(10).replace(/^-?\d*\.?|0+$/g, "").length;

//fetch current price
const fetchCurPrice = async (symbol) => {
  const res = await axios.get(`${baseUrl}`, {
    params: { symbol },
  });

  return parseFloat(res.data.price);
};

//fetch exchange info
const exhangeInfo = async () => {
  const res = await axios.get(exchangeInfoURL);
  return res.data;
};

//fetch the aggregate trades
const fetchAggTrades = async (symbol) => {
  const res = await axios.get(kLinesAPI, {
    params: {
      symbol,
      interval: INTERVAL,
      limit: LIMIT,
    },
  });
  return res.data;
};

//convert capital
const coinSingleInfo = async (quoteAsset) => {
  const res = await axios.post(
    coinSingle,
    {
      currency: "PHP",
      code: quoteAsset,
      meta: true,
    },
    {
      headers: {
        "x-api-key": XAPIKEY,
        "Content-Type": "application/json",
      },
    }
  );
  return CAPITAL / res.data.rate;
};

const transactBuy = async ({ symbol, quoteAsset, minPrice, stepSize }) => {
  const currPrice = await fetchCurPrice(symbol);

  const arr = await fetchAggTrades(symbol);

  //calculate the average of an array and properties
  const avg = async (arr, prop) =>
    (
      (await arr.reduce((r, c) => r + parseFloat(c[prop]), 0)) / arr.length
    ).toFixed(minPrice);

  const highValue = parseFloat(lodash.maxBy(arr, (x) => x[2])[2]);

  //check if the current price is not exceded to the set price limit
  if (currPrice >= highValue) {
    console.log("UNEABLE TO TRANSACT, PRICELIMIT EXCEDED");
    return;
  }

  const averageLow = parseFloat(await avg(arr, 3));
  const averageOpen = parseFloat(await avg(arr, 1));

  const avePercentLow = await parseFloat(
    (100 - (100 * averageLow) / averageOpen).toFixed(2)
  );

  //check the balance
  binance.balance(async (err, bal) => {
    try {
      const curBalance = parseFloat(bal[quoteAsset].available);

      let price;
      if (ISBASEDONAVERAGEPERCENTAGE) {
        price = (currPrice - (avePercentLow * currPrice) / 100).toFixed(
          minPrice
        );
        console.log("price", price);
      } else {
        price = (
          currPrice > averageLow ? averageLow : currPrice * 0.99
        ).toFixed(minPrice);
      }
      const capital = await coinSingleInfo(quoteAsset);
      let quantity = Math.floor((capital / price) * stepSize) / stepSize;

      console.log("Current Price :", currPrice);
      console.log("Current Balance :", curBalance);
      console.log(
        `Average Low price for ${INTERVAL.blue} in ${LIMIT} limit:`,
        averageLow
      );
      console.log("Capital :", CAPITAL);

      await binance.buy(
        symbol,
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

const transactSell = async ({ symbol, baseAsset, minPrice, stepSize }) => {
  const arr = await fetchAggTrades(symbol);

  const avg = (arr, prop) =>
    (arr.reduce((r, c) => r + parseFloat(c[prop]), 0) / arr.length).toFixed(
      minPrice
    );

  const averageOpen = await avg(arr, 1);
  const averageHigh = await avg(arr, 2);
  PERCENTSELL && console.log("PERCENT SELL PARAM EXIST : ", PERCENTSELL);
  const avePercentHigh =
    PERCENTSELL ||
    (await parseFloat(((averageHigh / averageOpen) * 100 - 100).toFixed(2)));
  const highExec = SPREAD * avePercentHigh;
  binance.balance(async (err, bal) => {
    try {
      await binance.trades(symbol, (err, prevTransact) => {
        if (!err) {
          const prevBuy = parseFloat(
            prevTransact.filter((x) => x.isBuyer).slice(-1)[0].price
          );
          console.log("prevBuy", prevBuy);
          const curBalance = bal[baseAsset].available;
          const sell = (((100 + parseFloat(highExec)) * prevBuy) / 100).toFixed(
            minPrice
          );
          console.log("Current Balance :", parseFloat(curBalance));
          let quantity = Math.floor(curBalance * stepSize) / stepSize;

          console.log("Previous Transaction :", prevBuy);
          console.log(
            `Average high in ${LIMIT} per ${INTERVAL.blue} :`,
            avePercentHigh
          );

          binance.sell(
            symbol,
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

  const marketPair = await exhangeInfo();
  const objs = await marketPair.symbols.find((x) => x.symbol === SYMBOL);
  if (objs !== undefined) {
    const paramsObject = {
      symbol: objs.symbol,
      baseAsset: objs.baseAsset,
      quoteAsset: objs.quoteAsset,
      minPrice: countDecimalPlaces(
        parseFloat(
          objs.filters.find((x) => x.filterType === "PRICE_FILTER").minPrice
        )
      ),
      stepSize:
        1 / objs.filters.find((x) => x.filterType === "LOT_SIZE").stepSize,
    };

    //check the open orders first
    await binance.openOrders(paramsObject.symbol, (err, openOrders) => {
      const prevT = openOrders[openOrders.length - 1];
      try {
        if (openOrders.length === 0) {
          binance.trades(paramsObject.symbol, (err, res) => {
            try {
              if (res.slice(-1)[0].isBuyer) {
                console.log(border, "SELL", border);
                transactSell(paramsObject);
                return;
              } else {
                console.log(border, "BUY", border);
                transactBuy(paramsObject);
                return;
              }
            } catch (error) {
              throw err;
            }
          });
        } else {
          if (prevT.side === "BUY") {
            binance.cancel(paramsObject.symbol, prevT.orderId, (err) => {
              if (err) {
                console.log(err);
              } else {
                console.log("Previous order cancelled!");
              }
            });
          }
          transactBuy(paramsObject);
          transactSell(paramsObject);
        }
      } catch (error) {
        throw err;
      }
    });
  } else {
    console.log("Undefined Symbol!");
  }
};

transact();

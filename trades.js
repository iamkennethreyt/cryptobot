const Binance = require('node-binance-api');
const moment = require('moment');
const APISECRET = process.env.APISECRET; //API SECRET
const APIKEY = process.env.APIKEY; //API KEY
const SYMBOL = process.env.SYMBOL || 'BNBBUSD'; //API KEY
const _ = require('lodash');

const binance = new Binance().options({
  APIKEY,
  APISECRET,
  useServerTime: true,
  recvWindow: 60000,
  verbose: true
});
const trades = async () => {
  await await binance.useServerTime();
  await binance.trades(SYMBOL, (err, res, symbol) => {
    if (err) {
      console.error(err.body.red);
      return;
    } else {
      mapped = res.map((x) => {
        return {
          price: parseFloat(x.price),
          quantity: parseFloat(x.qty),
          type: x.isBuyer ? 'Buy' : 'Sell',
          time: moment(x.time).format('DD/MM/YYYY'),
          quoteQty: x.quoteQty
        };
      });
      //   groupByTime = _.groupBy(mapped, 'time');
      console.log(mapped.sum('time'));
      return;
    }
  });
  return;
};

trades();

Array.prototype.sum = function (prop) {
  var total = 0;
  for (var i = 0, _len = this.length; i < _len; i++) {
    total += this[i][prop];
  }
  return total;
};

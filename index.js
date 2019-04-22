const blessed = require('blessed');
const contrib = require('blessed-contrib');
const moment = require('moment');
const colors = require('colors/safe');
const approx = require('approximate-number');
const figures = require('figures');

const getRanking = require('./utils/coinRanking');
const getCoinHistory = require('./utils/coinHistory');

// Global Vars
const limit = 10;
var totalCoins = 0;
var currentCoinId = -1;
var currentCoinName = "";
var offset = 0;
var currentPage = 0;
var periodIndex = 0;
var currencyIndex = 0;
var currencySymbol = "";
var realTimeRefresh = 60000; // 1 min

const period = ['Real-Time', '24h', '7d', '30d', '1y'];
const currency = ['USD', 'EUR'];

module.exports = (args) => {
    // Create screen
    var screen = createScreen();

    // Create grid layout
    var grid = createGridLayout(screen);
    
    // Create price log
    var log = createLog(grid, []);

    // Create coin graph
    var graph = createGraph(grid);

    // Create ranking table
    var table = createTable(grid, screen);

    // Set keys
    setKeys(grid, screen);
    
    // Render the screen.
    screen.render();
}

function createScreen(){
  var screen = blessed.screen({
    smartCSR: true,
    useBCE: true,
    cursor: {
        artificial: true,
        blink: true,
        shape: 'underline'
    },
    debug: true,
    dockBorders: true
  });
  
  screen.title = 'Crypto Stats';

  return screen;
};

function createGridLayout(screen){
  var grid = new contrib.grid({rows: 7, cols: 5, screen: screen})

  return grid;
}

async function createGraph(grid){  
  var minPrice = 0;
  var historyPrice = [];
  var historyDate = [];
  var graph = 0;
  var realTimeDataLimit = 50;

  if(currentCoinId > 0){
    var periodAux = period[periodIndex];
    if(periodIndex == 0){
      periodAux = period[1];
    }

    const coinHistory = await getCoinHistory(currentCoinId, periodAux, currency[currencyIndex]);
    var coinHistoryData = [];
    if(periodIndex == 0){
      coinHistoryData = coinHistory.data.history.slice(0,realTimeDataLimit);
    }else{
      coinHistoryData = coinHistory.data.history;
    }

    createLog(grid, coinHistoryData);

    historyPrice = new Array(coinHistoryData.length);
    historyDate = new Array(coinHistoryData.length);

    for (var i = 0; i < historyPrice.length; i++) {
      historyPrice[i] = parseFloat(coinHistoryData[i].price);
      if(periodIndex == 0 || periodIndex == 1){
        historyDate[i] = moment(new Date(coinHistoryData[i].timestamp)).format("h:mm a");
      }else if(periodIndex == 2 || periodIndex == 3){
        historyDate[i] = moment(new Date(coinHistoryData[i].timestamp)).format("D MMM");
      }else{
        historyDate[i] = moment(new Date(coinHistoryData[i].timestamp)).format("MMM Y");
      }
    }

    var minPrice = Math.min.apply(Math, historyPrice);
      
    graph = grid.set(0, 0, 4, 4, contrib.line, 
    { style:
        { line: "green"
        , text: "white"
        , baseline: "green"}
      , xLabelPadding: 10
      , xPadding: 1
      , minY: minPrice
      , abbreviate: true
      , showLegend: false
      , wholeNumbersOnly: false
      , label: ' Coin Price History (' + period[periodIndex] + ') (' + currency[currencyIndex] + ') - ' + colors.green(currentCoinName) + colors.yellow(' [p] Period [c] Currency [esc] Exit ')
    });

    var data = {
      title: 'Price (' + period[periodIndex] + ')',
      x: historyDate,
      y: historyPrice
    };

    graph.setData([data]);
  }else{
    var graph = grid.set(0, 0, 4, 4, contrib.line, 
      { label: ' Coin Price History (' + period[periodIndex] + ') (' + currency[currencyIndex] + ')' + colors.yellow(' [c] Currency [esc] Exit ')
      });
  }

  return graph;
}

function createLog(grid, coinHistoryData){
  var title = ""
  if(periodIndex == 0){
    title = ' Real-time prices (' + currency[currencyIndex] + ') ';
  }else{
    title = ' Last graph prices (' + currency[currencyIndex] + ') ';
  }

  var log = grid.set(0, 4, 4, 1, contrib.log,
    { fg: "white"
    , selectedFg: "green"
    , label: title});

  if(coinHistoryData.length > 0){
    var num = 30;
    for (var i = coinHistoryData.length - num; i < coinHistoryData.length; i++) {
      if(coinHistoryData[i].price > coinHistoryData[i - 1].price){
        var arrow = " " + colors.blue(figures.arrowUp) + " ";
      }else{
        var arrow = " " + colors.red(figures.arrowDown) + " ";
      }

      if(periodIndex == 0){
        log.log(moment(coinHistoryData[i].timestamp).format("h:mm") + arrow + currencySymbol + " " + coinHistoryData[i].price);
      }else{
        log.log(moment(coinHistoryData[i].timestamp).format('D/M/Y h:mm') + arrow + currencySymbol +  " " + approx(coinHistoryData[i].price));
      }
    }
  }

  return log;
}

async function createTable(grid, screen){
  const ranking = await getRanking(limit, offset, currency[currencyIndex])
  var coinList = new Array(ranking.data.coins.length);
  totalCoins = ranking.data.stats.total;
  var coinNameMaxLength = 20;

  var table = grid.set(4, 0, 3, 5, contrib.table, 
    { keys: true
    , fg: 'white'
    , selectedFg: 'black'
    , selectedBg: 'green'
    , interactive: true
    , align: 'left'
    , label: ' Ranking by Market Cap (Page ' + (currentPage + 1) + ' of ' + Math.round(totalCoins/limit) + ') (' + currency[currencyIndex] + ') ' + colors.yellow('[' + figures.arrowUp + '] Up [' + figures.arrowDown + '] Down [enter] Graph [+] Next page [-] Previous page ')
    , width: '100%'
    , height: '100%'
    , columnSpacing: 2
    , columnWidth: [5, coinNameMaxLength, 10, 20, 15, 15, 20] });

  table.focus();

  currencySymbol = ranking.data.base.sign;

  for (var i = 0; i < coinList.length; i++) {
    var coin = ranking.data.coins[i];
    var coinInfo = [];
    if(coin.rank == null){
      coinInfo.push("n/a")
    }else{
      coinInfo.push(coin.rank);
    }
    if(coin.name == null){
      coinInfo.push("n/a")
    }else{
      if(coin.name.length > coinNameMaxLength){
        coinInfo.push(coin.name.slice(0, coinNameMaxLength - 3) + "...");
      }else{
        coinInfo.push(coin.name);
      }
    }
    if(coin.symbol == null){
      coinInfo.push("n/a")
    }else{
      coinInfo.push(coin.symbol);
    }
    if(coin.price == null){
      coinInfo.push("n/a")
    }else{
      coinInfo.push(currencySymbol + " " + coin.price);
    }
    if(coin.marketCap == null){
      coinInfo.push("n/a")
    }else{
      coinInfo.push(currencySymbol + " " + approx(coin.marketCap));
    }
    if(coin.change == null){
      coinInfo.push("n/a")
    }else{
      if(coin.change > 0){
        coinInfo.push(colors.blue("+" + coin.change + "%"));
      }else{
        coinInfo.push(colors.red(coin.change + "%"));
      }
    }
    if(coin.allTimeHigh == null){
      coinInfo.push("n/a")
    }else{
      coinInfo.push(currencySymbol + " " + coin.allTimeHigh.price);
    }

    coinList[i] = coinInfo;
  }

  table.rows.on('select', (item, index) => {
    selectedCoinId = ranking.data.coins[index].id;

    if(currentCoinId != selectedCoinId){
      currentCoinId = selectedCoinId;
      currentCoinName = ranking.data.coins[index].name;
      createGraph(grid);
      screen.render();

      if(periodIndex == 0){
        setInterval(function() {
          createGraph(grid);
          screen.render();
        }, realTimeRefresh);
      }
    }
  });

  table.setData(
  { headers: [colors.green('Rank'), colors.green('Name'), colors.green('Symbol'), colors.green('Price'), colors.green('Market Cap'), colors.green('24h Change'), colors.green('All Time High')]
  , data: coinList
  });

  return table;
}

function setKeys(grid, screen){
    // Exit CLI
    screen.key(['escape', 'C-c'], function(ch, key) {
      return process.exit(0);
    });

    // Change period
    screen.key(['p'], function(ch, key) {
      if(periodIndex == (period.length - 1)){
        periodIndex = 0;
      }else{
        periodIndex++;
      }

      createGraph(grid);
      screen.render();

      if(periodIndex == 0){
        setInterval(function() {
          createGraph(grid);
          screen.render();
        }, realTimeRefresh);
      }
    });

    // Change currency
    screen.key(['c'], function(ch, key) {
      if(currencyIndex == (currency.length - 1)){
        currencyIndex = 0;
      }else{
        currencyIndex++;
      }

      createTable(grid, screen);
      createGraph(grid);
      screen.render();
    });

    // Next page
    screen.key(['+'], function(ch, key) {
      if(currentPage < (totalCoins/limit) - 1){
        offset += limit;
        currentPage++;
        createTable(grid, screen);
        screen.render();
      }
    });

    // Previous page
    screen.key(['-'], function(ch, key) {
      if(currentPage > 0){
        offset -= limit;
        currentPage--;
        createTable(grid, screen);
        screen.render();
      }
    });
};
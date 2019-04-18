const blessed = require('blessed');
const contrib = require('blessed-contrib');
const moment = require('moment');
const getRanking = require('./utils/coinRanking');
const getCoinHistory = require('./utils/coinHistory');

// Global Vars
const limit = 10;
var totalCoins = 0;
var currentCoinId = -1;
var currentCoinName = "";
var offset = 0;
var currentPage = 0;

// ========= FIX =========
// - Request by page
// # Graph data 24h/7d/etc...
// + Log Box with price data from graph
// + Parameters
// + Help Page
// # Class for graph and other for table
// # Check global vars
// + Screen Resize
// =======================


module.exports = (args) => {
    // Create screen
    var screen = createScreen();

    // Create grid layout
    var grid = createGridLayout(screen);
    
    // Create price log
    var log = createLog(grid, []);

    // Create coin graph
    var graph = createGraph(grid, log);

    // Create ranking table
    var table = createTable(grid, screen, log);

    // Set keys
    setKeys(grid, screen);
    
    // Screen Resize
    // NOT WORKING
    //screenResize(screen, graph, table);

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

async function createGraph(grid, log){  
  var minPrice = 0;
  var historyPrice = [];
  var historyDate = [];
  var graph = 0;

  if(currentCoinId > 0){
    const coinHistory = await getCoinHistory(currentCoinId);
  
    log = createLog(grid, coinHistory.data.history);

    historyPrice = new Array(coinHistory.data.history.length);
    historyDate = new Array(coinHistory.data.history.length);

    for (var i = 0; i < historyPrice.length; i++) {
      historyPrice[i] = parseFloat(coinHistory.data.history[i].price);
      historyDate[i] = formatDateFor24h(new Date(coinHistory.data.history[i].timestamp));
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
      , showLegend: false
      , wholeNumbersOnly: false
      , label: ' Coin Price History (24h) (USD) - ' + currentCoinName + ' '
    });

    var data = {
      title: 'Price (USD)',
      x: historyDate,
      y: historyPrice
    };

    graph.setData([data]);
  }else{
    var graph = grid.set(0, 0, 4, 4, contrib.line, 
      { label: ' Coin Price History (24h) (USD) '
      });
  }

  return graph;
}

function createLog(grid, coinHistoryData){  
  var log = grid.set(0, 4, 4, 1, contrib.log,
    { fg: "green"
    , selectedFg: "green"
    , label: ' Last prices '});

  if(coinHistoryData.length > 0){
    var num = 30;
    for (var i = coinHistoryData.length - num; i < coinHistoryData.length; i++) {
      log.log(formatDate(coinHistoryData[i].timestamp) + " - " + coinHistoryData[i].price);
    }
  }

  return log;
}

async function createTable(grid, screen, log){
  const ranking = await getRanking(limit, offset)
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
    , label: ' Top ' + limit + ' Ranking (Page ' + (currentPage + 1) + ' of ' + Math.round(totalCoins/limit) + ') [+] Next page [-] Previous page '
    , width: '100%'
    , height: '100%'
    , border: {type: "line", fg: "white"}
    , columnSpacing: 2
    , columnWidth: [5, coinNameMaxLength, 10, 20, 15, 15, 20] });

  table.focus();

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
      coinInfo.push(ranking.data.base.sign + " " + coin.price);
    }
    if(coin.marketCap == null){
      coinInfo.push("n/a")
    }else{
      coinInfo.push(ranking.data.base.sign + " " + formatNumber(coin.marketCap));
    }
    if(coin.change == null){
      coinInfo.push("n/a")
    }else{
      if(coin.change > 0){
        coinInfo.push("+" + coin.change + "%");
      }else{
        coinInfo.push(coin.change + "%");
      }
    }
    if(coin.allTimeHigh == null){
      coinInfo.push("n/a")
    }else{
      coinInfo.push(ranking.data.base.sign + " " + formatNumber(coin.allTimeHigh.price));
    }

    coinList[i] = coinInfo;
  }

  table.rows.on('select', (item, index) => {
    selectedCoinId = ranking.data.coins[index].id;

    if(currentCoinId != selectedCoinId){
      currentCoinId = selectedCoinId;
      currentCoinName = ranking.data.coins[index].name;
      createGraph(grid, log);
      screen.render();

      // Real Time Data (30 sec)
      setInterval(function() {
        createGraph(grid, log);
        screen.render();
      }, 30000)
    }
  });

  table.setData(
  { headers: ['Rank', 'Name', 'Symbol', 'Price', 'Market Cap', '24h Change', 'All Time High']
  , data: coinList
  });

  return table;
}

function setKeys(grid, screen){
    // Exit CLI
    screen.key(['escape', 'q', 'C-c'], function(ch, key) {
      return process.exit(0);
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

function screenResize(screen, graph, table){
  screen.on('resize', function() {
    graph.emit('attach');
    table.emit('attach');
  });
}

function formatNumber(n) {
  var decimalPlaces = 1;

  return Math.abs(Number(n)) >= 1.0e+9
  ? formatNumberWithDecimalPlaces(Math.abs(Number(n)) / 1.0e+9, decimalPlaces) + " B"
  : Math.abs(Number(n)) >= 1.0e+6
  ? formatNumberWithDecimalPlaces(Math.abs(Number(n)) / 1.0e+6, decimalPlaces) + " M"
  : Math.abs(Number(n)) >= 1.0e+3
  ? formatNumberWithDecimalPlaces(Math.abs(Number(n)) / 1.0e+3, decimalPlaces) + " K"
  : formatNumberWithDecimalPlaces(Math.abs(Number(n)), decimalPlaces);
}

function formatNumberWithDecimalPlaces(n, d) {
  return Math.round(n * Math.pow(10, d)) / Math.pow(10, d)
}

function formatDate(date) {
  return moment(date).format("h:mm");
}

function formatDateFor24h(date) {
  return moment(date).format("h:mm a");
}

function formatDateFor7d30d(date) {
  return moment(date).format("D MMM");
}

function formatDateFor1y(date) {
  return moment(date).format("MMM");
}

function formatDateFor5y(date) {
  return moment(date).format("MMM Y");
}
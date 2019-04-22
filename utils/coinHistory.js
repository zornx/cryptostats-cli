const axios = require('axios')

module.exports = async (coinId, period, currency) => {
  const results = await axios({
    method: 'get',
    url: 'https://api.coinranking.com/v1/public/coin/' + coinId + '/history/' + period + '?base=' + currency,
    params: {
      format: 'json'
    },
  })

  return results.data
}
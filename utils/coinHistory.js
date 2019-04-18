const axios = require('axios')

module.exports = async (coinId) => {
  const results = await axios({
    method: 'get',
    url: 'https://api.coinranking.com/v1/public/coin/' + coinId + '/history/24h',
    params: {
      format: 'json'
    },
  })

  return results.data
}
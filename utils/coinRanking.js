const axios = require('axios')

module.exports = async (limit, page, currency) => {
  const results = await axios({
    method: 'get',
    url: 'https://api.coinranking.com/v1/public/coins?limit=' + limit + '&offset=' + page + '&base=' + currency,
    params: {
      format: 'json'
    },
  })

  return results.data
}
const axios = require('axios')

module.exports = async (limit, page) => {
  const results = await axios({
    method: 'get',
    url: 'https://api.coinranking.com/v1/public/coins?limit=' + limit + '&offset=' + page,
    params: {
      format: 'json'
    },
  })

  return results.data
}
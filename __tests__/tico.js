require('dotenv').config()
const axios = require('axios')
const fs = require('fs')
const chai = require('chai')
const expect = chai.expect

// Load your test configurations from a JSON file
const tests = JSON.parse(fs.readFileSync('./__tests__/tico.json', 'utf8'))

describe('Tico Test Suite', function () {
  this.timeout(25000) // set a longer timeout if necessary

  tests.forEach((test) => {
    if (test.APIKey) {
      test.request.headers.Authorization = process.env[test.APIKey]
    }
    it(test.description, async () => {
      const response = await axios.request(test.request)

      // Check Status
      expect(response.status).to.equal(test.expectedStatus)

      // Check for keywords
      test.expectedKeywords.forEach((keyword) => {
        const regex = new RegExp(keyword, 'i')
        expect(regex.test(JSON.stringify(response.data))).to.be.true
      })
    })
  })
})

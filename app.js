require('dotenv').config()
const cron = require('node-cron')
const express = require('express')
const Mocha = require('mocha')
const axios = require('axios')
const rateLimit = require('express-rate-limit')

const app = express()
const port = process.env.PORT

let failedTestsLastRun = {
  api: [],
  tico: [],
}

// Create new Mocha instance
let mocha = new Mocha()

// Tests runner
async function runTests(type) {
  // Get current date and time
  const currentDateTime = new Date().toLocaleString()

  // Path to test file
  const testFilePath = `./__tests__/${type}.js`

  // Remove all test files from current instance
  mocha.files = []

  // Delete the required test file from the cache
  delete require.cache[require.resolve(testFilePath)]

  mocha = new Mocha()

  // Add test file to the new Mocha instance
  mocha.addFile(testFilePath)

  const testResults = { passed: [], failed: [] }

  // Run the tests
  await new Promise((resolve) => {
    mocha
      .run()
      .on('pass', (test) => {
        testResults.passed.push(test.title)
      })
      .on('fail', (test) => {
        testResults.failed.push(test.title)
      })
      .on('end', resolve)
  })

  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL

  // If there were any failed tests, send them to Slack
  if (testResults.failed.length > 0) {
    const failedTestsList = testResults.failed
      .map((test) => ':X: ' + test)
      .join('\n')

    const message = `\nTest run at ${currentDateTime}\n${failedTestsList}`

    if (!arraysAreEqual(testResults.failed, failedTestsLastRun[type])) {
      await axios.post(slackWebhookUrl, { text: message })
    }
  }

  // Find the tests which were failing but passed now
  const nowPassingTests = failedTestsLastRun[type].filter(
    (test) => !testResults.failed.includes(test)
  )

  if (nowPassingTests.length > 0) {
    const nowPassingTestsList = nowPassingTests
      .map((test) => ':white_check_mark: ' + test)
      .join('\n')
    const message =
      `\nTest run at ${currentDateTime}\nThe previously failing tests are now passing:\n` +
      nowPassingTestsList
    await axios.post(slackWebhookUrl, { text: message })
  }

  // Update failedTestsLastRun
  failedTestsLastRun[type] = testResults.failed

  return testResults
}

function arraysAreEqual(arr1, arr2) {
  return (
    arr1.length === arr2.length && arr1.every((item, i) => item === arr2[i])
  )
}

const testLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minutes
  max: 1, // limit each IP to 1 requests per windowMs
})

//  apply limiter to /run-tests endpoint
app.use('/run-tests', testLimiter)

app.get('/run-tests', async (req, res) => {
  const testResults = await runTests('tico')
  res.json(testResults)
})

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})

// Schedule tests to run every 1 minute
cron.schedule('*/1 * * * *', () => {
  runTests('api')
})

// Schedule tests to run every 5 minutes and 30 seconds
cron.schedule('*/5 * * * *', () => {
  setTimeout(() => {
    runTests('tico')
  }, 30 * 1000) // 30 seconds delay
})

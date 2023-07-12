require('dotenv').config()
const cron = require('node-cron')
const express = require('express')
const Mocha = require('mocha')
const axios = require('axios')
const rateLimit = require('express-rate-limit')

const app = express()
const port = process.env.PORT

let failedTestsLastRun = []

// Tests runner
async function runTests(type) {
  // Get current date and time
  const currentDateTime = new Date().toLocaleString()

  // Path to test file
  const testFilePath =
    type === 'API' ? './__tests__/api.js' : './__tests__/main.js'

  // Create new Mocha instance
  const mocha = new Mocha()

  // Delete the required test file from the cache
  delete require.cache[require.resolve(testFilePath)]

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

    if (!arraysAreEqual(testResults.failed, failedTestsLastRun)) {
      await axios.post(slackWebhookUrl, { text: message })
    }
  }

  // Find the tests which were failing but passed now
  const nowPassingTests = failedTestsLastRun.filter(
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
  failedTestsLastRun = testResults.failed

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

//  apply to /run-tests endpoint
app.use('/run-tests', testLimiter)

app.get('/run-tests', async (req, res) => {
  const testResults = await runTests()
  res.json(testResults)
})

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})

// Schedule tests to run every 1 minute
cron.schedule('*/1 * * * *', () => {
  runTests('API')
})

// Schedule tests to run every 5 minutes
cron.schedule('*/5 * * * *', () => {
  runTests()
})

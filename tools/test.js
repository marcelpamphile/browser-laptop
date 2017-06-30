/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const fs = require('fs')
const spawn = require('child_process').spawn

const TEST_DIR = process.env.TEST_DIR

const options = {
  env: process.env,
  shell: true
}

const intermittents = fs.readFileSync('./test/intermittents.txt')
  .toString()
  .split('\n')
  .filter((intermittent) => !intermittent.match(/^\s*$/) && !intermittent.match(/s*#/))

let testCommand = 'standard'
if (TEST_DIR !== 'lint') {
  testCommand = `mocha "test/${TEST_DIR}/**/*Test.js"`
}
const child = spawn(testCommand, options)

let output = ''
child.stdout.on('data', function (data) {
  const newData = data.toString()
  output += newData
  process.stdout.write(newData)
})

const matchFailing = (output) =>
  output.match(/\s+(\d+) failing\n/)

child.on('close', function (code) {
  if (code === 0) {
    console.log('Result code is 0, no aciton needed.')
    process.exit(0)
    return
  }

  // There;'s no such thing as an intermittent lint failures
  if (TEST_DIR === 'lint') {
    process.exit(1)
    return
  }

  console.log('Result code is not 0, let\'s check for intermittents...')
  const matchResult = matchFailing(output)
  if (!matchResult) {
    console.error('Could not find line which gives the number of failures.')
    process.exit(1)
    return
  }
  const expectedFailing = Number(matchResult[1])
  output = output.substring(matchResult.index)

  // Check if there were failures
  const results = output.split('\n')
  const failures = []
  results.forEach((result) => {
    const failingLineMatch = result.match(/\d+\) (.*):$/)
    if (failingLineMatch) {
      const match = failingLineMatch[1]
      failures.push(match)
    }
  })
  if (failures.length !== expectedFailing) {
    console.error('Could not extract the correct number of failing tests', failures.length, 'vs', expectedFailing)
    process.exit(1)
    return
  }

  const unknownFailures = failures.filter((failure) => !intermittents.includes(failure))
  if (unknownFailures.length === 0) {
    console.log('Only known intermittent failures were hit. Returning success!')
    process.exit(0)
  }
  console.log('Unknown failures exist:', unknownFailures)
  process.exit(1)
})

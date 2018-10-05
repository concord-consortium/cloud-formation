// const [,, ...args] = process.argv

const AWS = require('aws-sdk')
const fs = require('fs')
const util = require('util')
const path = require('path')
const { yamlParse } = require('yaml-cfn')

// Convert fs.readFile into Promise version of same
const readFile = util.promisify(fs.readFile)

AWS.config.update({region: 'us-east-1'})

console.log(`AWS Version: ${AWS.VERSION}`)
console.log(`AWS Access Key: ${AWS.config.credentials.accessKeyId}`)
console.log(`AWS Region: ${AWS.config.region}`)

// turn on logging
AWS.config.logger = console

function printParams (params, label) {
  console.log(`=== ${label} Parameters ===`)
  params.forEach((param) => {
    // console.log('%j', param)
    console.log(`${param.ParameterKey}: ${param.ParameterValue}`)
  })
}

// This returns a new list of parameters
// It modifies in place any originalParams that are present in modifications
// It then adds any parameters that were not in originalParams but are in modifications
function modifyParams (originalParams, modifications) {
  const modifiedParameters = []
  // Copy all original parameters and modify their values if defined
  // in parameterModifications
  originalParams.forEach((param) => {
    const modification = modifications[param.ParameterKey]
    if (modification) {
      // remove this modification so we can see what is left
      delete modifications[param.ParameterKey]
      param.ParameterValue = modification
    }
    modifiedParameters.push(param)
  })

  // Add any remaining parameters in parameterModifications
  for (const paramKey in modifications) {
    modifiedParameters.push({
      ParameterKey: paramKey,
      ParameterValue: modifications[paramKey]
    })
  }

  return modifiedParameters
}

function filterBasedOnTemplate (templateBody, parameters) {
  // load in the template so we look at the parameters it specifies
  const templateObject = yamlParse(templateBody)

  const validParameters = Object.keys(templateObject.Parameters)
  const definedParameters = parameters.map((param) => param.ParameterKey)

  // Check for any parameters specified in the template that we do not have defined
  let hasMissingParams = false
  validParameters.forEach((paramKey) => {
    if (!definedParameters.includes(paramKey)) {
      hasMissingParams = true
      console.log(`missing param: ${paramKey}`)
    }
  })
  if (hasMissingParams) {
    throw new Error('Template has parameters that are not defined')
  }

  // Filter out any paramters that we do have defined but are in the template
  console.log('=== Filtering parameters ===')
  return parameters.filter((param) => {
    if (validParameters.includes(param.ParameterKey)) {
      return true
    } else {
      console.log(`removing param: ${param.ParameterKey}`)
    }
  })
}

async function main () {
  const createConfigFile = path.join(__dirname, 'create-config.yml')
  const createConfigBody = await readFile(createConfigFile, 'utf8')
  const createConfig = yamlParse(createConfigBody)

  var cloudformation = new AWS.CloudFormation()

  const stacksResponse = await cloudformation.describeStacks({
    StackName: createConfig.OriginalStack }).promise()

  const originalStack = stacksResponse.Stacks[0]
  printParams(originalStack.Parameters, 'Original')

  const modifications = createConfig.ParameterModifications

  // Merge in the modifications
  const modifiedParameters = modifyParams(originalStack.Parameters, modifications)

  // Look for missing params based on template, and filter out any unnecssary param
  const templateFile = path.join(__dirname, '..', createConfig.Template)
  const templateBody = await readFile(templateFile, 'utf8')
  const newParameters = filterBasedOnTemplate(templateBody, modifiedParameters)

  printParams(newParameters, 'New')

  const createResult = await cloudformation.createStack({
    StackName: createConfig.Name,
    Capabilities: ['CAPABILITY_NAMED_IAM'],
    TemplateBody: templateBody,
    Parameters: newParameters
  }).promise()

  console.log('=== Result ===')
  console.log(JSON.stringify(createResult, null, 2))
}

// Handle errors during api calls, these cause rejected promises
// the main() call returns a promise which we can then use the catch method on
main().catch((err) => {
  console.log(err.stack)
})

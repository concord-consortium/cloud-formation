// const [,, ...args] = process.argv

const AWS = require('aws-sdk')
const fs = require('fs')
const util = require('util')
const path = require('path')
const prompts = require('prompts')
const { yamlParse, yamlDump } = require('yaml-cfn')

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
  writeParams(params, label)
}

//
// Path to a param file
//
function paramPath(filename) {
  return `param-sets/${filename}`
}

//
// Dump the params to a yaml file
//
function writeParamsToYML(params, filename) {
  fs.writeFileSync(paramPath(filename), yamlDump(params))
}

//
// Load params from a yaml file
//
async function readParamsFromYML(fileName) {
  return await yamlParse(fs.readFileSync(paramPath(fileName)))
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

  // Filter out any paramters that we do have defined but are not in the template
  console.log('=== Filtering parameters ===')
  return parameters.filter((param) => {
    if (validParameters.includes(param.ParameterKey)) {
      return true
    } else {
      console.log(`removing param: ${param.ParameterKey}`)
    }
  })
}

async function selectYMLFile(dir, prompt='Select file', extension='.yml') {
  let files = fs.readdirSync(dir).filter(fn => fn.endsWith(extension));
  const response = await prompts({
    type: 'select',
    name: 'fileName',
    message: prompt,
    choices: files.map(f => ({title: f, value: f}))
  })
  return response.fileName
}

// This returns a list of active stacks for this AWS account
async function getStackNames() {
  var cloudformation = new AWS.CloudFormation()
  const filters = ["CREATE_COMPLETE","UPDATE_COMPLETE"]
  const allStacks = await cloudformation.listStacks({StackStatusFilter:filters}).promise()
  const stackNames = allStacks.StackSummaries.map( (s) => s.StackName)
  return stackNames
}

async function createStack () {
  const stackChoices = await getStackNames()
  const response = await prompts([
    {
      type: 'text',
      name: 'configFile',
      initial: 'create-config.yml',
      message: 'Configuration file:',
      validate: (name) => name.endsWith(".yml") ? true : "must be a yml file"
    }, {
      type: 'autocomplete',
      name: 'sourceStack',
      message: 'select an existing stack to copy config from',
      choices: stackChoices.map( s => ({title: s, value: s}))
    }
  ]);

  const createConfigFile = path.join(__dirname, response.configFile)
  const createConfigBody = await readFile(createConfigFile, 'utf8')
  const createConfig = yamlParse(createConfigBody)

  var cloudformation = new AWS.CloudFormation()
  const stacksResponse = await cloudformation.describeStacks({
    StackName: createConfig.OriginalStack }).promise()

  const originalStack = stacksResponse.Stacks[0]
  printParams(originalStack.Parameters, 'Original')

  const modifications = createConfig.ParameterModifications
  const originalParams = originalStack.Parameters
  // Merge in the modifications
  const modifiedParameters = modifyParams(originalParams, modifications)

  // Look for missing params based on template, and filter out any unnecssary param
  const templateFile = path.join(__dirname, '..', createConfig.Template)
  const templateBody = await readFile(templateFile, 'utf8')
  const newParameters = filterBasedOnTemplate(templateBody, modifiedParameters)

  printParams(newParameters, 'New')

  // const createResult = await cloudformation.createStack({
  //   StackName: createConfig.Name,
  //   Capabilities: ['CAPABILITY_NAMED_IAM'],
  //   TemplateBody: templateBody,
  //   Parameters: newParameters
  // }).promise()

  console.log('=== Result ===')
  console.log(JSON.stringify(createResult, null, 2))
}

async function getStackParams(stackName) {
  var cloudformation = new AWS.CloudFormation()
  const stacksResponse = await cloudformation.describeStacks({StackName:stackName}).promise()
  return stacksResponse.Stacks[0].Parameters
}

async function saveStackParams() {
  const stackChoices = await getStackNames()
  const response = await prompts(
    {
      type: 'autocomplete',
      name: 'sourceStack',
      message: 'select an existing stack to copy config from',
      choices: stackChoices.map( s => ({title: s, value: s}))
    }
  )
  const stackName = response.sourceStack
  const nameResponse = await prompts(
    {
      type: 'text',
      name: 'fileName',
      message: 'File Name:',
      initial: `${stackName}-params.yml`
    }
  )
  const params = await getStackParams(stackName)
  writeParamsToYML(params,nameResponse.fileName)
  console.log(getStackParams(response.sourceStack))
}

async function inspectStackParams() {
  console.log(await readParamsFromYML(await selectYMLFile('param-sets')))
}

async function main() {
  response = await prompts({
    type: 'select',
    name: 'action',
    message: 'Select an action',
    choices: [
      { title: 'Save stack params', value: saveStackParams },
      { title: 'Inspect stack params', value: inspectStackParams },
      { title: 'Create stack', value: createStack },
    ]
  })
  await response.action()
}

// Handle errors during api calls, these cause rejected promises
// the main() call returns a promise which we can then use the catch method on
main().catch((err) => {
  console.log(err.stack)
})

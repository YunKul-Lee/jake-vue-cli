#!/usr/bin/env node

import * as fs from 'node:fs'
import * as path from 'node:path'

import { parseArgs } from 'node:util'

import prompts from 'prompts'
import { red, green, bold } from 'kolorist'

import * as banners from './utils/banners'

import renderTemplate from './utils/renderTemplate'
import { postOrderDirectoryTraverse, preOrderDirectoryTraverse } from './utils/directoryTraverse'
import getMessages from './utils/getMessages'

function isValidPackageName(projectName) {
  return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(projectName)
}

function toValidPackageName(projectName) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z0-9-~]+/g, '-')
}

function canSkipEmptying(dir: string) {
  if (!fs.existsSync(dir)) {
    return true
  }

  const files = fs.readdirSync(dir)
  if (files.length === 0) {
    return true
  }
  if (files.length === 1 && files[0] === '.git') {
    return true
  }

  return false
}

function emptyDir(dir) {
  if (!fs.existsSync(dir)) {
    return
  }

  postOrderDirectoryTraverse(
    dir,
    (dir) => fs.rmdirSync(dir),
    (file) => fs.unlinkSync(file)
  )
}

async function init() {
  console.log()
  console.log(banners.defaultBanner)
  console.log()

  const cwd = process.cwd()
  // possible options:
  // --default
  // --typescript / --ts
  // --jsx
  // --router / --vue-router
  // --pinia
  // --with-tests / --tests (equals to `--vitest --cypress`)
  // --vitest
  // --cypress
  // --nightwatch
  // --playwright
  // --eslint
  // --eslint-with-prettier (only support prettier through eslint for simplicity)
  // --vue-devtools / --devtools
  // --force (for force overwriting)

  const args = process.argv.slice(2)

  // alias is not supported by parseArgs
  const options = {
    typescript: { type: 'boolean' },
    ts: { type: 'boolean' },
    'with-tests': { type: 'boolean' },
    tests: { type: 'boolean' },
    'vue-router': { type: 'boolean' },
    router: { type: 'boolean' },
    'vue-devtools': { type: 'boolean' },
    devtools: { type: 'boolean' }
  } as const

  const { values: argv, positionals } = parseArgs({
    args,
    options,
    strict: false
  })

  let targetDir = positionals[0]
  const defaultProjectName = !targetDir ? 'jake-vue-project' : targetDir

  const forceOverwrite = argv.force

  const messages = getMessages()

  // 선택결과
  let result: {
    projectName?: string
    shouldOverwrite?: boolean
    packageName?: string
  } = {}

  try {
    result = await prompts(
      [
        {
          name: 'projectName',
          type: targetDir ? null : 'text',
          message: messages.projectName.message,
          initial: defaultProjectName,
          onState: (state) => (targetDir = String(state.value).trim() || defaultProjectName)
        },
        {
          name: 'shouldOverwrite',
          type: () => (canSkipEmptying(targetDir) || forceOverwrite ? null : 'toggle'),
          message: () => {
            const dirForPrompt =
              targetDir === '.'
                ? messages.shouldOverwrite.dirForPrompts.current
                : `${messages.shouldOverwrite.dirForPrompts.target} "${targetDir}"`

            return `${dirForPrompt} ${messages.shouldOverwrite.message}`
          },
          initial: true,
          active: messages.defaultToggleOptions.active,
          inactive: messages.defaultToggleOptions.inactive
        },
        {
          name: 'overwriteChecker',
          type: (values) => {
            if(values.shouldOverwrite === false) {
              throw new Error(red('✖') + ` ${messages.errors.operationCancelled}`)
            }
            return null
          }
        },
        {
          name: 'packageName',
          type: () => (isValidPackageName(targetDir) ? null : 'text'),
          message: messages.packageName.message,
          initial: () => toValidPackageName(targetDir),
          validate: (dir) => isValidPackageName(dir) || messages.packageName.invalidMessage
        }
      ]
    )
  } catch (cancelled) {
    console.log(cancelled.message)
    process.exit(1)
  }

  const {
    projectName,
    packageName = projectName ?? defaultProjectName,
    shouldOverwrite = argv.force
  } = result

  const root = path.join(cwd, targetDir)

  if(fs.existsSync(root) && shouldOverwrite) {
    emptyDir(root)
  } else if (!fs.existsSync(root)) {
    fs.mkdirSync(root)
  }

  console.log(`\n${messages.infos.scaffolding} ${root}...`)

  const pkg = { name: packageName, version: '0.0.0' }
  fs.writeFileSync(path.resolve(root, 'package.json'), JSON.stringify(pkg, null, 2))

  const templateRoot = path.resolve(__dirname, 'template')
  const callbacks = []
  const render = function render(templateName) {
    const templateDir = path.resolve(templateRoot, templateName)
    renderTemplate(templateDir, root, callbacks)
  }

  // Render base template
  render('base')
  render('config/router')
  render('config/pinia')
  // render('config/vitest')

}

init().catch((e) => {
  console.error(e)
})
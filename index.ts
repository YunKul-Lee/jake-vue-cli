#!/usr/bin/env node

import * as fs from 'node:fs'
import * as path from 'node:path'

import { parseArgs } from 'node:util'

import prompts from 'prompts'
import { red, green, bold } from 'kolorist'

import ejs from 'ejs'

import * as banners from './utils/banners'

import renderTemplate from './utils/renderTemplate'
import { postOrderDirectoryTraverse, preOrderDirectoryTraverse } from './utils/directoryTraverse'
import generateReadme from './utils/generateReadme'
import getCommand from './utils/getCommand'

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

  const messages = {
    "projectName": {
      "message": "Project name:"
    },
    "shouldOverwrite": {
      "dirForPrompts": {
        "current": "Current directory",
        "target": "Target directory"
      },
      "message": "is not empty. Remove existing files and continue?"
    },
    "packageName": {
      "message": "Package name:",
      "invalidMessage": "Invalid package.json name"
    },
    "needsTypeScript": {
      "message": "Add TypeScript?"
    },
    "needsJsx": {
      "message": "Add JSX Support?"
    },
    "needsRouter": {
      "message": "Add Vue Router for Single Page Application development?"
    },
    "needsPinia": {
      "message": "Add Pinia for state management?"
    },
    "needsVitest": {
      "message": "Add Vitest for Unit Testing?"
    },
    "needsE2eTesting": {
      "message": "Add an End-to-End Testing Solution?",
      "hint": "- Use arrow-keys. Return to submit.",
      "selectOptions": {
        "negative": { "title": "No" },
        "cypress": {
          "title": "Cypress",
          "desc": "also supports unit testing with Cypress Component Testing"
        },
        "nightwatch": {
          "title": "Nightwatch",
          "desc": "also supports unit testing with Nightwatch Component Testing"
        },
        "playwright": { "title": "Playwright" }
      }
    },
    "needsEslint": {
      "message": "Add ESLint for code quality?"
    },
    "needsPrettier": {
      "message": "Add Prettier for code formatting?"
    },
    "needsDevTools": {
      "message": "Add Vue DevTools 7 extension for debugging? (experimental)"
    },
    "errors": {
      "operationCancelled": "Operation cancelled"
    },
    "defaultToggleOptions": {
      "active": "Yes",
      "inactive": "No"
    },
    "infos": {
      "scaffolding": "Scaffolding project in",
      "done": "Done. Now run:"
    }
  }


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

  // Add configs.
  render('config/router')
  render('config/pinia')

  // Render code template
  render('code')

  // Render entry file (main.js).
  render('entry')

  // An external data store for callbacks to share data
  const dataStore = {}
  // Process callbacks
  for (const cb of callbacks) {
    await cb(dataStore)
  }

  // EJS template rendering
  preOrderDirectoryTraverse(
    root,
    () => {},
    (filepath) => {
      if (filepath.endsWith('.ejs')) {
        const template = fs.readFileSync(filepath, 'utf-8')
        const dest = filepath.replace(/\.ejs$/, '')
        const content = ejs.render(template, dataStore[dest])

        fs.writeFileSync(dest, content)
        fs.unlinkSync(filepath)
      }
    }
  )

  // Cleanup.
  // Remove all the remaining `.ts` files
  preOrderDirectoryTraverse(
    root,
    () => {},
    (filepath) => {
      if (filepath.endsWith('.ts')) {
        fs.unlinkSync(filepath)
      }
    }
  )

  const userAgent = process.env.npm_config_user_agent ?? ''
  const packageManager = 'pnpm'

  // TODO :: README generation
  // fs.writeFileSync(
  //   path.resolve(root, 'README.md'),
  //   generateReadme({
  //     projectName: result.projectName ?? result.packageName ?? defaultProjectName,
  //     packageManager,
  //     needsTypeScript,
  //     needsVitest,
  //     needsCypress,
  //     needsNightwatch,
  //     needsPlaywright,
  //     needsNightwatchCT,
  //     needsCypressCT,
  //     needsEslint
  //   })
  // )
}

init().catch((e) => {
  console.error(e)
})
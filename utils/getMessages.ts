import * as path from 'node:path'

interface MessageItem {
  hint?: string
  message: string
  invalidMessage?: string
  dirForPrompts?: {
    current: string
    target: string
  }
  toggleOptions?: {
    active: string
    inactive: string
  }
  selectOptions?: {
    [key: string]: { title: string; desc?: string }
  }
}

interface Messages {
  projectName: MessageItem
  shouldOverwrite: MessageItem
  packageName: MessageItem
  needsTypeScript: MessageItem
  needsJsx: MessageItem
  needsRouter: MessageItem
  needsPinia: MessageItem
  needsVitest: MessageItem
  needsE2eTesting: MessageItem
  needsEslint: MessageItem
  needsPrettier: MessageItem
  needsDevTools: MessageItem
  errors: {
    operationCancelled: string
  }
  defaultToggleOptions: {
    active: string
    inactive: string
  }
  infos: {
    scaffolding: string
    done: string
  }
}

export default function getMessages() {

  const rootDir = path.resolve(__dirname, 'messages')
  const messageFilePath = path.resolve(rootDir, 'messages.json')

  const msg: Messages = require(messageFilePath)

  return msg
}
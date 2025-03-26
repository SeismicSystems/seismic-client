import type {
  ChatPostMessageArguments,
  ChatPostMessageResponse,
  MessageAttachment,
} from '@slack/web-api'
import { WebClient } from '@slack/web-api'

const LIGHT_GRAY = '#D3D3D3'

type SlackMessage = {
  channel: string
  message: string
  title?: string
  // Can be any hex color e.g. '#439FE0'
  color?: 'good' | 'warning' | 'danger' | string
  threadTs?: string
} & Partial<ChatPostMessageArguments>

class SlackNotifier {
  private web: WebClient
  private silent: boolean

  constructor(token: string, silent?: boolean) {
    this.web = new WebClient(token)
    this.silent = silent ?? false
  }

  /**
   * Sends a basic message to a channel with a color
   */
  async send({
    channel,
    message,
    title,
    color,
    threadTs,
  }: SlackMessage): Promise<ChatPostMessageResponse | { ts?: string }> {
    if (this.silent) {
      return { ts: undefined }
    }
    const defaultAttachment: MessageAttachment = {
      color,
      title,
      text: message,
    }

    const postParams: ChatPostMessageArguments = {
      channel,
      attachments: [defaultAttachment],
      // @ts-expect-error: legacy slack api
      fallback: `${title}\n${message}`,
      thread_ts: threadTs,
    }

    console.log(`Posting to ${channel}: ${JSON.stringify({ title, message })}`)
    return this.web.chat.postMessage(postParams)
  }

  async urgent({
    message,
    title,
    color = 'danger',
    threadTs,
  }: Omit<SlackMessage, 'channel'>) {
    return this.send({
      channel: '#log-urgent',
      color,
      message,
      title,
      threadTs,
    })
  }

  async status({
    message,
    title,
    color = LIGHT_GRAY,
    threadTs,
  }: Omit<SlackMessage, 'channel'>) {
    return this.send({
      channel: '#log-status',
      color,
      message,
      title,
      threadTs,
    })
  }
}

export default SlackNotifier

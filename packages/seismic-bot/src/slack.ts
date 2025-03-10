import type {
  ChatPostMessageArguments,
  MessageAttachment,
} from '@slack/web-api'
import { WebClient } from '@slack/web-api'

const LIGHT_GRAY = '#D3D3D3'

class SlackNotifier {
  private web: WebClient

  constructor(token: string) {
    this.web = new WebClient(token)
  }

  /**
   * Sends a basic message to a channel with a color
   */
  async send({
    channel,
    message,
    title,
    color,
  }: {
    channel: string
    message: string
    title?: string
    // Can be any hex color e.g. '#439FE0'
    color?: 'good' | 'warning' | 'danger' | string
  } & Partial<ChatPostMessageArguments>): Promise<any> {
    const defaultAttachment: MessageAttachment = {
      color,
      title,
      text: message,
    }

    const postParams: ChatPostMessageArguments = {
      channel,
      attachments: [defaultAttachment],
    }

    return this.web.chat.postMessage(postParams)
  }

  async urgent(message: string, title?: string) {
    return this.send({
      channel: '#urgent',
      color: 'danger',
      message,
      title,
    })
  }

  async status(message: string, title?: string) {
    return this.send({
      channel: '#log-status',
      color: LIGHT_GRAY,
      message,
      title,
    })
  }
}

export default SlackNotifier

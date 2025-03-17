import { describe, it } from 'bun:test'

import { testWsConnection } from '@sviem-tests/tests/ws.ts'

describe('ws', () => {
  it('should connect to the ws', testWsConnection)
})

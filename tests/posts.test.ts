import { describe, expect, it } from 'vitest'
import { formatTimestamp, sanitizePermalink } from '@/lib/threads/posts'
import { classifySearchError } from '@/lib/threads/errors'

describe('formatTimestamp', () => {
  it.each([
    ['2026-09-17T10:15:30+0000', '2026-09-17T10:15:30.000Z', '17 Sep 2026, 10:15 UTC'],
    ['2026-09-17T10:17:17+0000', '2026-09-17T10:17:17.000Z', '17 Sep 2026, 10:17 UTC'],
    ['2026-01-05T09:05:00Z', '2026-01-05T09:05:00.000Z', '5 Jan 2026, 09:05 UTC'],
    ['2026-09-17T01:30:00+02:00', '2026-09-16T23:30:00.000Z', '16 Sep 2026, 23:30 UTC'],
    ['2026-12-31T22:00:00-0300', '2027-01-01T01:00:00.000Z', '1 Jan 2027, 01:00 UTC'],
    ['2026-09-17T10:15:30.123+0000', '2026-09-17T10:15:30.000Z', '17 Sep 2026, 10:15 UTC'],
  ])('formats %s in UTC', (input, iso, label) => {
    expect(formatTimestamp(input)).toEqual({ iso, label })
  })

  it.each(['yesterday', '2026-02-31T10:00:00+0000', '2026-13-01T10:00:00+0000', '2026-09-17T24:00:00+0000', '2026-09-17T10:61:00+0000', '2026-09-17 10:15:30', ''])(
    'rejects %s',
    (input) => {
      expect(formatTimestamp(input)).toBeUndefined()
    },
  )
})

describe('sanitizePermalink', () => {
  it('normalizes a valid Threads URL', () => {
    expect(sanitizePermalink('https://www.threads.com/@someone/post/ABC')).toBe('https://www.threads.com/@someone/post/ABC')
  })

  it('accepts an @ in the path (real Meta permalink)', () => {
    expect(sanitizePermalink('https://www.threads.com/@_voaryy/post/DdYoGTHCBYs')).toBe(
      'https://www.threads.com/@_voaryy/post/DdYoGTHCBYs',
    )
  })

  it.each(['https://user@www.threads.com/@someone', 'https://user:pass@threads.net/x', 'https://@threads.com/x'])(
    'rejects userinfo before the host: %s',
    (value) => {
      expect(sanitizePermalink(value)).toBeUndefined()
    },
  )

  it.each([undefined, null, '', 'not a url', 'https://sub.threads.com/x', 'https://threads.com@evil.com/x', 'ftp://threads.com/x'])(
    'rejects %s',
    (value) => {
      expect(sanitizePermalink(value)).toBeUndefined()
    },
  )
})

describe('classifySearchError', () => {
  it.each([
    [{ kind: 'http_error', status: 400, metaCode: 190 }, 'session_expired'],
    [{ kind: 'http_error', status: 401 }, 'session_expired'],
    [{ kind: 'http_error', status: 400, metaCode: 4 }, 'quota_exceeded'],
    [{ kind: 'http_error', status: 400, metaCode: 32 }, 'quota_exceeded'],
    [{ kind: 'http_error', status: 429 }, 'quota_exceeded'],
    [{ kind: 'http_error', status: 400, metaCode: 10 }, 'permission_missing'],
    [{ kind: 'http_error', status: 403, metaCode: 299 }, 'permission_missing'],
    [{ kind: 'http_error', status: 500, metaCode: 1 }, 'upstream_unknown'],
    [{ kind: 'http_error', status: 500, metaCode: 2 }, 'upstream_unknown'],
    [{ kind: 'invalid_response', status: 200 }, 'upstream_unknown'],
    [{ kind: 'network' }, 'upstream_unavailable'],
    [{ kind: 'timeout' }, 'upstream_unavailable'],
  ] as const)('classifies %j as %s', (error, expected) => {
    expect(classifySearchError(error)).toBe(expected)
  })
})

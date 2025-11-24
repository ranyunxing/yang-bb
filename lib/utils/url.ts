export function extractDomainFromUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  let input = url.trim()
  if (!input) return undefined

  // 如果没有协议，补充 https 以便 URL 解析
  let candidate = input
  try {
    if (!/^https?:\/\//i.test(candidate)) {
      candidate = `https://${candidate}`
    }

    const parsed = new URL(candidate)
    let host = parsed.hostname.toLowerCase()

    if (host.startsWith('www.')) {
      host = host.slice(4)
    }

    if (host) {
      return host
    }
  } catch (error) {
    // fallback：手动解析
  }

  // 手动解析：去掉协议、路径、端口等
  let manual = input.toLowerCase()
  manual = manual.replace(/^https?:\/\//, '')
  manual = manual.replace(/^www\./, '')
  manual = manual.split('/')[0]
  manual = manual.split('?')[0]
  manual = manual.split('#')[0]
  manual = manual.split('@').pop() || ''
  manual = manual.split(':')[0]

  manual = manual.trim()

  return manual || undefined
}

export function buildDomainSearch(input?: string | null): {
  equals?: string
  prefix?: string
} {
  if (!input) return {}
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return {}

  const domain = extractDomainFromUrl(trimmed)
  if (domain && domain.length > 0 && domain.includes('.')) {
    return { equals: domain }
  }

  if (/^[a-z0-9.-]+$/.test(trimmed)) {
    return { prefix: trimmed }
  }

  return {}
}


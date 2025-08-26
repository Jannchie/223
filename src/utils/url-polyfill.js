// Simple URL polyfill for browser compatibility
export function resolve(from, to) {
  if (to.startsWith('http://') || to.startsWith('https://') || to.startsWith('//')) {
    return to;
  }
  
  if (to.startsWith('/')) {
    const base = new URL(from);
    return base.origin + to;
  }
  
  const baseUrl = new URL(from);
  return new URL(to, baseUrl).href;
}

export function parse(url) {
  try {
    const parsed = new URL(url);
    return {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      href: parsed.href
    };
  } catch (e) {
    return null;
  }
}

export function format(urlObject) {
  if (typeof urlObject === 'string') {
    return urlObject;
  }
  
  const { protocol, hostname, port, pathname, search, hash } = urlObject;
  let url = '';
  
  if (protocol) {
    url += protocol;
    if (!protocol.endsWith('://')) {
      url += '://';
    }
  }
  
  if (hostname) {
    url += hostname;
  }
  
  if (port) {
    url += ':' + port;
  }
  
  if (pathname) {
    url += pathname;
  }
  
  if (search) {
    url += search.startsWith('?') ? search : '?' + search;
  }
  
  if (hash) {
    url += hash.startsWith('#') ? hash : '#' + hash;
  }
  
  return url;
}

export default { resolve, parse, format };
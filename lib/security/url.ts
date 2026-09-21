/**
 * URL safety guards - SSRF prevention for brief fetch and apply navigation.
 * Allows only public http(s) targets; blocks loopback, link-local, and RFC1918.
 */

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "::",
  "[::]",
  "metadata.google.internal",
  "metadata",
]);

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
  if (parts[0] === 0) return true; // 0.0.0.0/8
  if (parts[0] === 10) return true; // 10.0.0.0/8
  if (parts[0] === 127) return true; // 127.0.0.0/8 loopback
  if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16 link-local
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
  if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
  if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // 100.64.0.0/10 CGNAT
  if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true; // 198.18.0.0/15 benchmark
  if (parts[0] >= 224) return true; // Multicast (224.0.0.0/4) and reserved (240.0.0.0/4)
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const bare = (host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host).toLowerCase();
  if (bare === "::1" || bare === "::" || bare === "0:0:0:0:0:0:0:1" || bare === "0:0:0:0:0:0:0:0") return true;
  if (bare.startsWith("::ffff:")) {
    const rest = bare.slice(7);
    if (BLOCKED_HOSTS.has(rest) || isPrivateIpv4(rest)) return true;
    const hexParts = rest.split(":");
    if (hexParts.length === 2) {
      const high = parseInt(hexParts[0], 16);
      const low = parseInt(hexParts[1], 16);
      if (!Number.isNaN(high) && !Number.isNaN(low)) {
        const ipv4Str = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
        if (BLOCKED_HOSTS.has(ipv4Str) || isPrivateIpv4(ipv4Str)) return true;
      }
    }
  }
  // fe80::/10 link-local
  if (/^fe[89ab]/i.test(bare)) return true;
  // fc00::/7 unique local (fc00:: to fdff::)
  if (/^f[cd]/i.test(bare)) return true;
  // fec0::/10 site-local (deprecated)
  if (/^fe[c-f]/i.test(bare)) return true;
  return false;
}

/** True when `url` is an http(s) URL targeting a non-private host. */
export function isPublicHttpUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();
  if (!host) return false;
  if (BLOCKED_HOSTS.has(host)) return false;
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (isPrivateIpv4(host)) return false;
  if (isPrivateIpv6(host)) return false;

  return true;
}

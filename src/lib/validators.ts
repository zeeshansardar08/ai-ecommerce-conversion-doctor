import { lookup } from "dns/promises";
import { isIP } from "net";

export const normalizeUrl = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const isPrivateIpv4 = (ip: string) => {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
};

const isPrivateIpv6 = (ip: string) => {
  return (
    ip === "::1" ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("fe80")
  );
};

const isPrivateIp = (ip: string) => {
  if (isIP(ip) === 4) {
    return isPrivateIpv4(ip);
  }
  if (isIP(ip) === 6) {
    return isPrivateIpv6(ip);
  }
  return false;
};

const isBlockedHostname = (hostname: string) => {
  const lowered = hostname.toLowerCase();
  return (
    lowered === "localhost" ||
    lowered.endsWith(".local") ||
    lowered.endsWith(".internal")
  );
};

export const validateUrl = async (input: string) => {
  const normalized = normalizeUrl(input);
  if (!normalized) {
    return { ok: false, error: "URL is required." } as const;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { ok: false, error: "Invalid URL format." } as const;
  }

  if (!/https?:/.test(parsed.protocol)) {
    return { ok: false, error: "Only HTTP/HTTPS URLs are allowed." } as const;
  }

  if (isBlockedHostname(parsed.hostname)) {
    return { ok: false, error: "URL is not allowed." } as const;
  }

  if (isIP(parsed.hostname)) {
    if (isPrivateIp(parsed.hostname)) {
      return { ok: false, error: "Private IPs are not allowed." } as const;
    }
    return { ok: true, normalized } as const;
  }

  try {
    const resolved = await lookup(parsed.hostname, { all: true });
    const blocked = resolved.some((entry) => isPrivateIp(entry.address));
    if (blocked) {
      return { ok: false, error: "URL resolves to a private IP." } as const;
    }
  } catch {
    return { ok: false, error: "Unable to resolve URL hostname." } as const;
  }

  return { ok: true, normalized } as const;
};

export const validateEmail = (email: string) => {
  const trimmed = email.trim().toLowerCase();
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  return { email: trimmed, isValid };
};

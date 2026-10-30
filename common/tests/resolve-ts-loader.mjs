import { access } from "node:fs/promises";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && /\.js(?:\?.*)?$/.test(specifier)) {
    const candidate = new URL(specifier.replace(/\.js(?=\?|$)/, ".ts"), context.parentURL);
    try {
      await access(candidate);
      return nextResolve(candidate.href, context);
    } catch {
    }
  }
  return nextResolve(specifier, context);
}

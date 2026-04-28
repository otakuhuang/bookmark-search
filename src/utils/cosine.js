export function cosine(a, b) {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const na = Math.sqrt(a.reduce((s, v) => s + v*v, 0));
  const nb = Math.sqrt(b.reduce((s, v) => s + v*v, 0));
  return dot / (na * nb);
}
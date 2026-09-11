// Inactive @modal slot (no intercepted route) -> renders nothing.
// Without this file, a reload on /[slug] would return a 404 for this
// unmatched parallel slot.
export default function Default() {
  return null;
}

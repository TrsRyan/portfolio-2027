// Fallback for the implicit `children` slot if Next can't restore its state
// (a reload on a route where @modal is active). Official Vercel example
// (nextgram). Our real routes (/ and /[slug]) always match their page, so
// in practice this file never renders.
export default function Default() {
  return null;
}

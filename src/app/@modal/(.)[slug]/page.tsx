/**
 * Intercepted route — renders NOTHING. Its only job: on a soft navigation to
 * `/[slug]`, fill the @modal slot so Next keeps `children` = the homepage
 * (otherwise the real project page would render underneath the modal).
 *
 * The modal itself is rendered by <ProjectModalHost> (persistent, driven by
 * usePathname), which controls its own mount/unmount -> it can delay the
 * exit for the duration of the animation, which the slot doesn't allow.
 */
export default function ProjectModalSlot() {
  return null;
}

// Soft navigation to `/` while a modal is open (e.g. clicking "Return" in
// <ProjectDetail>): without this file, the @modal slot would stay displayed
// (parallel routes behavior). null -> it clears.
export default function ModalSlotHome() {
  return null;
}

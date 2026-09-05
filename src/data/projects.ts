export type Project = {
  title: string[]; // une entrée = une ligne, coupures décidées à la main (comme sur la homepage)
  slug: string;
  year: string;
  client: string;
  tools: string[];
  overview: string;
  liveUrl: string;
};

export const PROJECTS: Project[] = [
  {
    title: ["Womanhood"],
    slug: "womanhood",
    year: "2022",
    client: "Womanhood",
    tools: ["Php", "React", "Gsap"],
    overview:
      "Trois personnages féminins à la recherche de la fine frontière entre l'homme et la femme. Mêlant fiction et réalité, art du cirque, musique et documentaire, WoManHood vise à déplacer notre point de vue sur l'identité et le genre.",
    liveUrl: "#",
  },
  {
    title: ["Marais de", "Biestebroeck"],
    slug: "marais-de-biestebroeck",
    year: "2025",
    client: "Marais de Biestebroeck", // placeholder
    tools: ["Next.js", "GSAP"], // placeholder
    overview: "Placeholder overview — remplacé par le vrai contenu Sanity plus tard.",
    liveUrl: "#",
  },
  {
    title: ["Brussels", "Shortfilm", "Festival"],
    slug: "brussels-shortfilm-festival",
    year: "2026",
    client: "Brussels Shortfilm Festival", // placeholder
    tools: ["Next.js", "Sanity"], // placeholder
    overview: "Placeholder overview — remplacé par le vrai contenu Sanity plus tard.",
    liveUrl: "#",
  },
  {
    title: ["Handtrack"],
    slug: "handtrack",
    year: "2026",
    client: "Handtrack", // placeholder
    tools: ["React", "GSAP"], // placeholder
    overview: "Placeholder overview — remplacé par le vrai contenu Sanity plus tard.",
    liveUrl: "#",
  },
];

export function findProjectIndex(slug: string): number {
  return PROJECTS.findIndex((p) => p.slug === slug);
}
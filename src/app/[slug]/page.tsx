import Link from "next/link";
import { notFound } from "next/navigation";
import { PROJECTS, findProjectIndex } from "../../data/projects";
import styles from "./page.module.css";

export function generateStaticParams() {
  return PROJECTS.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const project = PROJECTS[findProjectIndex(slug)];
  return { title: project ? project.title.join(" ") : "Project" };
}

export default async function ProjectPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const index = findProjectIndex(slug);
  if (index === -1) notFound();

  const project = PROJECTS[index];
  const prev = index > 0 ? PROJECTS[index - 1] : null;
  const next = index < PROJECTS.length - 1 ? PROJECTS[index + 1] : null;

  return (
    <main className={styles.page}>
      <h1 className={styles.srOnly}>{project.title.join(" ")}</h1>

      <Link className={styles.return} href="/">
        Return
      </Link>

      <div className={styles.media} aria-hidden="true" />

      <div className={styles.info}>
        <div className={styles.overview}>
          <p className={styles.overviewLabel}>Overview</p>
          <p className={styles.overviewText}>{project.overview}</p>
        </div>

        <div className={styles.meta}>
          <div className={styles.metaRow}>
            <p className={styles.metaTerm}>Year</p>
            <p className={styles.metaValue}>{project.year}</p>
          </div>
          <div className={styles.metaRow}>
            <p className={styles.metaTerm}>Client</p>
            <p className={styles.metaValue}>{project.client}</p>
          </div>
          <div className={styles.metaRow}>
            <p className={styles.metaTerm}>Tools</p>
            <div className={styles.metaValue}>
              {project.tools.map((tool) => (
                <p key={tool}>{tool}</p>
              ))}
            </div>
          </div>
          <div className={styles.live}>
            <a className={styles.liveLink} href={project.liveUrl} target="_blank" rel="noreferrer">
              Live Website
            </a>
          </div>
        </div>
      </div>

      <nav className={styles.pager} aria-label="Autres projets">
        {prev ? (
          <Link className={styles.pagerLink} href={`/${prev.slug}`}>
            Prev
          </Link>
        ) : (
          <span className={styles.pagerLink}>Prev</span>
        )}
        {next ? (
          <Link className={styles.pagerLink} href={`/${next.slug}`}>
            Next
          </Link>
        ) : (
          <span className={styles.pagerLink}>Next</span>
        )}
      </nav>
    </main>
  );
}

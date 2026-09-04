import styles from "./page.module.css";

type WorkItem = {
  title: string[]; // une entrée = une ligne ; les coupures sont décidées à la main
  slug: string;
  date: string;
};

// Contenu figé le temps de l'intégration statique — branché sur Sanity à l'étape 3.3.
const WORK: WorkItem[] = [
  { title: ["Womanhood"], slug: "womanhood", date: "2022" },
  { title: ["Marais de", "Biestebroeck"], slug: "marais-de-biestebroeck", date: "2025" },
  {
    title: ["Brussels", "Shortfilm", "Festival"],
    slug: "brussels-shortfilm-festival",
    date: "2026",
  },
  { title: ["Handtrack"], slug: "handtrack", date: "2026" },
];

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.siteHeader}>
        <p className={styles.siteHeaderName}>Torres Ryan</p>
        <p className={styles.siteHeaderBio}>
          I’m a motion-focused front-end developer. My journey started with video
          editing at 11, an early fascination with movement and timing. In 2022, I
          discovered the web and found the perfect playground to merge animation
          with interactive experiences.
        </p>
        <p className={styles.siteHeaderTime}>
          Brussels, Belgium UTC+1 -{" "}
          <span className={styles.siteHeaderClock}>23:43:08</span>
        </p>
      </header>

      <div className={styles.stroke} aria-hidden="true" />

      <section className={styles.work}>
        <p className={styles.workLabel}>Work({WORK.length})</p>

        <ol className={styles.workList}>
          {WORK.map((item) => (
            <li className={styles.workItem} key={item.slug}>
              <span className={styles.workDate}>{item.date}</span>
              <a className={styles.workLink} href={`/${item.slug}`}>
                <span className={styles.workTitle}>
                  {item.title.map((line, i) => (
                    <span className={styles.workTitleLine} key={i}>
                      {line}
                    </span>
                  ))}
                </span>
                <span className={styles.workThumb} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ol>

        <address className={styles.siteContact}>
          <a
            className={styles.siteContactLink}
            href="https://www.linkedin.com/in/torres-ryan/"
            target="_blank"
            rel="noreferrer"
          >
            Linkedin
          </a>
          <a
            className={styles.siteContactLink}
            href="/cv.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Resume
          </a>
          <a
            className={`${styles.siteContactLink} ${styles.siteContactEmail}`}
            href="mailto:ryan-torres@outlook.com"
          >
            ryan-torres@outlook.com
          </a>
        </address>
      </section>
    </main>
  );
}

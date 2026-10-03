import styles from "./page.module.css";
import { sanityFetch } from "../sanity/lib/fetch";
import { PROJECTS_QUERY, SETTINGS_QUERY } from "../sanity/lib/queries";
import ProjectLink from "../components/ProjectLink";
import PreloadProjectImages from "../components/PreloadProjectImages";
import SwapLink from "../components/SwapLink";
import UnderlineLink from "../components/UnderlineLink";
import SanityImage from "../components/SanityImage";
import HomeIntro from "../components/HomeIntro";
import LiveClock from "../components/LiveClock";

// Thumbnail: square, capped at --thumb-size (max 220px). We ask the CDN for 2x.
const THUMB_PX = 440;

// Fallback values if the `settings` doc (or a field) is empty.
const FALLBACK = {
  name: "Ryan Torres",
  bio: "I’m a motion-focused front-end developer. My journey started with video editing at 11, an early fascination with movement and timing. In 2022, I discovered the web and found the perfect playground to merge animation with interactive experiences.",
  location: "Brussels, Belgium",
  timezone: "Europe/Brussels",
  linkedinUrl: "https://www.linkedin.com/in/torres-ryan/",
  email: "ryan-torres@outlook.com",
};

export default async function Home() {
  const [projects, settings] = await Promise.all([
    sanityFetch({ query: PROJECTS_QUERY }),
    sanityFetch({ query: SETTINGS_QUERY }),
  ]);

  const name = settings?.name ?? FALLBACK.name;
  const bio = settings?.bio ?? FALLBACK.bio;
  const location = settings?.location ?? FALLBACK.location;
  const timezone = settings?.timezone ?? FALLBACK.timezone;
  const linkedinUrl = settings?.linkedinUrl ?? FALLBACK.linkedinUrl;
  // No /cv.pdf fallback: the file doesn't exist -> a 404 link. The Resume
  // link only shows once a real PDF is set in Sanity (settings.resume).
  const resumeUrl = settings?.resumeUrl ?? null;
  const email = settings?.email ?? FALLBACK.email;

  return (
    <main className={styles.page}>
      <PreloadProjectImages projects={projects} />
      <HomeIntro>
        <header className={styles.siteHeader}>
          {/* The slot stays in flow and keeps the name's height while the
              <h1> switches to position:fixed (intro) — otherwise the content
              below would jump up. */}
          <div className={styles.siteHeaderNameSlot} data-intro-name-slot>
            <h1 className={styles.siteHeaderName} data-intro-name>
              {name}
            </h1>
          </div>
          <p className={styles.siteHeaderBio} data-intro-split>
            {bio}
          </p>
          {/* No SplitText here (the clock re-renders every second). The <p>
              is the mask (overflow:clip), .riseInner rises underneath —
              React keeps rewriting the time inside without conflict
              (transform ≠ DOM). */}
          <p className={styles.siteHeaderTime} data-intro-rise>
            <span className={styles.riseInner} data-intro-rise-line>
              {location} UTC+1{" - "}
              <LiveClock className={styles.siteHeaderClock} timeZone={timezone} />
            </span>
          </p>
        </header>

        <div className={styles.stroke} data-intro-stroke aria-hidden="true" />

        <section className={styles.work}>
          <h2 className={styles.workLabel} data-intro-split>
            Work({projects.length})
          </h2>

          <ol className={styles.workList}>
            {projects.map((item) => {
              // .trim() per line: removes a stray space before the \n in the
              // title (and a stray \r injected on Windows) — otherwise the
              // first line's thumbnail shifts out of place.
              const lines = (
                item.titleLines ?? (item.title ? [item.title] : [])
              ).map((line) => line.trim());
              return (
                <li className={styles.workItem} key={item._id}>
                  <span className={styles.workDate} data-intro-split>
                    {item.year}
                  </span>
                  <ProjectLink className={styles.workLink} project={item}>
                    <span className={styles.workTitle} data-intro-split>
                      {lines.map((line, i) => (
                        <span className={styles.workTitleLine} key={i}>
                          {/* .workTitleClip = the line's mask
                              (overflow:clip); .workTitleText = what rises on
                              intro. A separate wrapper so it does NOT clip
                              the thumbnail (a flex sibling). */}
                          <span className={styles.workTitleClip}>
                            <span className={styles.workTitleText} data-intro-line>
                              {line}
                            </span>
                          </span>
                          {/* Thumbnail on the first line (see the mockup).
                              .workThumb       = fixed mask, aligned with the title
                              .workThumbReveal = the intro rises it in
                                                 (overflow:hidden -> clips its content)
                              .workThumbInner  = the image, plain cover (treated
                                                 like the project page's image
                                                 for a jump-free Flip morph). */}
                          {i === 0 && item.image?.asset && (
                            <span
                              className={styles.workThumb}
                              aria-hidden="true"
                              data-project-thumb={item.slug}
                            >
                              <span
                                className={styles.workThumbReveal}
                                data-intro-thumb
                              >
                                <SanityImage
                                  image={item.image}
                                  width={THUMB_PX}
                                  height={THUMB_PX}
                                  sizes="(max-width: 1024px) 20vw, 220px"
                                  className={styles.workThumbInner}
                                />
                              </span>
                            </span>
                          )}
                        </span>
                      ))}
                    </span>
                  </ProjectLink>
                </li>
              );
            })}
          </ol>

          {/* Each link: reveal mask (.riseMask overflow:clip) + .riseInner
              that rises. OUTER wrappers -> SwapLink / UnderlineLink and
              their internal overflow/position aren't touched. */}
          <address className={styles.siteContact}>
            <span className={styles.riseMask} data-intro-rise>
              <span className={styles.riseInner} data-intro-rise-line>
                <a
                  className={styles.siteContactLink}
                  href={linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <SwapLink>Linkedin</SwapLink>
                </a>
              </span>
            </span>
            {resumeUrl && (
              <span className={styles.riseMask} data-intro-rise>
                <span className={styles.riseInner} data-intro-rise-line>
                  <a
                    className={styles.siteContactLink}
                    href={resumeUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <SwapLink>Resume</SwapLink>
                  </a>
                </span>
              </span>
            )}
            <span className={styles.riseMask} data-intro-rise>
              <span className={styles.riseInner} data-intro-rise-line>
                <UnderlineLink
                  className={`${styles.siteContactLink} ${styles.siteContactEmail}`}
                  href={`mailto:${email}`}
                >
                  {email}
                </UnderlineLink>
              </span>
            </span>
          </address>
        </section>
      </HomeIntro>
    </main>
  );
}

import Link from "next/link";
import styles from "./ProjectDetail.module.css";
import type { PROJECTS_QUERY_RESULT } from "../sanity.types";
import SwapLink from "./SwapLink";
import UnderlineLink from "./UnderlineLink";
import SanityImage from "./SanityImage";
import { DETAIL_IMAGE } from "../lib/projectImage";

type Project = PROJECTS_QUERY_RESULT[number];

export function titleToText(lines: string[] | null, fallback: string | null): string {
  return (lines ?? (fallback ? [fallback] : [])).join(" ");
}

/** Shared by the /[slug] page and the intercepted modal. */
export default function ProjectDetail({
  project,
  prev,
  next,
}: {
  project: Project;
  prev: Project | null;
  next: Project | null;
}) {
  return (
    <main className={styles.page}>
      {/* scroll={false}: otherwise the modal scrolls back to the top
          (vercel/next.js#48445). */}
      <Link className={styles.return} href="/" scroll={false}>
        <span className={styles.revealRise} data-detail-rise>
          <SwapLink>Return</SwapLink>
        </span>
      </Link>

      {/* .mediaSlot holds the space while Flip positions .media absolutely. */}
      <div className={styles.mediaSlot}>
        {project.image?.asset ? (
          <div
            className={styles.media}
            data-flip-id={`project-${project.slug}`}
            style={
              project.image.asset.metadata?.lqip
                ? { backgroundImage: `url("${project.image.asset.metadata.lqip}")` }
                : undefined
            }
          >
            {/* The frame already shows the LQIP; next/image's blur would add
                a late flash during the morph. */}
            <SanityImage
              image={project.image}
              width={DETAIL_IMAGE.width}
              height={DETAIL_IMAGE.height}
              sizes={DETAIL_IMAGE.sizes}
              className={styles.mediaImg}
              preload
              blur={false}
            />
          </div>
        ) : (
          <div className={styles.media} aria-hidden="true" />
        )}
      </div>

      <div className={styles.info}>
        <div className={styles.overview}>
          <h1 className={styles.title} data-detail-lines>
            {titleToText(project.titleLines, project.title)}
          </h1>
          <p className={styles.overviewText} data-detail-lines>
            {project.overview}
          </p>
        </div>

        <div className={styles.meta}>
          <div className={styles.metaRow}>
            <span
              className={styles.metaRule}
              data-detail-draw
              aria-hidden="true"
            />
            <p className={styles.metaTerm} data-detail-lines>
              Year
            </p>
            <p className={styles.metaValue} data-detail-lines>
              {project.year}
            </p>
          </div>
          <div className={styles.metaRow}>
            <span
              className={styles.metaRule}
              data-detail-draw
              aria-hidden="true"
            />
            <p className={styles.metaTerm} data-detail-lines>
              {project.typeLabel ?? "Type"}
            </p>
            <p className={styles.metaValue} data-detail-lines>
              {project.client}
            </p>
          </div>
          <div className={styles.metaRow}>
            <span
              className={styles.metaRule}
              data-detail-draw
              aria-hidden="true"
            />
            <p className={styles.metaTerm} data-detail-lines>
              Tools
            </p>
            <div className={styles.metaValue}>
              {(project.tools ?? []).map((tool) => (
                <p key={tool} data-detail-lines>
                  {tool}
                </p>
              ))}
            </div>
          </div>
          {project.liveUrl && (
            <div className={styles.live}>
              <span className={styles.revealMask}>
                <span
                  className={styles.revealRise}
                  data-detail-rise
                  data-detail-cross
                >
                  <UnderlineLink
                    className={styles.liveLink}
                    href={project.liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    barFlash
                  >
                    Live Website
                  </UnderlineLink>
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* replace: the back button returns straight to the homepage. */}
      <nav className={styles.pager} aria-label="Other projects">
        {prev ? (
          <Link
            className={styles.pagerLink}
            href={`/${prev.slug}`}
            replace
            scroll={false}
          >
            <span className={styles.revealRise} data-detail-rise>
              <SwapLink direction="left">Prev</SwapLink>
            </span>
          </Link>
        ) : (
          <span className={styles.pagerLinkDisabled} aria-disabled="true">
            <span className={styles.revealRise} data-detail-rise>
              Prev
            </span>
          </span>
        )}
        {next ? (
          <Link
            className={styles.pagerLink}
            href={`/${next.slug}`}
            replace
            scroll={false}
          >
            <span className={styles.revealRise} data-detail-rise>
              <SwapLink direction="right">Next</SwapLink>
            </span>
          </Link>
        ) : (
          <span className={styles.pagerLinkDisabled} aria-disabled="true">
            <span className={styles.revealRise} data-detail-rise>
              Next
            </span>
          </span>
        )}
      </nav>
    </main>
  );
}

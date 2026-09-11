import Link from "next/link";
import styles from "./ProjectDetail.module.css";
import type { PROJECTS_QUERY_RESULT } from "../sanity.types";
import SwapLink from "./SwapLink";
import UnderlineLink from "./UnderlineLink";
import SanityImage from "./SanityImage";
import { DETAIL_IMAGE } from "../lib/projectImage";

type Project = PROJECTS_QUERY_RESULT[number];

/** Title (multi-line text) -> a single string, for <title> and the sr-only h1. */
export function titleToText(lines: string[] | null, fallback: string | null): string {
  return (lines ?? (fallback ? [fallback] : [])).join(" ");
}

/**
 * A project's view — shared by the real `/[slug]` page and the intercepted
 * modal. Only presents the data it receives; the fetch, the `notFound()`,
 * and the prev/next calculation stay in the route.
 */
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
      <h1 className={styles.srOnly}>{titleToText(project.titleLines, project.title)}</h1>

      {/* scroll={false}: otherwise the App Router does scrollIntoView on the
          new page and scrolls the modal's .backdrop container back up
          (Next issue #48445). */}
      <Link className={styles.return} href="/" scroll={false}>
        <span className={styles.revealRise} data-detail-rise>
          <SwapLink>Return</SwapLink>
        </span>
      </Link>

      {/* Plain cover image at every breakpoint: same treatment as the
          homepage thumbnail -> the Flip morph (Phase 5) re-crops without a
          jump, and it also works on tablet. No more scroll parallax here
          (it conflicted with the morph).
          .mediaSlot keeps the layout's place while Flip absolutizes .media
          -> the info block doesn't recenter. */}
      <div className={styles.mediaSlot}>
        {project.image?.asset ? (
          <div
            className={styles.media}
            data-flip-id={`project-${project.slug}`}
            // Base LQIP (data URI, zero network): the frame is never blank,
            // even if the optimized image isn't there yet (a cold morph).
            style={
              project.image.asset.metadata?.lqip
                ? { backgroundImage: `url("${project.image.asset.metadata.lqip}")` }
                : undefined
            }
          >
            <SanityImage
              image={project.image}
              width={DETAIL_IMAGE.width}
              height={DETAIL_IMAGE.height}
              sizes={DETAIL_IMAGE.sizes}
              className={styles.mediaImg}
              preload
            />
          </div>
        ) : (
          <div className={styles.media} aria-hidden="true" />
        )}
      </div>

      <div className={styles.info}>
        <div className={styles.overview}>
          <p className={styles.overviewLabel} data-detail-lines>
            Overview
          </p>
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
              Client
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
                {/* data-detail-cross: "Live Website" is content (its height
                    follows the meta block above), it crosses over during a
                    swap — unlike Return/Prev/Next, which are fixed furniture. */}
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

      {/* replace: browsing between projects doesn't push history — the
          browser's back button exits straight to the homepage. */}
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

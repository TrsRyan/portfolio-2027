import { notFound } from "next/navigation";
import { client } from "../../sanity/lib/client";
import { sanityFetch } from "../../sanity/lib/fetch";
import { PROJECTS_QUERY, PROJECT_SLUGS_QUERY } from "../../sanity/lib/queries";
import ProjectDetail, { titleToText } from "../../components/ProjectDetail";
import VisitMarker from "../../components/VisitMarker";
import { pickProject } from "../../lib/projects";

// Static params: slugs fetched fresh (bypassing the CDN) at build time.
export async function generateStaticParams() {
  const slugs = await client.withConfig({ useCdn: false }).fetch(PROJECT_SLUGS_QUERY);
  return slugs.filter((slug): slug is string => Boolean(slug)).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const projects = await sanityFetch({ query: PROJECTS_QUERY });
  const project = projects.find((p) => p.slug === slug);
  return { title: project ? titleToText(project.titleLines, project.title) : "Project" };
}

export default async function ProjectPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const projects = await sanityFetch({ query: PROJECTS_QUERY });
  const picked = pickProject(projects, slug);
  if (!picked) notFound();

  return (
    <>
      <VisitMarker />
      <ProjectDetail
        project={picked.project}
        prev={picked.prev}
        next={picked.next}
      />
    </>
  );
}

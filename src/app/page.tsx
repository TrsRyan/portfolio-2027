import {client} from "@/sanity/lib/client";

// GROQ : le langage de requête de Sanity (≈ SQL)
const PROJECTS_QUERY = `*[_type == "project"] | order(order asc){
  title,
  "slug": slug.current,
  year
}`;

type ProjectListItem = {
  title: string;
  slug: string;
  year: string;
};

export default async function Home() {
  const projects = await client.fetch<ProjectListItem[]>(PROJECTS_QUERY);

  return (
    <main style={{padding: "2rem", fontFamily: "system-ui, sans-serif"}}>
      <h1>Work ({projects.length})</h1>
      <ul>
        {projects.map((project) => (
          <li key={project.slug}>
            {project.year} — {project.title}
          </li>
        ))}
      </ul>
    </main>
  );
}
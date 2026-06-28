import { Link, useLoaderData } from "react-router";
import { formatEditionLabel } from "~/lib/editions";
import { listArchivedEditionSummaries } from "~/lib/editions.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/archive";

const legacyArchiveEntries = [
  {
    id: "legacy-i-lisbon-pd-open",
    season: 1,
    name: "I Lisbon PD Open",
    championName: "Felipe Ortiz",
    archivedLabel: "Archived on Challonge",
    links: [
      {
        label: "Bracket",
        href: "https://challonge.com/i_lisbon_pd_open",
      },
    ],
  },
  {
    id: "legacy-ii-league",
    season: 2,
    name: "II League",
    championName: "Felipe Ortiz",
    archivedLabel: "Archived on Challonge",
    links: [
      {
        label: "Bracket",
        href: "https://challonge.com/lwjtiang",
      },
    ],
  },
] as const;

export function meta() {
  return [
    { title: "Archive | PD Table Tennis" },
    {
      name: "description",
      content: "Browse previous PD Table Tennis sessions and champions",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const editions = await listArchivedEditionSummaries(supabase);
  return { editions };
}

export default function Archive() {
  const { editions } = useLoaderData<typeof loader>();
  const hasArchiveEntries =
    editions.length > 0 || legacyArchiveEntries.length > 0;

  return (
    <main className="page">
      <div className="page-header">
        <h1>Archive</h1>
        <p>
          Previous sessions, champions, and archived standings and brackets.
        </p>
      </div>

      {!hasArchiveEntries ? (
        <p className="empty">No archived sessions yet.</p>
      ) : (
        <div className="archive-grid">
          {editions.map((edition) => (
            <article key={edition.id} className="archive-card">
              <div className="archive-card-header">
                <div>
                  <h2>{formatEditionLabel(edition)}</h2>
                  <p>{edition.name}</p>
                </div>
                {edition.champion ? (
                  <span className="archive-champion-badge">Champion</span>
                ) : (
                  <span className="archive-pending-badge">Pending</span>
                )}
              </div>

              <div className="archive-card-body">
                {edition.champion ? (
                  <p className="archive-champion-name">
                    {edition.champion.name}
                  </p>
                ) : (
                  <p className="archive-champion-name">Champion not recorded</p>
                )}
                <p className="archive-card-meta">
                  Archived{" "}
                  {edition.archived_at
                    ? new Date(edition.archived_at).toLocaleDateString()
                    : "without a closeout date"}
                </p>
              </div>

              <div className="archive-card-links">
                <Link to={`/standings?edition=${edition.id}`}>Standings</Link>
                <Link to={`/bracket?edition=${edition.id}`}>Bracket</Link>
                <Link to={`/results?edition=${edition.id}`}>Results</Link>
                {edition.finalMatchId && (
                  <Link to={`/match/${edition.finalMatchId}`}>Final</Link>
                )}
              </div>
            </article>
          ))}
          {legacyArchiveEntries.map((edition) => (
            <article key={edition.id} className="archive-card">
              <div className="archive-card-header">
                <div>
                  <h2>{formatEditionLabel(edition)}</h2>
                  <p>{edition.name}</p>
                </div>
                <span className="archive-champion-badge">Champion</span>
              </div>

              <div className="archive-card-body">
                <p className="archive-champion-name">{edition.championName}</p>
                <p className="archive-card-meta">{edition.archivedLabel}</p>
              </div>

              <div className="archive-card-links">
                {edition.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

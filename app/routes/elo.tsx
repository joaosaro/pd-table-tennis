import { Link } from "react-router";

export function meta() {
  return [
    { title: "How Elo Works | PD Table Tennis" },
    {
      name: "description",
      content: "Rules for the PD Table Tennis Elo rating system.",
    },
  ];
}

export default function EloExplanation() {
  return (
    <main className="page">
      <div className="page-header">
        <h1>How The Elo System Works</h1>
        <p>
          Every rated match updates both players immediately. Ratings carry
          across seasons and never reset.
        </p>
      </div>

      <section className="standings-tiebreak">
        <h2>Core Formula</h2>
        <div className="elo-formula-card">
          <p>
            Expected score: <code>E_A = 1 / (1 + 10^((R_B - R_A) / 400))</code>
          </p>
          <p>
            Rating update: <code>R_A_new = R_A + K_A * (S_A - E_A)</code>
          </p>
          <p>
            A win is <code>1</code>, a draw is <code>0.5</code>, and a loss is{" "}
            <code>0</code>.
          </p>
        </div>
      </section>

      <section className="standings-tiebreak">
        <h2>Starting Ratings</h2>
        <ul>
          <li>All season 1 players start at 1000.</li>
          <li>Ratings carry forward between seasons.</li>
          <li>
            New players after season 1 start at{" "}
            <code>max(600, lowest active Elo - 100)</code>.
          </li>
          <li>The visible minimum rating is 600.</li>
        </ul>
      </section>

      <section className="standings-tiebreak">
        <h2>K-Factor</h2>
        <ul>
          <li>0 to 5 rated games: K = 80</li>
          <li>6 to 15 rated games: K = 64</li>
          <li>16 to 30 rated games: K = 48</li>
          <li>31+ rated games: K = 32</li>
        </ul>
      </section>

      <section className="standings-tiebreak">
        <h2>Processing Rules</h2>
        <ul>
          <li>Matches are processed in chronological order.</li>
          <li>Each match updates both players immediately.</li>
          <li>
            K-factor uses the player’s rated game count before that match.
          </li>
          <li>
            Internal ratings keep decimals, but all displayed Elo values are
            rounded.
          </li>
        </ul>
      </section>

      <section className="standings-tiebreak">
        <h2>What You Can See</h2>
        <ul>
          <li>The leaderboard shows each player’s current rounded Elo.</li>
          <li>Player profiles include a per-match Elo change log.</li>
          <li>Match pages show the Elo movement caused by that result.</li>
          <li>The dry run replays every match without writing to the database.</li>
        </ul>
        <p>
          <Link to="/leaderboard">Open the leaderboard</Link>{" "}
          <Link to="/elo/dry-run">Open the dry run</Link>
        </p>
      </section>
    </main>
  );
}

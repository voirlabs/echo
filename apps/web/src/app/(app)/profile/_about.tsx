import { SectionHeading } from "./_ui";

/** Name and "About you", kept up to date by the user's assistant. */
export function AboutSection({ name, profileText }: { name: string; profileText: string }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <SectionHeading title="About you" />
      {name || profileText ? (
        <dl className="about-list">
          <dt>Name</dt>
          <dd>{name || "Not saved yet"}</dd>
          <dt>About</dt>
          <dd className="about-text">{profileText || "Not saved yet"}</dd>
        </dl>
      ) : (
        <p className="profile-empty">
          Nothing yet. Tell your assistant who you are and what you do, and ask it to save that to your profile.
        </p>
      )}
    </div>
  );
}

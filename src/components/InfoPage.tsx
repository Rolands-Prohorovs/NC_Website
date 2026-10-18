import Shell, { useSite } from './Shell';
import type { City, CityLink, InfoPageId } from './types';

const TONES: Record<InfoPageId, string> = {
  students: 'green',
  living: 'blue',
  meet: 'orange',
};

type Props = { city: City; cities: CityLink[]; page: InfoPageId };

/** One component for Students, Living in Lahti and Meet people. */
export default function InfoPage({ city, cities, page }: Props) {
  return (
    <Shell city={city} cities={cities} current={page}>
      <InfoBody page={page} />
    </Shell>
  );
}

function InfoBody({ page }: { page: InfoPageId }) {
  const { t } = useSite();
  const copy = t[page];

  return (
    <>
      <section className="hero hero-compact">
        <div className="inner">
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
      </section>

      {copy.sections.length > 1 && (
        <nav className="chips" aria-label={t.ui.jumpTo}>
          <div className="inner chips-inner">
            {copy.sections.map((s) => (
              <a key={s.id} className="chip" href={`#${s.id}`}>
                {s.title}
              </a>
            ))}
          </div>
        </nav>
      )}

      <main className="inner page" data-tone={TONES[page]}>
        {copy.sections.map((s) => (
          <section key={s.id} id={s.id} className="info-section" aria-labelledby={`${s.id}-h`}>
            <h2 id={`${s.id}-h`}>{s.title}</h2>
            {s.intro && <p className="block-hint">{s.intro}</p>}

            <div className="topics">
              {s.topics.map((topic) =>
                topic.body ? (
                  <details key={topic.label} className="topic">
                    <summary>{topic.label}</summary>
                    <div className="topic-body">
                      <p>{topic.body}</p>
                      {topic.links && topic.links.length > 0 && (
                        <ul className="topic-links">
                          {topic.links.map((l) => (
                            <li key={l.url}>
                              <a href={l.url} target="_blank" rel="noreferrer">
                                {l.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </details>
                ) : (
                  <div key={topic.label} className="topic topic-empty">
                    <span>{topic.label}</span>
                    <span className="badge" title={t.ui.comingSoonHint}>
                      {t.ui.comingSoon}
                    </span>
                  </div>
                )
              )}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}

const FEATURES = [
  {
    number: '01',
    title: 'Search any artist',
    body: 'Type a DJ or producer name. We find their SoundCloud profile and pull their real activity.',
    highlight: 'Real activity, not algorithmic suggestions',
  },
  {
    number: '02',
    title: 'See what they like',
    body: 'Their public likes and reposts reveal genuine taste. Preview up to 30s without leaving the app.',
    highlight: 'Preview in-app',
  },
  {
    number: '03',
    title: 'Follow the rabbit hole',
    body: "Discover who they repost. One click opens that artist's crate. Go as deep as you want.",
    highlight: 'Infinite discovery',
  },
];

function FeatureCard({ feature, index }) {
  return (
    <article
      className="feature-card animate-fade-up"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="feature-card-border" />
      <span className="feature-card-number">{feature.number}</span>
      <h3 className="feature-card-title">{feature.title}</h3>
      <hr className="feature-card-line" />
      <p className="feature-card-text">{feature.body}</p>
      <p className="feature-card-highlight">{feature.highlight}</p>
    </article>
  );
}

export default function HowItWorks() {
  return (
    <section className="mx-auto mt-16 max-w-5xl" aria-label="Features">
      <div className="feature-card-grid">
        {FEATURES.map((feature, i) => (
          <FeatureCard key={feature.title} feature={feature} index={i} />
        ))}
      </div>
    </section>
  );
}

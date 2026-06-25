const STEPS = [
  {
    n: '01',
    title: 'Search',
    body: 'Type a DJ or producer. We pull their public SoundCloud likes and reposts.',
  },
  {
    n: '02',
    title: 'Preview',
    body: 'Listen up to 30s in-app. No tab-hopping on SoundCloud.',
  },
  {
    n: '03',
    title: 'Dig deeper',
    body: 'Follow artists they reposted. One click to open their crate.',
  },
];

export default function HowItWorks() {
  return (
    <section className="mx-auto mt-14 max-w-3xl" aria-label="How it works">
      <p className="label-mono mb-4 text-center text-[var(--color-muted)]/60">How it works</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <article
            key={step.n}
            className="panel animate-fade-up p-4 sm:p-5"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <p className="label-mono text-[var(--color-accent)]">{step.n}</p>
            <h3 className="section-title mt-2 text-base text-white">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

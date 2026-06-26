const LOADING_MESSAGES = [
  'Pulling dig crate…',
  'Scanning SoundCloud…',
  'Finding real taste…',
  'Digging deep…',
];

export default function LoadingState({ message }) {
  const displayMessage = message || LOADING_MESSAGES[0];

  return (
    <div className="flex flex-col items-center gap-5 py-16 animate-fade-up">
      <div className="relative">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-[var(--color-accent)] animate-pulse-dot"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <div
          className="absolute inset-0 bg-[var(--color-accent)] blur-xl opacity-20"
          aria-hidden
        />
      </div>
      <p className="label-mono text-[var(--color-muted)]">{displayMessage}</p>
    </div>
  );
}

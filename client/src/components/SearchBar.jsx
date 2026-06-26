export default function SearchBar({ value, onChange, onSubmit, loading, compact = false }) {
  return (
    <form onSubmit={onSubmit} className={`search-container ${compact ? 'search-container-compact' : ''}`}>
      <div className="search-wrapper">
        <div className="search-glow" />
        <div className="search-dark-border" />
        <div className="search-border" />
        <div className="search-white" />

        <div className="search-inner">
          <svg
            className="search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>

          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={compact ? 'Dig another artist...' : 'Search a DJ or producer...'}
            disabled={loading}
            autoFocus={!compact}
            className="search-input"
          />

          <div className="search-pink-mask" />

          <button
            type="submit"
            disabled={loading || !value.trim()}
            className="search-button"
          >
            {loading ? (
              <span className="animate-pulse-dot">*</span>
            ) : (
              'Dig'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

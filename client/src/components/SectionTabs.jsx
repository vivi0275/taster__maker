import { useEffect, useRef, useState } from 'react';

const SECTION_CONFIG = {
  likes: {
    id: 'likes',
    label: 'Likes',
    icon: '♥',
    color: 'accent',
    description: 'What they actually liked',
    tip: 'Real tracks they hit the heart on',
  },
  reposts: {
    id: 'reposts',
    label: 'Reposts',
    icon: '↻',
    color: 'accent',
    description: 'Their repost signal',
    tip: 'Tracks they shared with their followers',
  },
  livesets: {
    id: 'livesets',
    label: 'Live Sets',
    icon: '▶',
    color: 'youtube',
    description: 'YouTube mixes to dig',
    tip: 'DJ sets with tracklists you can dig',
  },
  discovery: {
    id: 'discovery',
    label: 'Rabbit Hole',
    icon: '→',
    color: 'discovery',
    description: 'Artists to explore next',
    tip: 'Click to dig their crate too',
  },
  spotify: {
    id: 'spotify',
    label: 'Spotify',
    icon: '♫',
    color: 'spotify',
    description: 'Public playlists',
    tip: 'Their public Spotify playlists',
  },
};

export default function SectionTabs({
  activeSection,
  onSectionChange,
  sections = [],
  counts = {},
}) {
  const tabsRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({});

  useEffect(() => {
    if (!tabsRef.current) return;
    const activeTab = tabsRef.current.querySelector(`[data-section="${activeSection}"]`);
    if (activeTab) {
      setIndicatorStyle({
        left: activeTab.offsetLeft,
        width: activeTab.offsetWidth,
      });
    }
  }, [activeSection]);

  if (sections.length === 0) return null;

  return (
    <nav
      ref={tabsRef}
      className="section-tabs-nav sticky top-20 z-15 mb-6"
      aria-label="Content sections"
    >
      <div className="section-tabs-container">
        <div className="section-tabs-track">
          {sections.map((sectionId) => {
            const config = SECTION_CONFIG[sectionId];
            if (!config) return null;
            const count = counts[sectionId] ?? 0;
            const isActive = activeSection === sectionId;
            const isEmpty = count === 0;

            return (
              <button
                key={sectionId}
                type="button"
                data-section={sectionId}
                onClick={() => onSectionChange(sectionId)}
                className={`section-tab tooltip ${isActive ? 'section-tab-active' : ''} ${isEmpty ? 'section-tab-empty' : ''}`}
                aria-selected={isActive}
                aria-label={`${config.label}: ${config.description}`}
                disabled={isEmpty}
              >
                <span className={`section-tab-icon section-tab-icon-${config.color}`}>
                  {config.icon}
                </span>
                <span className="section-tab-label">{config.label}</span>
                {count > 0 && (
                  <span className={`section-tab-count section-tab-count-${config.color}`}>
                    {count}
                  </span>
                )}
                {!isActive && !isEmpty && (
                  <span className="tooltip-content">{config.tip}</span>
                )}
              </button>
            );
          })}
        </div>
        <div
          className="section-tabs-indicator"
          style={{
            transform: `translateX(${indicatorStyle.left ?? 0}px)`,
            width: indicatorStyle.width ?? 0,
          }}
        />
      </div>
    </nav>
  );
}

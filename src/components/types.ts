export type PageId = 'home' | 'progress' | 'students' | 'living' | 'meet';
export type InfoPageId = 'students' | 'living' | 'meet';

export type Topic = {
  label: string;
  /** Leave out `body` to show a "coming soon" placeholder. */
  body?: string;
  links?: { label: string; url: string }[];
};

export type Section = {
  id: string;
  title: string;
  intro?: string;
  topics: Topic[];
};

export type InfoCopy = { title: string; subtitle: string; sections: Section[] };

export type Copy = {
  club: string;
  xp: string;
  ui: {
    nav: Record<PageId, string>;
    openMenu: string;
    closeMenu: string;
    language: string;
    city: string;
    streakDays: string;
    comingSoon: string;
    comingSoonHint: string;
    jumpTo: string;
  };
  home: {
    welcome: string;
    tagline: string;
    subtitle: string;
    checklistTitle: string;
    checklistHint: string;
    aboutTitle: string;
    about: string;
    whereTitle: string;
    whereHint: string;
    stages: { id: string; icon: string; title: string; desc: string }[];
    startTitle: string;
    starts: Record<
      string,
      { title: string; desc: string; cta: string; page: PageId; hash?: string }
    >;
    exploreTitle: string;
    pages: Record<
      Exclude<PageId, 'home'>,
      { title: string; desc: string; icon: string; tone: string }
    >;
  };
  progress: {
    title: string;
    subtitle: string;
    xpLabel: string;
    level: string;
    toNext: string;
    streakLabel: string;
    streakHint: string;
    tasksLabel: string;
    tasksDone: string;
    previewNote: string;
    groups: Record<string, { title: string; desc: string }>;
    tasks: Record<string, { label: string; hint: string }>;
  };
  students: InfoCopy;
  living: InfoCopy;
  meet: InfoCopy;
};

export type City = {
  id: string;
  name: string;
  languages: string[];
  stats: { xp: number; streak: number; checklistDays: number };
  tasks: { id: string; group: string; xp: number }[];
  content: Record<string, Copy>;
};

export type CityLink = { id: string; name: string };

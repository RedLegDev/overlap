export const SITE = {
  name: "Overlap",
  url: "https://overlap.redleg.dev",
  description:
    "Free group scheduling poll. Pick some days, share one link, and everyone drags across a grid to mark when they're free. Overlap ranks the times that work. No accounts, no ads, open source.",
  repo: "https://github.com/RedLegDev/overlap",
  publisher: { name: "Red Leg Dev", url: "https://redleg.dev" },
};

export const FAQ: { q: string; a: string }[] = [
  {
    q: "What is Overlap?",
    a: "Overlap is a free group scheduling poll. The organizer picks dates or days of the week and a range of hours, then shares one link. Each person drags across a grid to mark when they're free. Overlap shows a heatmap of the group and ranks the time windows the most people can make.",
  },
  {
    q: "Is Overlap free?",
    a: "Yes. Overlap is free to use with no plan tiers, no ads, and no cookies. Usage is counted with self-hosted, cookie-free Plausible analytics that never sees poll links. Red Leg Dev hosts it on Cloudflare Workers, where a poll costs a fraction of a cent to serve. The source code is MIT-licensed on GitHub, so anyone can run their own copy.",
  },
  {
    q: "Do people need an account to respond?",
    a: "No. Respondents type a name and start marking times. The browser remembers them so they can come back and edit. A personal edit link moves their response to another device. The organizer gets a separate organizer link for seeing results, locking in a time, or deleting the poll, and can have both links emailed when creating the poll. That address is used once and not stored.",
  },
  {
    q: "How does Overlap handle time zones?",
    a: "The organizer sets the poll's time zone. Every viewer sees the grid converted to their own time zone, including polls whose hours cross midnight for someone else. A switcher at the top of the poll shows the organizer's time or any other zone.",
  },
  {
    q: "What does \"If needed\" mean?",
    a: "Respondents have two brushes: Available and If needed. If needed marks times someone could make but would rather not. Best times count those people as half, and each result lists who is available, who is available if needed, and who can't make it.",
  },
  {
    q: "How do I pick the final time?",
    a: "The Best times panel ranks contiguous windows by how many people can attend, and a Must attend filter limits it to times that work for specific people. The organizer locks in a window, and everyone on the poll gets an Add to calendar button for an .ics file or Google Calendar.",
  },
  {
    q: "How long do polls last?",
    a: "A poll for specific dates is deleted 60 days after its last date. A days-of-the-week poll is deleted 180 days after it's created. The organizer can delete a poll at any time. Polls are reachable only by their link and are excluded from search engines.",
  },
];

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-24 text-center">
      <h1 className="font-serif text-5xl">Poll not found</h1>
      <p className="mt-4 text-ink-2">The link may be mistyped, or the poll expired or was deleted by its organizer.</p>
      <a href="/" className="mt-8 inline-flex rounded-full bg-ink text-paper px-5 py-2.5 font-semibold hover:bg-ink-2">
        Create a poll
      </a>
    </div>
  );
}

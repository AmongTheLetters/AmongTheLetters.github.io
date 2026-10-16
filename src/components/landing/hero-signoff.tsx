/* Closing line for the top of the homepage, after the Featured piece. */
export function HeroSignoff() {
  return (
    <div className="section-shell pb-10 md:pb-14">
      <div className="mx-auto max-w-2xl">
        <div className="rule-double" aria-hidden="true" />
        <p className="mt-4 flex flex-col items-center gap-1 text-center text-sm text-faint sm:flex-row sm:justify-between sm:gap-4">
          <span>There may be something waiting for you</span>
          <span className="font-medium tracking-kicker text-oxblood">Among The Letters</span>
        </p>
      </div>
    </div>
  );
}

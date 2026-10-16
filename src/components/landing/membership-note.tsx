/* Founding lifetime membership note, shown under the "At a glance" boxes. */
export function MembershipNote() {
  return (
    <section aria-label="Founding lifetime memberships" className="pt-4 pb-2 md:pt-6">
      <div className="section-shell text-center">
      <p className="text-on-open mx-auto mt-4 max-w-xl text-sm">
        <a
          href="mailto:amongtheletters@gmail.com?subject=Founding%20Lifetime%20Membership%20Inquiry"
          className="font-medium text-oxblood transition-colors hover:text-oxblood-dark hover:underline hover:underline-offset-4"
        >
          Founding lifetime memberships are available for $299 CAD.
          <br />
          Lifetime paid newsletter access, plus select future Among The Letters releases outside Substack.
          <br />
          Email amongtheletters@gmail.com for details.
        </a>
      </p>
      </div>
    </section>
  );
}

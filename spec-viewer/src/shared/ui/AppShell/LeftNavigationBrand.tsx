/** @returns The default Spec Reviewer brand block for the left navigation. */
export function LeftNavigationBrand() {
  return (
    <div className="left-navigation-brand">
      <span className="left-navigation-brand__mark" aria-hidden="true">
        S
      </span>
      <span className="left-navigation-brand__copy">
        <strong>Spec Reviewer</strong>
        <span>Spec workspace</span>
      </span>
    </div>
  );
}

import { type RefObject, useEffect } from "react";

type UseOutsideMouseDownOptions<TElement extends HTMLElement> = Readonly<{
  layerRef: RefObject<TElement | null>;
  isEnabled?: boolean;
  onOutsideMouseDown: () => void;
}>;

/** Registers a document mousedown listener that fires only outside the layer. */
export function useOutsideMouseDown<TElement extends HTMLElement>({
  layerRef,
  isEnabled = true,
  onOutsideMouseDown,
}: UseOutsideMouseDownOptions<TElement>): void {
  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const dismissWhenClickingOutside = (event: globalThis.MouseEvent): void => {
      const target = event.target;
      const layer = layerRef.current;

      if (!(target instanceof Node) || layer === null) {
        return;
      }

      if (layer.contains(target)) {
        return;
      }

      onOutsideMouseDown();
    };

    document.addEventListener("mousedown", dismissWhenClickingOutside);

    return () => {
      document.removeEventListener("mousedown", dismissWhenClickingOutside);
    };
  }, [isEnabled, layerRef, onOutsideMouseDown]);
}

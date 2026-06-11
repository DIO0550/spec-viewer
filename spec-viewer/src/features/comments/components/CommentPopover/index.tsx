import {
  type ComponentPropsWithoutRef,
  forwardRef,
  type ReactNode,
  type Ref,
  useRef,
} from "react";

import { useOutsideMouseDown } from "@/features/comments/hooks/useOutsideMouseDown";

type CommentPopoverProps = Omit<ComponentPropsWithoutRef<"aside">, "children"> &
  Readonly<{
    children: ReactNode;
    isDismissDisabled?: boolean;
    /** Called when the popover should be dismissed. */
    onClose: () => void;
  }>;

/** @returns An aside-based comment popover with outside mousedown dismissal. */
export const CommentPopover = forwardRef<HTMLElement, CommentPopoverProps>(
  /**
   * Renders the popover aside and dismisses it on outside mousedown.
   * @param props - Popover props including dismissal handling.
   * @param forwardedRef - Forwarded ref for the aside element.
   * @returns The popover aside element.
   */
  function CommentPopover(
    {
      children,
      isDismissDisabled = false,
      onClose,
      ...asideProps
    }: CommentPopoverProps,
    forwardedRef,
  ) {
    const popoverRef = useRef<HTMLElement>(null);

    useOutsideMouseDown({
      layerRef: popoverRef,
      isEnabled: !isDismissDisabled,
      onOutsideMouseDown: onClose,
    });

    /**
     * Stores the aside element locally and propagates it to the forwarded ref.
     * @param element - Popover aside element or null on unmount.
     */
    const setPopoverRef = (element: HTMLElement | null): void => {
      popoverRef.current = element;
      assignRef(forwardedRef, element);
    };

    return (
      <aside ref={setPopoverRef} {...asideProps}>
        {children}
      </aside>
    );
  },
);

/**
 * Assigns a value to a callback or object ref when one is provided.
 * @param ref - Forwarded ref to update.
 * @param value - Element value to assign.
 */
function assignRef<TElement>(
  ref: Ref<TElement> | undefined,
  value: TElement | null,
): void {
  if (typeof ref === "function") {
    ref(value);
    return;
  }

  if (ref === null || ref === undefined) {
    return;
  }

  ref.current = value;
}

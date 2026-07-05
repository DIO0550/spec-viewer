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
    /** Called when the popover requests to be closed. */
    onClose: () => void;
  }>;

/** @returns An aside-based comment popover with outside mousedown dismissal. */
export const CommentPopover = forwardRef<HTMLElement, CommentPopoverProps>(
  /**
   * Renders the popover aside element and wires outside-mousedown dismissal.
   * @param props - Popover props including children, dismissal flag, and onClose.
   * @param forwardedRef - Ref forwarded to the underlying aside element.
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
     * Stores the aside element locally and forwards it to the parent ref.
     * @param element - The aside element or null when unmounting.
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
 * Assigns a value to either a callback ref or a mutable ref object.
 * @param ref - The callback or object ref to assign, if any.
 * @param value - The element value to assign to the ref.
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

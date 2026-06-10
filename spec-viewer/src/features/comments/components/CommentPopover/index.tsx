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
    /** @returns Nothing; requests the popover to close. */
    onClose: () => void;
  }>;

/**
 * @param props - Aside attributes plus comment popover controls.
 * @param props.children - Content rendered inside the popover.
 * @param props.isDismissDisabled - When true, suppresses outside mousedown dismissal.
 * @param props.onClose - Called when an outside mousedown should dismiss the popover.
 * @param forwardedRef - Forwarded ref to the underlying aside element.
 * @returns An aside-based comment popover with outside mousedown dismissal.
 */
export const CommentPopover = forwardRef<HTMLElement, CommentPopoverProps>(
  /**
   * @param props - Aside attributes plus comment popover controls.
   * @param forwardedRef - Forwarded ref to the underlying aside element.
   * @returns An aside-based comment popover with outside mousedown dismissal.
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
     * @param element - The aside element, or null when unmounting.
     * @returns Nothing; stores the element on the local and forwarded refs.
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
 * @param ref - A callback ref, object ref, or nullish ref to assign to.
 * @param value - The element instance, or null when detaching.
 * @returns Nothing; writes the value through the supplied ref.
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

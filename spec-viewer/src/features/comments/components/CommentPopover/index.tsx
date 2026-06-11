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
    onClose: () => void;
  }>;

/** @returns An aside-based comment popover with outside mousedown dismissal. */
export const CommentPopover = forwardRef<HTMLElement, CommentPopoverProps>(
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

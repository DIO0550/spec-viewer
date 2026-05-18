import {
  type HTMLAttributes,
  type ReactNode,
  useRef,
} from "react";

import { useOutsideMouseDown } from "@/features/comments/hooks/useOutsideMouseDown";

type CommentPopoverProps = Omit<HTMLAttributes<HTMLElement>, "children"> &
  Readonly<{
    children: ReactNode;
    isDismissDisabled?: boolean;
    onClose: () => void;
  }>;

/** @returns An aside-based comment popover with outside mousedown dismissal. */
export function CommentPopover({
  children,
  isDismissDisabled = false,
  onClose,
  ...asideProps
}: CommentPopoverProps) {
  const popoverRef = useRef<HTMLElement>(null);

  useOutsideMouseDown({
    layerRef: popoverRef,
    isEnabled: !isDismissDisabled,
    onOutsideMouseDown: onClose,
  });

  return (
    <aside ref={popoverRef} {...asideProps}>
      {children}
    </aside>
  );
}

import type { ReactNode } from "react";

export type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  title?: string;
  description?: string;
  children?: ReactNode;
  containerClassName?: string;
  overlayClassName?: string;
  panelClassName?: string;
  contentClassName?: string;
  maxWidthClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  closeButtonLabel?: string;
};

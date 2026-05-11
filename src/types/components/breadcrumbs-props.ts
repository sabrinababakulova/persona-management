/** Optional intermediate breadcrumb item rendered between the root and the current page label. */
export interface BreadcrumbsParent {
  label: string;
  href: string;
}

export interface BreadcrumbsProps {
  /** Current page label (rendered as the rightmost, non-link entry). */
  label: string;
  /** Label for the root entry. Defaults to "Кандидаты". */
  rootLabel?: string;
  /** Href for the root entry. Defaults to "/candidates". */
  rootHref?: string;
  /** Optional intermediate link between root and the current page. */
  parent?: BreadcrumbsParent;
}

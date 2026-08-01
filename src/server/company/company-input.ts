import type { UpdateCompanyInput } from "~/schemas/company";

/**
 * Maps validated form input onto company columns.
 *
 * Optional fields arrive as trimmed strings and are stored as NULL when empty, so "not filled
 * in" reads the same whether the company was created at registration or edited later.
 */
export function toCompanyColumns(input: UpdateCompanyInput) {
  return {
    name: input.name,
    city: input.city || null,
    country: input.country || null,
    description: input.description || null,
    website: input.website || null,
    phone: input.phone || null,
  };
}

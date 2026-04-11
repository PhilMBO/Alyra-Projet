import type { Organization } from "@/lib/types";

interface OrganizationListProps {
  organizations: Organization[];
}

// Map statut → classes Tailwind pour le badge
const statusStyles: Record<Organization["status"], string> = {
  active:    "bg-success/10 text-success",
  suspended: "bg-warning/10 text-warning",
  archived:  "bg-error/10 text-error",
};

const statusLabels: Record<Organization["status"], string> = {
  active:    "Actif",
  suspended: "Suspendu",
  archived:  "Archive",
};

export function OrganizationList({ organizations }: OrganizationListProps) {
  if (organizations.length === 0) {
    return (
      <p className="text-center text-text-secondary p-4">
        Aucune organisation pour le moment.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {organizations.map((organization) => (
        <li
          key={organization.id}
          className="flex items-center justify-between rounded border border-border p-4 hover:bg-surface transition-colors"
        >
          <div className="flex items-center gap-3">
            {/* Logo ou placeholder */}
            {organization.logoUrl ? (
              <img
                src={organization.logoUrl}
                alt={organization.name}
                className="h-10 w-10 rounded object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded bg-surface text-sm font-bold text-primary">
                {organization.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div>
              <p className="font-semibold text-primary">{organization.name}</p>
              <p className="text-sm text-text-secondary">/{organization.slug}</p>
            </div>
          </div>

          {/* Badge de statut */}
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[organization.status]}`}>
            {statusLabels[organization.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}
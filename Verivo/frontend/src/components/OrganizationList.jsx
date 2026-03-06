import "./OrganizationList.css";

function OrganizationList({ organizations }) {
  if (organizations.length === 0) {
    return (
      <section className="org-list-section">
        <h2>Organisations</h2>
        <p className="org-list-empty">Aucune organisation enregistree.</p>
      </section>
    );
  }

  return (
    <section className="org-list-section">
      <h2>Organisations ({organizations.length})</h2>
      <ul className="org-list">
        {organizations.map((org) => (
          <li key={org.id} className="org-item">
            <div className="org-info">
              {org.logo && <img src={org.logo} alt={org.name} className="org-logo" />}
              <div>
                <h3>{org.name}</h3>
                <span className={`org-status status-${org.status.toLowerCase()}`}>
                  {org.status}
                </span>
              </div>
            </div>
            <time className="org-date">
              {new Date(org.createdAt).toLocaleDateString("fr-FR")}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default OrganizationList;

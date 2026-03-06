import { useState, useEffect } from "react";
import OrganizationForm from "./components/OrganizationForm.jsx";
import OrganizationList from "./components/OrganizationList.jsx";
import "./App.css";

function App() {
  const [organizations, setOrganizations] = useState([]);
  const [error, setError] = useState(null);

  const fetchOrganizations = async () => {
    try {
      const res = await fetch("/api/organizations");
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setOrganizations(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const handleCreated = (newOrg) => {
    setOrganizations((prev) => [newOrg, ...prev]);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Verivo</h1>
        <p>Gestion des organisations</p>
      </header>
      <main className="app-main">
        <OrganizationForm onCreated={handleCreated} />
        {error && <p className="error">{error}</p>}
        <OrganizationList organizations={organizations} />
      </main>
    </div>
  );
}

export default App;

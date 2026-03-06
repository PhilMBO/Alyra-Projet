import { useState } from "react";
import "./OrganizationForm.css";

function OrganizationForm({ onCreated }) {
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setSuccess(false);
    setLoading(true);

    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, logo: logo || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        const messages = data.errors
          ? data.errors.map((err) => err.msg)
          : [data.error];
        setErrors(messages);
        return;
      }

      setSuccess(true);
      setName("");
      setLogo("");
      onCreated(data);
    } catch {
      setErrors(["Impossible de contacter le serveur"]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="org-form-section">
      <h2>Nouvelle organisation</h2>
      <form onSubmit={handleSubmit} className="org-form">
        <div className="form-group">
          <label htmlFor="name">Nom *</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Mairie de Paris"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="logo">Logo (URL)</label>
          <input
            id="logo"
            type="url"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="https://exemple.com/logo.png"
          />
        </div>

        {errors.length > 0 && (
          <div className="form-errors">
            {errors.map((err, i) => (
              <p key={i}>{err}</p>
            ))}
          </div>
        )}

        {success && (
          <p className="form-success">Organisation creee avec succes !</p>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Creation..." : "Creer l'organisation"}
        </button>
      </form>
    </section>
  );
}

export default OrganizationForm;

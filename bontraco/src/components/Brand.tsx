import { Link } from "react-router-dom";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link className={`brand ${inverse ? "brand-inverse" : ""}`} to="/" aria-label="Bontraco home">
      <span className="brand-mark" aria-hidden="true">
        B
      </span>
      <span className="brand-name">Bontraco</span>
    </Link>
  );
}

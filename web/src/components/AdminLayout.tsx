import { NavLink } from 'react-router-dom';

type AdminLayoutProps = {
  children: React.ReactNode;
  onLogout: () => void;
};

export function AdminLayout({ children, onLogout }: AdminLayoutProps) {
  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <strong>Admin - Lista de Compras</strong>
          <nav className="nav-links">
            <NavLink
              to="/intake"
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              Intake
            </NavLink>
            <NavLink
              to="/queue"
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              Fila
            </NavLink>
            <button className="secondary" onClick={onLogout} type="button">
              Sair
            </button>
          </nav>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}

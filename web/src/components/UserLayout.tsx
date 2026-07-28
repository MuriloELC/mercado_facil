type UserLayoutProps = {
  children: React.ReactNode;
  onLogout: () => void;
};

export function UserLayout({ children, onLogout }: UserLayoutProps) {
  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <strong>Area do Usuario</strong>
          <button className="secondary" onClick={onLogout} type="button">
            Sair
          </button>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}

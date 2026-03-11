import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isLecteur = user?.role === 'lecteur';
  const isContributeur = user?.role === 'contributeur';
  const isAdmin = user?.role === 'admin';

  const navItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/processus', label: 'Processus' },
    { path: '/projets', label: 'Projets' },
      { path: '/clients-fournisseurs', label: 'Clients / Fournisseurs' },       // ← NOUVEAU
    { path: '/entites', label: 'Entités' },
    { path: '/documents', label: 'Documents' },
    ...(isAdmin ? [
      { path: '/users', label: 'Utilisateurs' },
      { path: '/journal', label: 'Journal' },
      { path: '/configuration', label: 'Configuration' },
      { path: '/corbeille', label: 'Corbeille' },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold">Gestion des processus</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`${
                      location.pathname === item.path ||
                      (item.path === '/projets' && location.pathname.startsWith('/projets'))
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center">
              <div className="relative group">
                <button className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold uppercase">
                    {user?.prenom?.[0]}{user?.nom?.[0]}
                  </div>
                </button>
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-800">{user?.prenom} {user?.nom}</p>
                    <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
                  </div>
                  <Link to="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">👤 Mon profil</Link>
                  <hr className="my-1" />
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">🚪 Déconnexion</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}

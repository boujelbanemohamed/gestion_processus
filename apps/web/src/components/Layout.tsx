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
    { path: '/entites', label: 'Entités' },
    { path: '/documents', label: 'Documents' },
    ...(isAdmin ? [
      { path: '/users', label: 'Utilisateurs' },
      { path: '/journal', label: 'Journal' },
      { path: '/configuration', label: 'Configuration' },
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
                      location.pathname === item.path
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
              <Link
                to="/profile"
                className="text-sm text-blue-600 hover:text-blue-800 mr-4 font-medium"
              >
                {user?.prenom} {user?.nom} ({user?.role})
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}

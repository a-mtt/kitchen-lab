import { createHashRouter, NavLink, Outlet, RouterProvider, useLocation } from 'react-router-dom';
import { ExperimentDetailPage } from './pages/ExperimentDetailPage';
import { ExperimentFormPage } from './pages/ExperimentFormPage';
import { ImportPage } from './pages/ImportPage';
import { IngredientsPage } from './pages/IngredientsPage';
import { RecipeDetailPage } from './pages/RecipeDetailPage';
import { RecipeFormPage } from './pages/RecipeFormPage';
import { RecipeListPage } from './pages/RecipeListPage';
import { FeedbackProvider } from './ui/feedback';

function Nav() {
  const { pathname } = useLocation();
  const cls = ({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'active' : ''}`;
  const onRecipes = pathname === '/' || pathname.startsWith('/recipes') || pathname === '/import';
  return (
    <nav className="nav">
      <div className="nav-inner">
        <span className="brand">
          <img className="brand-mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          Kitchen Lab
        </span>
        <div className="nav-links">
          <NavLink to="/" end className={() => cls({ isActive: onRecipes })}>
            <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden>
              <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z M5 17a3 3 0 0 1 3-3h11 M9 8h6" />
            </svg>
            Recipes
          </NavLink>
          <NavLink to="/ingredients" className={cls}>
            <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 21c4.4 0 8-3.1 8-7.5C20 9 16 4 12 3 8 4 4 9 4 13.5 4 17.9 7.6 21 12 21Z M12 21v-8 M12 13l3-3" />
            </svg>
            Ingredients
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

function Layout() {
  return (
    <FeedbackProvider>
      <Nav />
      <main className="main">
        <Outlet />
      </main>
    </FeedbackProvider>
  );
}

// Hash routing keeps deep links working on static hosting such as GitHub Pages.
// A "data router" is needed for the "Leave without saving?" guard.
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <RecipeListPage /> },
      { path: '/import', element: <ImportPage /> },
      { path: '/recipes/new', element: <RecipeFormPage key="new" /> },
      { path: '/recipes/:id', element: <RecipeDetailPage /> },
      { path: '/recipes/:id/edit', element: <RecipeFormPage key="edit" /> },
      { path: '/recipes/:id/experiments/new', element: <ExperimentFormPage key="new" /> },
      { path: '/recipes/:id/experiments/:expId', element: <ExperimentDetailPage /> },
      { path: '/recipes/:id/experiments/:expId/edit', element: <ExperimentFormPage key="edit" /> },
      { path: '/ingredients', element: <IngredientsPage /> },
      { path: '*', element: <RecipeListPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}

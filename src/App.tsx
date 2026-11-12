import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ExperimentDetailPage } from './pages/ExperimentDetailPage';
import { ExperimentFormPage } from './pages/ExperimentFormPage';
import { IngredientsPage } from './pages/IngredientsPage';
import { RecipeDetailPage } from './pages/RecipeDetailPage';
import { RecipeFormPage } from './pages/RecipeFormPage';
import { RecipeListPage } from './pages/RecipeListPage';
import { FeedbackProvider } from './ui/feedback';

function Nav() {
  const { pathname } = useLocation();
  const cls = ({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'active' : ''}`;
  const onRecipes = pathname === '/' || pathname.startsWith('/recipes');
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

export default function App() {
  return (
    // Hash routing keeps deep links working on static hosting such as GitHub Pages.
    <HashRouter>
      <FeedbackProvider>
        <Nav />
        <main className="main">
          <Routes>
            <Route path="/" element={<RecipeListPage />} />
            <Route path="/recipes/new" element={<RecipeFormPage />} />
            <Route path="/recipes/:id" element={<RecipeDetailPage />} />
            <Route path="/recipes/:id/edit" element={<RecipeFormPage />} />
            <Route path="/recipes/:id/experiments/new" element={<ExperimentFormPage />} />
            <Route path="/recipes/:id/experiments/:expId" element={<ExperimentDetailPage />} />
            <Route path="/recipes/:id/experiments/:expId/edit" element={<ExperimentFormPage />} />
            <Route path="/ingredients" element={<IngredientsPage />} />
            <Route path="*" element={<RecipeListPage />} />
          </Routes>
        </main>
      </FeedbackProvider>
    </HashRouter>
  );
}

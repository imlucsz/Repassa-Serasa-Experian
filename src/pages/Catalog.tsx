import { useEffect, useRef, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  LayoutGrid,
  Library,
  MapPin,
  Search,
} from 'lucide-react';
import {
  replace,
  Link,
  useLoaderData,
  useLocation,
  useNavigation,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router-dom';
import {
  categoryLabels,
  conditionLabels,
  isDemo,
  listInstitutions,
  listMaterials,
  type Category,
} from '../data/catalog';
import { MaterialCover } from '../components/MaterialCover';
import { Shelf3D } from '../components/Shelf3D';
import { Field } from '../ui/Field';
import { StatePanel } from '../ui/StatePanel';
import './collection.css';
export { RouteError as ErrorBoundary } from '../ui/RouteError';

export async function loader({ request }: LoaderFunctionArgs) {
  const params = new URL(request.url).searchParams;
  const category = params.get('category') ?? '';
  const page = Number(params.get('page') ?? 1);
  const query = {
    q: params.get('q')?.trim().slice(0, 120) || undefined,
    institutionId: params.get('institutionId') || undefined,
    category: Object.hasOwn(categoryLabels, category)
      ? (category as Category)
      : undefined,
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: 20,
  };
  const [materials, institutions] = await Promise.all([
    listMaterials(query, request.signal),
    listInstitutions(request.signal),
  ]);
  const lastPage = Math.max(1, Math.ceil(materials.total / materials.pageSize));
  if (query.page > lastPage) {
    params.set('page', String(lastPage));
    throw replace('/catalogo?' + params);
  }
  return { materials, institutions };
}
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (
    currentUrl.searchParams.get('vista') !== nextUrl.searchParams.get('vista')
  ) {
    const previous = new URLSearchParams(currentUrl.search);
    const next = new URLSearchParams(nextUrl.search);
    previous.delete('vista');
    next.delete('vista');
    if (previous.toString() === next.toString()) return false;
  }
  return defaultShouldRevalidate;
}
function defaultGrid() {
  return window.matchMedia(
    '(max-width: 700px), (prefers-reduced-motion: reduce)',
  ).matches;
}

export function Component() {
  const { materials, institutions } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const destination = useNavigation().location;
  const nextFilters = () => new URLSearchParams(
    destination?.pathname === location.pathname ? destination.search : params,
  );
  const view = params.get('vista');
  const grid = view === 'grade' || (view !== 'estante' && defaultGrid());
  function setGrid(enabled: boolean) {
    const next = nextFilters();
    next.set('vista', enabled ? 'grade' : 'estante');
    setParams(next, { replace: true, preventScrollReset: true });
  }
  function resetFilters() {
    setParams(view ? { vista: view } : {}, { preventScrollReset: true });
  }
  function setCategory(category: string) {
    const next = nextFilters();
    next.delete('page');
    if (category) next.set('category', category);
    else next.delete('category');
    setParams(next, { preventScrollReset: true });
  }
  useEffect(() => {
    document.title = 'Acervo de materiais · RePassa';
  }, []);
  const resultCount = useRef<HTMLParagraphElement>(null);
  const filterSubmitted = useRef(false);
  useEffect(() => {
    if (filterSubmitted.current) {
      resultCount.current?.focus({ preventScroll: true });
      filterSubmitted.current = false;
    }
  }, [materials]);
  const filtered = ['q', 'category', 'institutionId'].some((k) =>
    params.get(k),
  );
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    filterSubmitted.current = true;
    const next = nextFilters();
    next.delete('page');
    new FormData(event.currentTarget).forEach((value, key) => {
      const text = String(value).trim();
      if (text) next.set(key, text);
      else next.delete(key);
    });
    setParams(next, { preventScrollReset: true });
  }
  function goToPage(page: number) {
    const next = new URLSearchParams(params);
    if (page === 1) next.delete('page');
    else next.set('page', String(page));
    setParams(next);
  }
  return (
    <div className="frame catalog">
      <header className="page-intro">
        <p className="eyebrow">
          <BookOpen size={16} />{' '}
          {isDemo ? 'Acervo demonstrativo' : 'Acervo público'}
        </p>
        <h1>
          Acervo de <em>materiais</em>
        </h1>
        <p>
          Encontre livros e materiais de estudo disponíveis para retirada nas
          instituições.
        </p>
      </header>
      <nav className="category-index" aria-label="Categorias do acervo">
        {[['', 'Tudo'], ...Object.entries(categoryLabels)].map(
          ([value, label]) => (
            <button
              key={value || 'all'}
              type="button"
              aria-pressed={(params.get('category') ?? '') === value}
              onClick={() => setCategory(value)}
            >
              {label}
            </button>
          ),
        )}
      </nav>
      <form
        className="filters"
        onSubmit={filter}
        key={JSON.stringify([params.get('q'), params.get('institutionId')])}
        aria-label="Filtrar materiais"
      >
        <Field id="catalog-search" label="Buscar no acervo">
          <span className="input-icon">
            <Search size={17} />
            <input
              id="catalog-search"
              name="q"
              type="search"
              maxLength={120}
              defaultValue={params.get('q') ?? ''}
              placeholder="Título ou palavra-chave"
            />
          </span>
        </Field>
        <Field id="catalog-institution" label="Instituição">
          <select
            id="catalog-institution"
            name="institutionId"
            defaultValue={params.get('institutionId') ?? ''}
          >
            <option value="">Todas as instituições</option>
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </Field>
        <button className="button primary">
          Filtrar <ArrowRight size={16} />
        </button>
      </form>
      <div className="collection-bar">
        <p role="status" tabIndex={-1} ref={resultCount}>
          {materials.total} {materials.total === 1 ? 'material' : 'materiais'}
          {filtered && (
            <button className="clear" onClick={resetFilters}>
              Limpar filtros
            </button>
          )}
        </p>
        <div className="views" role="group" aria-label="Visualização do acervo">
          <button aria-pressed={!grid} onClick={() => setGrid(false)}>
            <Library size={16} />
            Estante
          </button>
          <button aria-pressed={grid} onClick={() => setGrid(true)}>
            <LayoutGrid size={15} />
            Grade
          </button>
        </div>
      </div>
      {materials.items.length === 0 ? (
        <StatePanel kind="empty" reset={filtered ? resetFilters : undefined} />
      ) : grid ? (
        <ul className="material-grid">
          {materials.items.map((material) => (
            <li key={material.id}>
              <Link
                to={'/materiais/' + material.id}
                state={{ catalogSearch: location.search }}
                viewTransition
              >
                <div className="cover-board">
                  <div className="grid-cover">
                    <MaterialCover material={material} />
                  </div>
                </div>
                <p className="meta">
                  {categoryLabels[material.category]} ·{' '}
                  {conditionLabels[material.condition]}
                </p>
                <h2>
                  {material.title}
                  <ArrowUpRight size={18} />
                </h2>
                <span className="location">
                  <MapPin size={14} />
                  {material.institution.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Shelf3D materials={materials.items} />
      )}
      {(materials.page > 1 ||
        materials.page * materials.pageSize < materials.total) && (
        <nav className="pager" aria-label="Paginação">
          <button
            disabled={materials.page <= 1}
            onClick={() => goToPage(materials.page - 1)}
          >
            <ArrowLeft size={16} />
            Anterior
          </button>
          <span>Página {materials.page}</span>
          <button
            disabled={materials.page * materials.pageSize >= materials.total}
            onClick={() => goToPage(materials.page + 1)}
          >
            Próxima
            <ArrowRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}

import { useEffect } from 'react';
import { ArrowLeft, MapPin } from 'lucide-react';
import {
  Link,
  useLoaderData,
  useLocation,
  type LoaderFunctionArgs,
} from 'react-router-dom';
import {
  categoryLabels,
  conditionLabels,
  getMaterial,
  isDemo,
} from '../data/catalog';
import { MaterialCover } from '../components/MaterialCover';
export { RouteError as ErrorBoundary } from '../ui/RouteError';

export function loader({ params, request }: LoaderFunctionArgs) {
  return getMaterial(params.id ?? '', request.signal);
}
export function Component() {
  const material = useLoaderData<typeof loader>();
  const { state } = useLocation();
  useEffect(() => {
    document.title = material.title + ' · RePassa';
  }, [material.title]);
  const search =
    typeof state?.catalogSearch === 'string' &&
    state.catalogSearch.startsWith('?')
      ? state.catalogSearch
      : '';
  return (
    <article className="frame detail">
      <Link
        className="back"
        state={{ activeMaterial: material.id }}
        viewTransition
        to={'/catalogo' + search}
      >
        <ArrowLeft size={17} /> Voltar ao acervo
      </Link>
      <div className="detail-layout">
        <div className="detail-board">
          <div className="detail-cover">
            <MaterialCover material={material} />
          </div>
        </div>
        <div className="detail-content">
          <p className="eyebrow">
            {isDemo ? 'Acervo demonstrativo' : 'Acervo público'} /{' '}
            {categoryLabels[material.category]}
          </p>
          <h1>{material.title}</h1>
          <p className="detail-description">{material.description}</p>
          <dl>
            <div>
              <dt>Condição</dt>
              <dd>{conditionLabels[material.condition]}</dd>
            </div>
            <div>
              <dt>Disponibilidade</dt>
              <dd>Disponível para reserva</dd>
            </div>
          </dl>
          <section className="pickup">
            <h2>
              <MapPin size={20} /> Ponto de retirada
            </h2>
            <h3>{material.institution.name}</h3>
            <p>{material.institution.publicAddress}</p>
            <p>{material.institution.pickupInstructions}</p>
          </section>
        </div>
      </div>
    </article>
  );
}

import { useRevalidator, useRouteError } from 'react-router-dom';
import { errorKind, StatePanel } from './StatePanel';

export function RouteError() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  return (
    <div className="frame">
      <StatePanel page
        kind={revalidator.state === 'loading' ? 'loading' : errorKind(error)}
        retry={() => {
          void revalidator.revalidate();
        }}
      />
    </div>
  );
}

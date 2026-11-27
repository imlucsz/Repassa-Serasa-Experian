import { useEffect, useState } from 'react';
import { authenticatedFetch, useAuthUser } from '../data/auth';
import type { Material } from '../data/catalog';
import { MaterialCover } from './MaterialCover';

type ImageMaterial = Pick<
  Material,
  'id' | 'title' | 'description' | 'category' | 'imageUrl'
>;

/**
 * Staff-only material photo. Pending uploads require an Authorization header,
 * so they cannot be loaded through a plain img src; fetch then use an object URL.
 * The generated cover remains the non-photo/loading/error fallback.
 */
export function ProtectedMaterialImage({
  material,
  className = '',
}: {
  material: ImageMaterial;
  className?: string;
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const user = useAuthUser();

  useEffect(() => {
    if (!user || !material.imageUrl) {
      setPhotoUrl(null);
      return;
    }
    const controller = new AbortController();
    let objectUrl: string | null = null;
    let active = true;
    setPhotoUrl(null);
    authenticatedFetch(material.imageUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('photo unavailable');
        return response.blob();
      })
      .then((blob) => {
        if (!active || !blob.type.startsWith('image/')) return;
        objectUrl = URL.createObjectURL(blob);
        setPhotoUrl(objectUrl);
      })
      .catch(() => {
        if (active) setPhotoUrl(null);
      });
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [material.imageUrl, user]);

  return (
    <div className={'protected-material-image ' + className}>
      {photoUrl ? (
        <img src={photoUrl} alt={'Foto de ' + material.title} />
      ) : (
        <MaterialCover material={material} showPhoto={false} />
      )}
    </div>
  );
}

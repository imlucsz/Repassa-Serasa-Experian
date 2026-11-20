import type { Institution } from '@prisma/client';

/** Contract `Institution` schema — public fields only. */
export interface InstitutionDto {
  id: string;
  name: string;
  publicAddress: string;
  pickupInstructions: string;
}

export function toInstitutionDto(
  institution: Pick<Institution, 'id' | 'name' | 'publicAddress' | 'pickupInstructions'>,
): InstitutionDto {
  return {
    id: institution.id,
    name: institution.name,
    publicAddress: institution.publicAddress,
    pickupInstructions: institution.pickupInstructions,
  };
}

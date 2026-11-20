import type { Institution, Material } from '@prisma/client';
import { toInstitutionDto, type InstitutionDto } from '../institutions/institution.mapper';

/** Contract `Material` — public catalog shape, no donor identity. */
export interface MaterialDto {
  id: string;
  title: string;
  description: string;
  category: Material['category'];
  condition: Material['condition'];
  imageUrl: string | null;
  institution: InstitutionDto;
  status: Material['status'];
  createdAt: string;
}

/** Contract `ManagedMaterial` — donor/staff view, still no donor PII. */
export interface ManagedMaterialDto extends MaterialDto {
  receivedAt: string | null;
  rejectReason: string | null;
  updatedAt: string;
}

type MaterialWithInstitution = Material & { institution: Institution };

/** Controlled object URL — the serve route enforces availability/ownership. */
function imageUrlOf(material: Material): string | null {
  return material.imageKey ? `/api/v1/uploads/${material.imageKey}` : null;
}

export function toMaterialDto(material: MaterialWithInstitution): MaterialDto {
  return {
    id: material.id,
    title: material.title,
    description: material.description,
    category: material.category,
    condition: material.condition,
    imageUrl: imageUrlOf(material),
    institution: toInstitutionDto(material.institution),
    status: material.status,
    createdAt: material.createdAt.toISOString(),
  };
}

export function toManagedMaterialDto(material: MaterialWithInstitution): ManagedMaterialDto {
  return {
    ...toMaterialDto(material),
    receivedAt: material.receivedAt?.toISOString() ?? null,
    rejectReason: material.rejectReason ?? null,
    updatedAt: material.updatedAt.toISOString(),
  };
}

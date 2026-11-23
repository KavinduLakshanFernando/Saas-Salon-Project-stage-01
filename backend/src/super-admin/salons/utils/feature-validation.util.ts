import { BadRequestException } from '@nestjs/common';
import { Feature, FeatureStatus } from '@prisma/client';

const LEGACY_FEATURE_MAP: Record<string, string> = {
  APPOINTMENTS: 'BASIC_APPOINTMENTS',
  BRANCH_MANAGEMENT: 'MULTI_BRANCH',
  ROLE_MANAGEMENT: 'STAFF_MANAGEMENT',
};

export function normalizeFeatureCodes(codes: string[]): string[] {
  return [
    ...new Set(
      codes.map((code) => {
        const upper = code.trim().toUpperCase();
        return LEGACY_FEATURE_MAP[upper] ?? upper;
      }),
    ),
  ];
}

export function validateFeatureRecords(requestedCodes: string[], features: Feature[]): Feature[] {
  if (features.length !== requestedCodes.length) {
    const foundCodes = new Set(features.map((feature) => feature.code));
    const invalidCodes = requestedCodes.filter((code) => !foundCodes.has(code));
    throw new BadRequestException(`Invalid feature code(s): ${invalidCodes.join(', ')}`);
  }

  const inactiveFeatures = features.filter((feature) => feature.status !== FeatureStatus.ACTIVE);

  if (inactiveFeatures.length > 0) {
    throw new BadRequestException(
      `Inactive feature code(s): ${inactiveFeatures.map((feature) => feature.code).join(', ')}`,
    );
  }

  return features;
}

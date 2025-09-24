/**
 * Test data factory functions for user verification E2E tests
 */

export interface KYCTestData {
  nik: string;
  name: string;
  birthCity: string;
  birthDate: string;
  province: string;
  city: string;
  district: string;
  subdistrict: string;
  address: string;
  postalCode: string;
}

export interface InstitutionTestData {
  businessName: string;
  registrationNumber: string;
  npwpNumber: string;
  businessType: string;
  businessDescription?: string;
  province: string;
  city: string;
  district: string;
  subdistrict: string;
  address: string;
  postalCode: string;
  directorName: string;
  directorPosition: string;
}

/**
 * Creates valid KYC test data
 */
export function createValidKYCData(overrides: Partial<KYCTestData> = {}): KYCTestData {
  return {
    nik: '3171012345678901',
    name: 'John Doe Prasetyo',
    birthCity: 'Jakarta',
    birthDate: '1990-05-15',
    province: 'DKI Jakarta',
    city: 'Jakarta Pusat',
    district: 'Menteng',
    subdistrict: 'Menteng',
    address: 'Jl. MH Thamrin No. 123, RT 001 RW 002',
    postalCode: '10350',
    ...overrides,
  };
}

/**
 * Creates valid Institution test data
 */
export function createValidInstitutionData(
  overrides: Partial<InstitutionTestData> = {},
): InstitutionTestData {
  return {
    businessName: 'PT Teknologi Nusantara Test',
    registrationNumber: '8120202123456',
    npwpNumber: '01.234.567.8-901.000',
    businessType: 'PT',
    businessDescription: 'Technology consulting and software development services',
    province: 'DKI Jakarta',
    city: 'Jakarta Selatan',
    district: 'Kebayoran Baru',
    subdistrict: 'Senayan',
    address: 'Jl. Asia Afrika No. 8, Komplex Gelora Bung Karno',
    postalCode: '10270',
    directorName: 'Budi Santoso',
    directorPosition: 'CEO',
    ...overrides,
  };
}

/**
 * Common valid Indonesian address data for testing
 */
export const indonesianAddresses = {
  jakarta: {
    province: 'DKI Jakarta',
    city: 'Jakarta Pusat',
    district: 'Menteng',
    subdistrict: 'Menteng',
    address: 'Jl. MH Thamrin No. 123, RT 001 RW 002',
    postalCode: '10350',
  },
  surabaya: {
    province: 'Jawa Timur',
    city: 'Surabaya',
    district: 'Gubeng',
    subdistrict: 'Gubeng',
    address: 'Jl. Pemuda No. 45, RT 003 RW 001',
    postalCode: '60281',
  },
  bandung: {
    province: 'Jawa Barat',
    city: 'Bandung',
    district: 'Coblong',
    subdistrict: 'Dago',
    address: 'Jl. Dago No. 78, RT 002 RW 003',
    postalCode: '40135',
  },
};

/**
 * Invalid test data patterns for validation testing
 */
export const invalidDataPatterns = {
  nik: {
    tooShort: '123',
    tooLong: '31710123456789012',
    containsLetters: '3171a12345678901',
    empty: '',
  },
  postalCode: {
    tooShort: '123',
    tooLong: '123456',
    containsLetters: '1a2b3',
    empty: '',
  },
  npwpNumber: {
    invalidFormat: '123456789',
    tooShort: '01.234.567',
    incorrectPattern: '01-234-567-8-901-000',
    empty: '',
  },
  birthDate: {
    future: '2030-01-01',
    invalidFormat: '15-05-1990',
    empty: '',
  },
  name: {
    tooLong: 'a'.repeat(200),
    empty: '',
  },
  businessName: {
    tooLong: 'a'.repeat(200),
    empty: '',
  },
};

/**
 * Creates form data for KYC submission
 */
export function createKYCFormData(data: Partial<KYCTestData> = {}, includeFiles = true): FormData {
  const formData = new FormData();
  const kycData = createValidKYCData(data);

  Object.entries(kycData).forEach(([key, value]) => {
    formData.append(key, value);
  });

  if (includeFiles) {
    // Create dummy image files
    const dummyImageData = 'dummy-image-data';
    const idCardFile = new Blob([dummyImageData], { type: 'image/jpeg' });
    const selfieFile = new Blob([dummyImageData], { type: 'image/jpeg' });

    formData.append('idCardPhoto', idCardFile, 'id-card.jpg');
    formData.append('selfieWithIdCardPhoto', selfieFile, 'selfie.jpg');
  }

  return formData;
}

/**
 * Creates form data for Institution submission
 */
export function createInstitutionFormData(
  data: Partial<InstitutionTestData> = {},
  includeFiles = true,
): FormData {
  const formData = new FormData();
  const institutionData = createValidInstitutionData(data);

  Object.entries(institutionData).forEach(([key, value]) => {
    if (value !== undefined) {
      formData.append(key, value);
    }
  });

  if (includeFiles) {
    // Create dummy document files
    const dummyPdfData = 'dummy-pdf-data';
    const npwpDoc = new Blob([dummyPdfData], { type: 'application/pdf' });
    const registrationDoc = new Blob([dummyPdfData], { type: 'application/pdf' });
    const deedDoc = new Blob([dummyPdfData], { type: 'application/pdf' });
    const directorIdCard = new Blob([dummyPdfData], { type: 'image/jpeg' });
    const ministryDoc = new Blob([dummyPdfData], { type: 'application/pdf' });

    formData.append('npwpDocument', npwpDoc, 'npwp.pdf');
    formData.append('registrationDocument', registrationDoc, 'registration.pdf');
    formData.append('deedOfEstablishment', deedDoc, 'deed.pdf');
    formData.append('directorIdCard', directorIdCard, 'director-id.jpg');
    formData.append('ministryApprovalDocument', ministryDoc, 'ministry.pdf');
  }

  return formData;
}

/**
 * Generates unique test identifiers
 */
export function generateTestId(): string {
  return Date.now().toString(36).toLowerCase() + Math.random().toString(36).substr(2, 9);
}

/**
 * Generates unique NIK for testing
 */
export function generateUniqueNIK(prefix = '3171'): string {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return prefix + timestamp + random;
}

/**
 * Generates unique NPWP number for testing
 */
export function generateUniqueNPWP(): string {
  const random1 = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, '0');
  const random2 = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  const random3 = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  const random4 = Math.floor(Math.random() * 10);
  const random5 = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  const random6 = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');

  return `${random1}.${random2}.${random3}.${random4}-${random5}.${random6}`;
}

/**
 * Generates unique business name for testing
 */
export function generateUniqueBusinessName(type = 'PT'): string {
  const testId = generateTestId();
  return `${type} Test Business ${testId}`;
}

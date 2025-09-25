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
  businessProvince: string;
  businessCity: string;
  businessDistrict: string;
  businessSubdistrict: string;
  businessAddress: string;
  businessPostalCode: string;
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
    businessProvince: 'DKI Jakarta',
    businessCity: 'Jakarta Selatan',
    businessDistrict: 'Kebayoran Baru',
    businessSubdistrict: 'Senayan',
    businessAddress: 'Jl. Asia Afrika No. 8, Komplex Gelora Bung Karno',
    businessPostalCode: '10270',
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
    // Create minimal valid JPEG files
    // Minimal JPEG file signature: FF D8 FF E0 00 10 4A 46 49 46 00 01 ... FF D9
    const minimalJpeg = new Uint8Array([
      0xff,
      0xd8, // SOI (Start of Image)
      0xff,
      0xe0, // APP0 marker
      0x00,
      0x10, // APP0 length (16 bytes)
      0x4a,
      0x46,
      0x49,
      0x46,
      0x00,
      0x01, // JFIF\0\1
      0x01,
      0x01, // Version 1.1
      0x00, // Density units: 0 = no units
      0x00,
      0x01, // X density = 1
      0x00,
      0x01, // Y density = 1
      0x00,
      0x00, // Thumbnail width/height = 0
      0xff,
      0xd9, // EOI (End of Image)
    ]);

    const idCardFile = new Blob([minimalJpeg], { type: 'image/jpeg' });
    const selfieFile = new Blob([minimalJpeg], { type: 'image/jpeg' });

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
    // Create minimal valid PDF files - PDF header signature: %PDF-1.4\n%âãÏÓ\n
    const minimalPdf = new Uint8Array([
      0x25,
      0x50,
      0x44,
      0x46,
      0x2d,
      0x31,
      0x2e,
      0x34,
      0x0a, // %PDF-1.4\n
      0x25,
      0xe2,
      0xe3,
      0xcf,
      0xd3,
      0x0a, // Binary marker
      0x31,
      0x20,
      0x30,
      0x20,
      0x6f,
      0x62,
      0x6a,
      0x0a, // 1 0 obj\n
      0x3c,
      0x3c,
      0x2f,
      0x54,
      0x79,
      0x70,
      0x65,
      0x2f,
      0x43,
      0x61,
      0x74,
      0x61,
      0x6c,
      0x6f,
      0x67,
      0x3e,
      0x3e,
      0x0a, // <</Type/Catalog>>\n
      0x65,
      0x6e,
      0x64,
      0x6f,
      0x62,
      0x6a,
      0x0a, // endobj\n
      0x78,
      0x72,
      0x65,
      0x66,
      0x0a, // xref\n
      0x30,
      0x20,
      0x31,
      0x0a, // 0 1\n
      0x30,
      0x30,
      0x30,
      0x30,
      0x30,
      0x30,
      0x30,
      0x30,
      0x30,
      0x30,
      0x20,
      0x36,
      0x35,
      0x35,
      0x33,
      0x35,
      0x20,
      0x66,
      0x0a, // 0000000000 65535 f\n
      0x74,
      0x72,
      0x61,
      0x69,
      0x6c,
      0x65,
      0x72,
      0x0a, // trailer\n
      0x3c,
      0x3c,
      0x2f,
      0x53,
      0x69,
      0x7a,
      0x65,
      0x20,
      0x31,
      0x3e,
      0x3e,
      0x0a, // <</Size 1>>\n
      0x25,
      0x25,
      0x45,
      0x4f,
      0x46, // %%EOF
    ]);

    // Create minimal valid JPEG for director ID card
    const minimalJpeg = new Uint8Array([
      0xff,
      0xd8, // SOI (Start of Image)
      0xff,
      0xe0, // APP0 marker
      0x00,
      0x10, // APP0 length (16 bytes)
      0x4a,
      0x46,
      0x49,
      0x46,
      0x00,
      0x01, // JFIF\0\1
      0x01,
      0x01, // Version 1.1
      0x00, // Density units: 0 = no units
      0x00,
      0x01, // X density = 1
      0x00,
      0x01, // Y density = 1
      0x00,
      0x00, // Thumbnail width/height = 0
      0xff,
      0xd9, // EOI (End of Image)
    ]);

    const npwpDoc = new Blob([minimalPdf], { type: 'application/pdf' });
    const registrationDoc = new Blob([minimalPdf], { type: 'application/pdf' });
    const deedDoc = new Blob([minimalPdf], { type: 'application/pdf' });
    const directorIdCard = new Blob([minimalJpeg], { type: 'image/jpeg' });
    const ministryDoc = new Blob([minimalPdf], { type: 'application/pdf' });

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

import { assertDefined, assertProp, assertPropString, check, isNumber, isString } from 'typeshaper';

import {
  TestCreatesInstitutionApplicationWithValidationParams,
  TestCreatesInstitutionApplicationWithValidationResult,
} from './user.types';
import { UserPlatformRepository } from './user-platform.repository';

export abstract class UserTestRepository extends UserPlatformRepository {
  async testCreatesInstitutionApplicationWithValidation(
    params: TestCreatesInstitutionApplicationWithValidationParams,
  ): Promise<TestCreatesInstitutionApplicationWithValidationResult> {
    const tx = await this.beginTransaction();
    try {
      const {
        applicantUserId,
        businessName,
        npwpNumber,
        npwpDocumentPath,
        registrationNumber,
        registrationDocumentPath,
        deedOfEstablishmentPath,
        // domicileCertificatePath, # TBD
        businessAddress,
        businessCity,
        businessProvince,
        businessDistrict,
        businessSubdistrict,
        businessPostalCode,
        directorName,
        directorIdCardPath,
        submittedDate,
      } = params;

      const rows = await tx.sql`
        INSERT INTO institution_applications (
          applicant_user_id, business_name, npwp_number, npwp_document_path,
          registration_number, registration_document_path, deed_of_establishment_path,
          business_address, business_city, business_province, business_district,
          business_subdistrict, business_postal_code, director_name, director_id_card_path, submitted_date
        ) VALUES (
          ${applicantUserId}, ${businessName}, ${npwpNumber}, ${npwpDocumentPath},
          ${registrationNumber}, ${registrationDocumentPath}, ${deedOfEstablishmentPath},
          ${businessAddress}, ${businessCity}, ${businessProvince}, ${businessDistrict},
          ${businessSubdistrict}, ${businessPostalCode}, ${directorName}, ${directorIdCardPath}, ${submittedDate}
        ) RETURNING id, applicant_user_id, business_name
      `;

      const application = rows[0];
      assertDefined(application, 'Institution application creation failed');
      assertProp(check(isString, isNumber), application, 'id');
      assertProp(check(isString, isNumber), application, 'applicant_user_id');
      assertPropString(application, 'business_name');

      await tx.commitTransaction();

      return {
        id: String(application.id),
        applicantUserId: String(application.applicant_user_id),
        businessName: application.business_name,
      };
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }
}

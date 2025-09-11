import { Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { CreateInstitutionInviteDto } from './dto/create-institution-invite.dto';

@Injectable()
export class InstitutionsService {
  constructor(private readonly userRepo: CryptogadaiRepository) {}

  apply(userId: string, createInstitutionDto: CreateInstitutionDto) {
    const payload = {
      ...createInstitutionDto,
      applicantUserId: userId,
      applicationDate: new Date(),
    };
    return this.userRepo.userAppliesForInstitution(payload);
  }

  invite(userId: string, createInstitutionInviteDto: CreateInstitutionInviteDto) {
    const payload = {
      ...createInstitutionInviteDto,
      inviterUserId: userId,
      invitationDate: new Date(),
    };
    return this.userRepo.ownerUserInvitesUserToInstitution(payload);
  }

  acceptInvite(userId: string, inviteId: string) {
    const payload = {
      invitationId: inviteId,
      userId: userId,
      acceptanceDate: new Date(),
    };
    return this.userRepo.userAcceptsInstitutionInvitation(payload);
  }

  rejectInvite(userId: string, inviteId: string, reason?: string) {
    const payload = {
      invitationId: inviteId,
      userId: userId,
      rejectionReason: reason,
      rejectionDate: new Date(),
    };
    return this.userRepo.userRejectsInstitutionInvitation(payload);
  }
}

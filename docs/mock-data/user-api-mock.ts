/**
 * Comprehensive API Mock Data for User Management System
 * Based on SRS-CG-v2.3-EN requirements, OpenAPI specifications, and PostgreSQL schemas
 */

// =============================================================================
// BASE MOCK USERS
// =============================================================================

export const mockUsers = {
  // Individual user - KYC pending
  individualPending: {
    id: "usr_clx7k2m3n0001w8g4h9s1c7y3",
    name: "Budi Santoso",
    email: "budi.santoso@gmail.com",
    emailVerified: true,
    image: "https://assets.cryptogadai.com/profiles/budi-santoso.jpg",
    role: "User",
    twoFactorEnabled: false,
    createdAt: "2024-03-01T08:30:00.000Z",
    updatedAt: "2024-03-01T09:15:00.000Z",
    institutionId: null,
    institutionRole: null,
    kycId: 1,
    kycStatus: "pending"
  },

  // Individual user - KYC verified
  individualVerified: {
    id: "usr_clx7k2m3n0002w8g4h9s1c7y4",
    name: "Siti Nurhaliza",
    email: "siti.nurhaliza@gmail.com",
    emailVerified: true,
    image: "https://assets.cryptogadai.com/profiles/siti-nurhaliza.jpg",
    role: "User",
    twoFactorEnabled: true,
    createdAt: "2024-02-15T10:20:00.000Z",
    updatedAt: "2024-03-01T14:30:00.000Z",
    institutionId: null,
    institutionRole: null,
    kycId: 2,
    kycStatus: "verified"
  },

  // Institution owner
  institutionOwner: {
    id: "usr_clx7k2m3n0003w8g4h9s1c7y5",
    name: "Ahmad Rizki",
    email: "ahmad.rizki@ptfintech.co.id",
    emailVerified: true,
    image: "https://assets.cryptogadai.com/profiles/ahmad-rizki.jpg",
    role: "User",
    twoFactorEnabled: true,
    createdAt: "2024-01-20T11:45:00.000Z",
    updatedAt: "2024-03-01T16:20:00.000Z",
    institutionId: 1,
    institutionRole: "Owner",
    kycId: null,
    kycStatus: "verified"
  },

  // Institution member
  institutionMember: {
    id: "usr_clx7k2m3n0004w8g4h9s1c7y6",
    name: "Maya Sari",
    email: "maya.sari@ptfintech.co.id",
    emailVerified: true,
    image: "https://assets.cryptogadai.com/profiles/maya-sari.jpg",
    role: "User",
    twoFactorEnabled: false,
    createdAt: "2024-02-01T09:30:00.000Z",
    updatedAt: "2024-03-01T13:45:00.000Z",
    institutionId: 1,
    institutionRole: "Finance",
    kycId: 4,
    kycStatus: "verified"
  },

  // New user - no type selected
  newUser: {
    id: "usr_clx7k2m3n0005w8g4h9s1c7y7",
    name: "Indra Pratama",
    email: "indra.pratama@outlook.com",
    emailVerified: true,
    image: null,
    role: "User",
    twoFactorEnabled: false,
    createdAt: "2024-03-10T15:20:00.000Z",
    updatedAt: "2024-03-10T15:20:00.000Z",
    institutionId: null,
    institutionRole: null,
    kycId: null,
    kycStatus: "none"
  },

  // Admin user
  adminUser: {
    id: "usr_clx7k2m3n0006w8g4h9s1c7y8",
    name: "Admin CryptoGadai",
    email: "admin@cryptogadai.com",
    emailVerified: true,
    image: "https://assets.cryptogadai.com/profiles/admin.jpg",
    role: "Admin",
    twoFactorEnabled: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-03-01T18:00:00.000Z",
    institutionId: null,
    institutionRole: null,
    kycId: null,
    kycStatus: "none"
  }
} as const;

// =============================================================================
// BETTER AUTH API MOCKS
// =============================================================================

export const betterAuthMocks = {
  // Sign up with email
  signUpEmail: {
    request: {
      name: "John Doe",
      email: "john.doe@example.com",
      password: "SecurePass123!",
      image: null,
      callbackURL: "https://app.cryptogadai.com/dashboard",
      rememberMe: true
    },
    response: {
      user: {
        id: "usr_clx7k2m3n0007w8g4h9s1c7y9",
        name: "John Doe",
        email: "john.doe@example.com",
        emailVerified: false,
        image: null,
        role: "User",
        twoFactorEnabled: false,
        createdAt: "2024-03-15T10:30:00.000Z",
        updatedAt: "2024-03-15T10:30:00.000Z"
      },
      token: "sess_clx7k2m3n0000w8g4h9s1c7y2.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    }
  },

  // Sign in with email
  signInEmail: {
    request: {
      email: "siti.nurhaliza@gmail.com",
      password: "MySecretPass456!",
      callbackURL: "https://app.cryptogadai.com/dashboard",
      rememberMe: true
    },
    response: {
      redirect: false,
      token: "sess_clx7k2m3n0002w8g4h9s1c7y4.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      user: mockUsers.individualVerified,
      url: null
    }
  },

  // Sign in with 2FA required
  signInEmail2FA: {
    request: {
      email: "ahmad.rizki@ptfintech.co.id",
      password: "InstitutionPass789!",
      callbackURL: "https://app.cryptogadai.com/dashboard"
    },
    response: {
      redirect: true,
      url: "https://app.cryptogadai.com/auth/2fa-verify",
      requiresTwoFactor: true,
      user: {
        id: mockUsers.institutionOwner.id,
        email: mockUsers.institutionOwner.email,
        twoFactorEnabled: true
      }
    }
  },

  // Google OAuth sign in
  socialSignIn: {
    request: {
      provider: "google",
      idToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2NzAyN...",
      callbackURL: "https://app.cryptogadai.com/dashboard",
      disableRedirect: "true"
    },
    response: {
      redirect: false,
      token: "sess_clx7k2m3n0008w8g4h9s1c7ya.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      user: {
        id: "usr_clx7k2m3n0008w8g4h9s1c7ya",
        name: "Google User",
        email: "googleuser@gmail.com",
        emailVerified: true,
        image: "https://lh3.googleusercontent.com/a/default-user",
        role: "User",
        twoFactorEnabled: false,
        createdAt: "2024-03-15T11:00:00.000Z",
        updatedAt: "2024-03-15T11:00:00.000Z"
      },
      url: null
    }
  },

  // Get session
  getSession: {
    response: {
      session: {
        id: "sess_clx7k2m3n0002w8g4h9s1c7y4",
        expiresAt: "2024-04-15T14:30:00.000Z",
        token: "sess_clx7k2m3n0002w8g4h9s1c7y4.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        createdAt: "2024-03-01T14:30:00.000Z",
        updatedAt: "2024-03-15T14:30:00.000Z",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        userId: mockUsers.individualVerified.id
      },
      user: mockUsers.individualVerified
    }
  },

  // Two-factor setup
  twoFactorEnable: {
    request: {
      password: "MySecretPass456!",
      issuer: "CryptoGadai"
    },
    response: {
      totpURI: "otpauth://totp/CryptoGadai:siti.nurhaliza@gmail.com?secret=JBSWY3DPEHPK3PXP&issuer=CryptoGadai",
      backupCodes: [
        "abc123def456",
        "ghi789jkl012",
        "mno345pqr678",
        "stu901vwx234",
        "yz5a6b7c8d9e"
      ]
    }
  },

  // Password reset request
  forgotPassword: {
    request: {
      email: "budi.santoso@gmail.com",
      redirectTo: "https://app.cryptogadai.com/auth/reset-password"
    },
    response: {
      status: true,
      message: "Password reset email sent successfully"
    }
  }
} as const;

// =============================================================================
// USER PROFILE API MOCKS
// =============================================================================

export const userProfileMocks = {
  // Get user profile
  getUserProfile: {
    response: {
      user: mockUsers.individualVerified
    }
  },

  // User type selection
  selectUserType: {
    request: {
      userType: "Individual"
    },
    response: {
      userType: "Individual",
      message: "User type selected successfully"
    }
  },

  selectInstitutionType: {
    request: {
      userType: "Institution"
    },
    response: {
      userType: "Institution",
      message: "User type selected successfully"
    }
  },

  // Update profile
  updateProfile: {
    request: {
      name: "Siti Nurhaliza Binti Ahmad",
      profilePicture: "base64encodedimagedata..."
    },
    response: {
      user: {
        name: "Siti Nurhaliza Binti Ahmad",
        profilePictureUrl: "https://assets.cryptogadai.com/profiles/siti-nurhaliza-updated.jpg"
      },
      message: "Profile updated successfully"
    }
  },

  // Profile validation errors
  updateProfileError: {
    request: {
      name: "", // Empty name
      profilePicture: "invalidimagedata"
    },
    response: {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: {
          name: "Name cannot be empty",
          profilePicture: "Invalid image format"
        }
      },
      timestamp: "2024-03-15T12:00:00.000Z",
      requestId: "req_12345"
    }
  }
} as const;

// =============================================================================
// KYC VERIFICATION API MOCKS
// =============================================================================

export const kycMocks = {
  // KYC submission
  submitKyc: {
    request: {
      nik: "3201234567890123",
      name: "Budi Santoso",
      birthCity: "Jakarta",
      birthDate: "1985-06-15",
      province: "DKI Jakarta",
      city: "Jakarta Pusat",
      district: "Menteng",
      subdistrict: "Menteng",
      address: "Jl. MH Thamrin No. 123, RT 001/RW 005",
      postalCode: "10310",
      phoneNumber: "+628123456789",
      idCardPhoto: "base64encodedidcardimage...",
      selfieWithIdCardPhoto: "base64encodedselfieimage..."
    },
    response: {
      kycSubmission: {
        id: 1,
        status: "pending",
        submittedDate: "2024-03-01T08:45:00.000Z",
        verifiedDate: null,
        rejectedDate: null,
        rejectionReason: null
      },
      message: "KYC submitted successfully and is under review"
    }
  },

  // KYC status check - pending
  getKycStatusPending: {
    response: {
      kycStatus: "pending",
      submission: {
        id: 1,
        status: "pending",
        submittedDate: "2024-03-01T08:45:00.000Z",
        verifiedDate: null,
        rejectedDate: null,
        rejectionReason: null
      },
      canResubmit: false
    }
  },

  // KYC status check - verified
  getKycStatusVerified: {
    response: {
      kycStatus: "verified",
      submission: {
        id: 2,
        status: "verified",
        submittedDate: "2024-02-15T10:30:00.000Z",
        verifiedDate: "2024-02-16T14:15:00.000Z",
        rejectedDate: null,
        rejectionReason: null
      },
      canResubmit: false
    }
  },

  // KYC status check - rejected
  getKycStatusRejected: {
    response: {
      kycStatus: "rejected",
      submission: {
        id: 3,
        status: "rejected",
        submittedDate: "2024-02-20T09:20:00.000Z",
        verifiedDate: null,
        rejectedDate: "2024-02-21T15:30:00.000Z",
        rejectionReason: "ID card image is not clear. Please submit a clearer photo."
      },
      canResubmit: true
    }
  },

  // KYC submission validation errors
  submitKycError: {
    request: {
      nik: "invalid_nik",
      name: "",
      birthDate: "invalid_date"
    },
    response: {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: {
          nik: "NIK must be exactly 16 digits",
          name: "Name is required",
          birthDate: "Invalid date format"
        }
      },
      timestamp: "2024-03-15T12:30:00.000Z",
      requestId: "req_kyc_12345"
    }
  },

  // Duplicate NIK error
  duplicateNikError: {
    response: {
      success: false,
      error: {
        code: "DUPLICATE_NIK",
        message: "NIK already registered"
      },
      timestamp: "2024-03-15T12:45:00.000Z",
      requestId: "req_kyc_67890"
    }
  }
} as const;

// =============================================================================
// INSTITUTION MANAGEMENT API MOCKS
// =============================================================================

export const institutionMocks = {
  // Institution application
  submitApplication: {
    request: {
      businessName: "PT Fintech Indonesia",
      registrationNumber: "8120200123456789",
      npwpNumber: "01.234.567.8-901.234",
      businessType: "Perseroan Terbatas",
      businessDescription: "Perusahaan teknologi finansial yang bergerak di bidang peer-to-peer lending",
      province: "DKI Jakarta",
      city: "Jakarta Selatan",
      district: "Kebayoran Baru",
      subdistrict: "Senayan",
      address: "Jl. Jenderal Sudirman Kav. 52-53, Senayan",
      postalCode: "12190",
      directorName: "Ahmad Rizki Pratama",
      directorPosition: "Direktur Utama",
      npwpDocument: "base64encodednpwpdocument...",
      registrationDocument: "base64encodedregistrationdoc...",
      deedOfEstablishment: "base64encodeddeedofestablishment...",
      directorIdCard: "base64encodeddirectorid...",
      ministryApprovalDocument: "base64encodedministryapproval...",
      businessLicense: "base64encodedbusinesslicense..."
    },
    response: {
      application: {
        id: 1,
        businessName: "PT Fintech Indonesia",
        submittedDate: "2024-01-20T11:45:00.000Z",
        status: "Submitted"
      },
      message: "Institution application submitted successfully"
    }
  },

  // Institution invitation
  createInvitation: {
    request: {
      userEmail: "maya.sari@gmail.com",
      role: "Finance",
      message: "Join our institution as Finance team member"
    },
    response: {
      invitation: {
        id: 1,
        userEmail: "maya.sari@gmail.com",
        role: "Finance",
        invitedDate: "2024-02-01T09:00:00.000Z"
      }
    }
  },

  // Accept invitation
  acceptInvitation: {
    response: {
      institution: {
        id: 1,
        businessName: "PT Fintech Indonesia",
        role: "Finance"
      },
      message: "Invitation accepted successfully"
    }
  },

  // Reject invitation
  rejectInvitation: {
    request: {
      reason: "Currently not available to join"
    },
    response: {
      message: "Invitation rejected successfully"
    }
  },

  // Application errors
  businessNameExistsError: {
    response: {
      success: false,
      error: {
        code: "BUSINESS_NAME_EXISTS",
        message: "Business name already registered"
      },
      timestamp: "2024-03-15T13:00:00.000Z",
      requestId: "req_inst_12345"
    }
  },

  invalidNpwpError: {
    response: {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: {
          npwpNumber: "Invalid NPWP format. Expected: XX.XXX.XXX.X-XXX.XXX"
        }
      },
      timestamp: "2024-03-15T13:15:00.000Z",
      requestId: "req_inst_67890"
    }
  },

  userNotFoundError: {
    response: {
      success: false,
      error: {
        code: "USER_NOT_FOUND",
        message: "User with email not found"
      },
      timestamp: "2024-03-15T13:30:00.000Z",
      requestId: "req_inv_12345"
    }
  },

  userAlreadyMemberError: {
    response: {
      success: false,
      error: {
        code: "USER_ALREADY_MEMBER",
        message: "User is already institution member"
      },
      timestamp: "2024-03-15T13:45:00.000Z",
      requestId: "req_inv_67890"
    }
  }
} as const;

// =============================================================================
// NOTIFICATION API MOCKS
// =============================================================================

export const notificationMocks = {
  // List notifications with pagination
  listNotifications: {
    response: {
      notifications: [
        {
          id: 1,
          type: "UserKycVerified",
          title: "KYC Verification Approved",
          content: "Your identity verification has been approved. You can now access all platform features.",
          isRead: false,
          readDate: null,
          createdAt: "2024-02-16T14:15:00.000Z"
        },
        {
          id: 2,
          type: "InstitutionMemberInvited",
          title: "Institution Invitation Received",
          content: "You have been invited to join PT Fintech Indonesia as Finance team member.",
          isRead: true,
          readDate: "2024-02-01T10:30:00.000Z",
          createdAt: "2024-02-01T09:00:00.000Z"
        },
        {
          id: 3,
          type: "LoanRepaymentDue",
          title: "Loan Repayment Due Tomorrow",
          content: "Your loan payment of $500 is due tomorrow. Please ensure sufficient balance.",
          isRead: false,
          readDate: null,
          createdAt: "2024-03-14T10:00:00.000Z"
        },
        {
          id: 4,
          type: "TwoFactorEnabled",
          title: "Two-Factor Authentication Enabled",
          content: "Two-factor authentication has been successfully enabled for your account.",
          isRead: true,
          readDate: "2024-03-01T15:00:00.000Z",
          createdAt: "2024-03-01T14:30:00.000Z"
        }
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 25,
        totalPages: 2,
        hasNext: true,
        hasPrev: false
      },
      unreadCount: 2
    }
  },

  // Filtered notifications - unread only
  listUnreadNotifications: {
    response: {
      notifications: [
        {
          id: 1,
          type: "UserKycVerified",
          title: "KYC Verification Approved",
          content: "Your identity verification has been approved. You can now access all platform features.",
          isRead: false,
          readDate: null,
          createdAt: "2024-02-16T14:15:00.000Z"
        },
        {
          id: 3,
          type: "LoanRepaymentDue",
          title: "Loan Repayment Due Tomorrow",
          content: "Your loan payment of $500 is due tomorrow. Please ensure sufficient balance.",
          isRead: false,
          readDate: null,
          createdAt: "2024-03-14T10:00:00.000Z"
        }
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      },
      unreadCount: 2
    }
  },

  // Mark notification as read
  markAsRead: {
    response: {
      message: "Notification marked as read"
    }
  },

  // Mark all notifications as read
  markAllAsRead: {
    response: {
      message: "All notifications marked as read",
      updatedCount: 2
    }
  },

  // Notification types by category
  notificationTypes: {
    authentication: [
      "UserRegistered", "EmailVerificationSent", "EmailVerified", "PasswordResetRequested",
      "PasswordResetCompleted", "TwoFactorEnabled", "TwoFactorDisabled", "LoginFromNewDevice", "SuspiciousLoginAttempt"
    ],
    kyc: [
      "UserKycVerified", "UserKycRejected"
    ],
    institution: [
      "InstitutionApplicationVerified", "InstitutionApplicationRejected", "InstitutionMemberInvited",
      "InstitutionMemberAccepted", "InstitutionMemberRejected"
    ],
    invoice: [
      "InvoiceCreated", "InvoiceDue", "InvoiceExpired", "InvoicePartiallyPaid", "InvoicePaid"
    ],
    loan: [
      "LoanOfferPublished", "LoanApplicationPublished", "LoanApplicationMatched", "LoanOfferMatched",
      "LoanApplicationApproved", "LoanApplicationRejected", "LoanOfferClosed", "LoanDisbursement",
      "LoanActivated", "LoanRepaymentDue", "LoanRepaymentCompleted", "LoanRepaymentReceived",
      "LoanRepaymentFailed", "LoanLiquidation", "LoanLtvBreach", "LiquidationWarning", "LiquidationCompleted"
    ],
    withdrawal: [
      "WithdrawalRequested", "WithdrawalRefunded", "WithdrawalRefundApproved", "WithdrawalRefundRejected"
    ],
    system: [
      "PlatformMaintenanceNotice", "SecurityAlert"
    ]
  }
} as const;

// =============================================================================
// ERROR RESPONSE TEMPLATES
// =============================================================================

export const errorResponseTemplates = {
  validation: {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: {}
    },
    timestamp: "2024-03-15T12:00:00.000Z",
    requestId: "req_validation_error"
  },

  unauthorized: {
    success: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication required or token invalid"
    },
    timestamp: "2024-03-15T12:00:00.000Z",
    requestId: "req_auth_error"
  },

  forbidden: {
    success: false,
    error: {
      code: "FORBIDDEN",
      message: "Insufficient permissions to access this resource"
    },
    timestamp: "2024-03-15T12:00:00.000Z",
    requestId: "req_forbidden_error"
  },

  notFound: {
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "Resource not found"
    },
    timestamp: "2024-03-15T12:00:00.000Z",
    requestId: "req_not_found_error"
  },

  rateLimited: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests. Please try again later."
    },
    timestamp: "2024-03-15T12:00:00.000Z",
    requestId: "req_rate_limit_error",
    retryAfter: 300
  },

  serverError: {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred. Please try again later."
    },
    timestamp: "2024-03-15T12:00:00.000Z",
    requestId: "req_server_error"
  }
} as const;

// =============================================================================
// COMPLETE API MOCK SCENARIOS
// =============================================================================

export const apiScenarios = {
  // User journey: New user registration to KYC verification
  userJourneyIndividual: {
    step1_register: betterAuthMocks.signUpEmail,
    step2_selectType: userProfileMocks.selectUserType,
    step3_submitKyc: kycMocks.submitKyc,
    step4_kycPending: kycMocks.getKycStatusPending,
    step5_kycVerified: kycMocks.getKycStatusVerified,
    step6_updateProfile: userProfileMocks.updateProfile
  },

  // Institution journey: Application to member invitation
  institutionJourney: {
    step1_selectType: userProfileMocks.selectInstitutionType,
    step2_submitApplication: institutionMocks.submitApplication,
    step3_inviteMember: institutionMocks.createInvitation,
    step4_memberAccepts: institutionMocks.acceptInvitation
  },

  // Error handling scenarios
  errorScenarios: {
    validation: userProfileMocks.updateProfileError,
    duplicateNik: kycMocks.duplicateNikError,
    businessExists: institutionMocks.businessNameExistsError,
    userNotFound: institutionMocks.userNotFoundError,
    unauthorized: errorResponseTemplates.unauthorized,
    rateLimited: errorResponseTemplates.rateLimited
  }
} as const;

// =============================================================================
// UTILITY FUNCTIONS FOR MOCK DATA
// =============================================================================

export const mockHelpers = {
  // Generate realistic Indonesian data
  generateIndonesianData: {
    nik: () => "32" + Math.floor(Math.random() * 100000000000000).toString().padStart(14, '0'),
    npwp: () => {
      const part1 = Math.floor(Math.random() * 100).toString().padStart(2, '0');
      const part2 = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const part3 = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const part4 = Math.floor(Math.random() * 10);
      const part5 = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const part6 = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      return `${part1}.${part2}.${part3}.${part4}-${part5}.${part6}`;
    },
    phoneNumber: () => "+6281" + Math.floor(Math.random() * 100000000).toString().padStart(8, '0'),
    businessName: () => {
      const types = ["PT", "CV", "UD"];
      const names = ["Teknologi", "Finansial", "Digital", "Inovasi", "Solusi"];
      const suffixes = ["Indonesia", "Nusantara", "Mandiri", "Sejahtera", "Prima"];
      return `${types[Math.floor(Math.random() * types.length)]} ${names[Math.floor(Math.random() * names.length)]} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
    }
  },

  // Generate timestamps
  generateTimestamps: {
    recent: () => new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(),
    past: () => new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
    future: () => new Date(Date.now() + Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString()
  },

  // Generate session tokens
  generateToken: () => `sess_clx7k2m3n${Math.random().toString(36).substr(2, 9)}.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`,

  // Generate user IDs
  generateUserId: () => `usr_clx7k2m3n${Math.random().toString(36).substr(2, 9)}`,

  // Generate request IDs
  generateRequestId: () => `req_${Math.random().toString(36).substr(2, 9)}`
} as const;

export default {
  mockUsers,
  betterAuthMocks,
  userProfileMocks,
  kycMocks,
  institutionMocks,
  notificationMocks,
  errorResponseTemplates,
  apiScenarios,
  mockHelpers
};
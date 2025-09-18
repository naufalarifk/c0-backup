# Loans Module

This module implements a comprehensive loan management system based on the OpenAPI specification. It provides APIs for loan offers, applications, and loan lifecycle management.

## Features

- **Loan Offers**: Create, list, and manage loan offers by lenders
- **Loan Applications**: Calculate requirements and apply for loans
- **Loan Management**: Track active loans, valuations, and operations
- **Early Operations**: Support for early liquidation and repayment

## Structure

### DTOs (Data Transfer Objects)
- `common.dto.ts` - Shared DTOs, enums, and validation decorators
- `loan-offers.dto.ts` - Loan offer creation, updates, and responses
- `loan-applications.dto.ts` - Loan application calculation and management
- `loans.dto.ts` - Active loan details and breakdowns
- `loan-operations.dto.ts` - Early liquidation and repayment operations

### Controllers
- `loan-offers.controller.ts` - REST endpoints for loan offers (`/loan-offers`)
- `loan-applications.controller.ts` - REST endpoints for applications (`/loan-applications`)
- `loans.controller.ts` - REST endpoints for loan management (`/loans`)

### Services
- `loan-offers.service.ts` - Business logic for loan offers
- `loan-applications.service.ts` - Business logic for applications
- `loans.service.ts` - Business logic for loan lifecycle

### Tests
- Unit tests for all controllers and services (`.spec.ts` files)
- End-to-end tests (`loans.e2e-spec.ts`)

## API Endpoints

### Loan Offers
- `POST /loan-offers` - Create a new loan offer
- `GET /loan-offers` - List available loan offers (with pagination and filtering)
- `GET /loan-offers/my-offers` - Get lender's loan offers
- `PATCH /loan-offers/:id` - Update a loan offer

### Loan Applications
- `POST /loan-applications/calculate` - Calculate loan requirements
- `POST /loan-applications` - Create a loan application
- `GET /loan-applications` - List user's applications
- `GET /loan-applications/:id` - Get application details
- `PATCH /loan-applications/:id` - Update an application

### Loans
- `GET /loans` - List user's loans (as borrower or lender)
- `GET /loans/:id` - Get loan details
- `GET /loans/:id/breakdown` - Get loan payment breakdown
- `GET /loans/:id/valuation` - Get current loan valuation
- `POST /loans/:id/early-liquidation/estimate` - Calculate early liquidation
- `POST /loans/:id/early-liquidation/request` - Request early liquidation
- `POST /loans/:id/early-repayment/estimate` - Calculate early repayment
- `POST /loans/:id/early-repayment/request` - Request early repayment

## Key Features

### Validation
- Comprehensive input validation using class-validator decorators
- Custom decimal amount validation for financial fields
- Rate and term limit validation
- Required field validation with clear error messages

### Authentication & Authorization
- All endpoints require proper authentication
- Role-based access control for different user types
- Session-based authentication using Better Auth

### Error Handling
- Standardized error responses with proper HTTP status codes
- Detailed error messages for validation failures
- Consistent error response format across all endpoints

### Pagination
- Cursor-based pagination for listing endpoints
- Configurable page size limits
- Metadata included in responses (total count, current page, etc.)

## Data Models

### Enums
- `LoanOfferStatus`: Draft, Active, Paused, Expired, Cancelled, Fulfilled
- `LoanApplicationStatus`: Draft, Submitted, UnderReview, Approved, Rejected, Cancelled
- `LoanStatus`: Draft, Active, Matured, EarlyLiquidated, EarlyRepaid, Defaulted
- `LiquidationMode`: Full, Partial
- `UserRole`: borrower, lender

### Currency Support
- Multi-blockchain support (Ethereum, BSC, etc.)
- ERC20 token support
- Native cryptocurrency support (ETH, BNB, etc.)
- Decimal precision handling for financial calculations

## Testing

### Unit Tests
Each service and controller has comprehensive unit tests covering:
- Success scenarios
- Error handling
- Edge cases
- Validation logic
- Mock service interactions

### E2E Tests
End-to-end tests validate:
- Complete API workflows
- Authentication requirements
- Request/response validation
- Integration between components

## Development Notes

### Current Implementation
The current implementation provides:
- Complete API structure matching the OpenAPI specification
- Mock responses for all endpoints (ready for business logic integration)
- Comprehensive validation and error handling
- Full test coverage

### Next Steps
To complete the implementation:
1. Integrate with actual database and blockchain services
2. Implement real business logic in service methods
3. Add proper authentication middleware
4. Configure database schemas and migrations
5. Add monitoring and logging

### Dependencies
- NestJS framework for dependency injection and decorators
- Class-validator for DTO validation
- Swagger/OpenAPI for API documentation
- Jest for testing
- Better Auth for authentication
- Repository pattern for data access

## Configuration

The module is configured in `loans.module.ts` and can be imported into the main application module. All controllers and services are properly wired with dependency injection.

## Error Codes

The API uses standard HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Unprocessable Entity
- `500` - Internal Server Error

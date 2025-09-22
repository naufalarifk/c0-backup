# User Home Institution UI Flow

This document describes the complete UI flow for institution management features in the CryptoGadAI application, organized in logical user journey order.

## 1. Dashboard Home Institutions

**Page Type**: Main Dashboard
**Navigation**: Accessible from main navigation

### Components and Elements:

#### Header Section
- **App Logo**: "CryptoGadAI" brand logo in top-left corner
- **Time Display**: "09:41" in status bar
- **Signal/Battery Icons**: Standard mobile status indicators
- **Notification Bell**: Icon for notifications in top-right

#### User Profile Card
- **Avatar**: Circular user profile image (multicolored geometric design)
- **User Name**: "John Smith" as main heading
- **Email**: "john.smith@company.com" as subtitle
- **Owner Badge**: Green "Owner" label indicating user role

#### Loan Portfolio Card (Primary)
- **Card Header**:
  - White lightning bolt icon with "Loan Portfolio" title
  - Date indicator: "July 2025"
  - Lock icon indicating security/privacy
- **Main Amount**: "127,856.43 USDT" in large white text
- **Income Section**:
  - "Income" label in white
  - Amount: "127,856.43 USDT" in green
- **Active Loans Section**:
  - "Active Loans" label in white
  - Count: "126" in white
- **View Details Button**: White button with "View Details" text and arrow icon

#### Action Menu (Icon Grid)
Four blue circular action buttons arranged horizontally:
- **Offer Button**: Stack/layers icon with "Offer" label
- **Withdraw Button**: Dollar sign icon with "Withdraw" label
- **History Button**: Document/list icon with "History" label
- **Member Button**: People/network icon with "Member" label

**User Interaction**: Users tap Member button to access institution management features

#### Announcement Section
- **Section Header**: "Announcement" with "See more" link
- **Announcement Card**:
  - CryptoGadAI logo
  - "Announcement" tag
  - Headline: "New Features Available CryptoGadAI Apps"
  - Description: "Secure crypto lending platform that makes borrowing against your digital assets simple and transparent."
  - "Update Now" button with arrow
  - Release date: "Jul 15, 2025"

#### News Section
- **Section Header**: "News" with "See more" link
- **News Card**:
  - CryptoGadAI logo with "News" tag
  - Headline: "Trump Tariffs and Your Investment Crypto"
  - Description: "Secure crypto lending platform that makes borrowing against your digital assets simple and transparent."
  - Source: "www.cryptogadai.com"
  - Date: "Jul 15, 2025"

#### Article Section
- **Section Header**: "Article" with "See more" link
- **Article Items** (3 shown):
  1. Box icon with "New Features Available CryptoGadAI" title and description
  2. Gear icon with "New Features Available CryptoGadAI" title and description
  3. Gift icon with "New Features Available CryptoGadAI" title and description

#### Bottom Navigation
Five tabs with icons and labels:
- **Home**: House icon (currently active)
- **Loans**: Money/cash icon
- **Market**: Chart/graph icon
- **Wallet**: Wallet icon
- **Profile**: Person icon

## 2. Member Management Current

**Page Type**: Management Interface
**Navigation**: From Dashboard ’ Member button

### Components and Elements:

#### Header
- **Back Arrow**: Navigation to return to previous screen
- **Page Title**: "Member Management"

#### Institution Info Card
- **Institution Icon**: Blue verified checkmark with institution logo
- **Institution Name**: "PT. Bank Central Indonesia"
- **Verification Badge**: Green "Verified" indicator
- **Member Stats**: "Members" label with "234 Active" count

#### Role Permissions Section
Informational cards explaining role capabilities:
- **Owner Role Card**:
  - Green "Owner" badge
  - Description: "Full access to all features including member management"
- **Finance Role Card**:
  - Orange "Finance" badge
  - Description: "Can create loan offers and manage financials, cannot manage members"

#### Tab Navigation
- **Current Tab**: Active blue tab showing current members
- **Pending Tab**: Inactive tab for pending invitations

#### Section Header
- **Title**: "Current Members"
- **Invite Button**: Blue "+" Invite button in top-right

#### Member List
Three member cards with consistent structure:

**Member 1 (Owner)**:
- **Avatar**: Circular profile image
- **Name**: "John Smith"
- **Role Badge**: Green "Owner"
- **Verification**: Blue "Verified User" badge
- **Email**: "john.smith@company.com"
- **Join Date**: "Joined: Jan 15, 2025"
- **Actions**: No remove option (owner cannot be removed)

**Member 2 (Finance)**:
- **Avatar**: Circular profile image
- **Name**: "Sarah Johnson"
- **Role Badge**: Orange "Finance"
- **Verification**: Blue "Verified User" badge
- **Email**: "sarah.johnson@company.com"
- **Join Date**: "Joined: Jan 15, 2025"
- **Remove Button**: Red "Remove" button

**Member 3 (Finance)**:
- **Avatar**: Circular profile image
- **Name**: "Mike Chen"
- **Role Badge**: Orange "Finance"
- **Verification**: Blue "Verified User" badge
- **Email**: "mike.chen@company.com"
- **Join Date**: "Joined: Jan 15, 2025"
- **Remove Button**: Red "Remove" button

**User Interaction**: Users can tap "Invite" to add new members or "Remove" to remove existing members

## 3. Member Management Pending

**Page Type**: Management Interface - Pending View
**Navigation**: From Member Management Current ’ Pending tab

### Components and Elements:

#### Header and Institution Info
Same as Current tab (consistent layout)

#### Tab Navigation
- **Current Tab**: Inactive tab
- **Pending Tab**: Active blue tab showing pending invitations

#### Section Header
- **Title**: "Pending Members"
- **Invite Button**: Blue "+" Invite button

#### Pending Member List
Four pending invitation cards:

**Pending Member 1**:
- **Avatar**: Circular profile placeholder
- **Name**: "Alex Wilson"
- **Role Badge**: Orange "Finance"
- **Verification**: Blue "Verified User" badge
- **Email**: "alex.wilson@company.com"
- **Status Info**: "Sent: Invited: Feb 10, 2025"
- **Expiration**: "Invitation expires in 5 days"
- **Actions**:
  - Green "Resent" button
  - Gray "Cancel" button

**Pending Members 2-4**: Similar structure with different names (Alex Wilson, Emma Davis, Robert Brown) but same layout and action buttons

**User Interaction**: Users can resend invitations with "Resent" button or cancel pending invitations with "Cancel" button

## 4. Invite Member (Empty Form)

**Page Type**: Form Interface
**Navigation**: From Member Management ’ + Invite button

### Components and Elements:

#### Header
- **Back Arrow**: Navigation to return to member management
- **Page Title**: "Invite Member"

#### Form Section
- **Form Title**: "Invite New Member"

#### Email Input
- **Field Label**: "Email Address"
- **Input Field**: Text input with placeholder "Enter email address"

#### Role Selection
- **Field Label**: "Role"
- **Role Option**:
  - "Finance" option with orange background
  - "Limited Access" subtitle text

#### Message Input
- **Field Label**: "Individual Message (Optional)"
- **Text Area**: Large text input with placeholder "Add a Individual message to the invitation..."

#### Requirements Section
- **Section Title**: "Requirements:"
- **Requirement 1**: Checkmark icon + "Target user must have verified KYC"
- **Requirement 2**: Checkmark icon + "User cannot be member of another institution"

#### Action Button
- **Continue Button**: Blue button with "Continue" text (likely disabled when form is empty)

**User Interaction**: Users fill in email address, select role, optionally add message, then tap Continue to proceed

## 5. Invite Member (Filled Form)

**Page Type**: Form Interface - Populated
**Navigation**: After user fills form in previous step

### Components and Elements:

#### Header
Same as empty form

#### Form Section
- **Form Title**: "Invite New Member"

#### Email Input (Filled)
- **Field Label**: "Email Address"
- **Input Value**: "sarah.johnson@company.com"

#### User Verification Card
- **Avatar**: Circular profile image
- **Name**: "Sarah Johnson"
- **Verification Badge**: Blue "Verified User" indicator
- **Email**: "sarah.johnson@company.com"

#### Role Selection (Selected)
- **Field Label**: "Role"
- **Selected Role**: Green checkmark + "Finance" with "Limited Access" subtitle

#### Message Input (Filled)
- **Field Label**: "Individual Message (Optional)"
- **Message Text**: "Hi Sarah, we'd like to invite you to join our institution as a Finance member. You'll be able to create loan offers and..."

#### Requirements Section
Same requirements as empty form, with checkmarks indicating they're met

#### Action Button
- **Continue Button**: Blue button with "Continue" text (now enabled)

**User Interaction**: User reviews filled information and taps Continue to proceed to review step

## 6. Invite Member Review

**Page Type**: Review/Confirmation Interface
**Navigation**: From filled form ’ Continue button

### Components and Elements:

#### Header
- **Back Arrow**: Navigation to return to form
- **Page Title**: "Invite Member"

#### Invitation Summary Section
- **Section Title**: "Invitation Summary"
- **User Card**:
  - Avatar: Circular profile image
  - Name: "Sarah Johnson"
  - Role Badge: Orange "Finance"
  - Email: "sarah.johnson@company.com"

#### Message Preview Section
- **Section Title**: "Message Preview"
- **Message Text**: "Hi Sarah, we'd like to invite you to join our institution as a Finance member. You'll be able to create loan offers and..."

#### Terms and Conditions Section
- **Section Title**: "Terms and Conditions"
- **Condition 1**: Green checkmark + "Invitee will have access to institution financial data" with description "This includes loan portfolios, earnings reports, and transaction history"
- **Condition 2**: Green checkmark + "I confirm this person is authorized to represent our institution" with description "By checking this, you verify their identity and authority to act on behalf of the institution"

#### Action Button
- **Send Invitation Button**: Blue button with paper plane icon and "Send Invitation" text

**User Interaction**: User reviews all details and terms, then taps Send Invitation to complete the process

## 7. Invite Member Success

**Page Type**: Success Confirmation
**Navigation**: After successful invitation send

### Components and Elements:

#### Header
- **Back Arrow**: Navigation option
- **Page Title**: "Member Invitation"

#### Success Indicator
- **Success Icon**: Large green circular checkmark
- **Success Message**: "Invitation sent successfully!"
- **Description**: "Your invitation has been sent to Sarah Johnson. They will receive an email with instructions to join your institution."

#### Invitee Information Card
- **Avatar**: Circular profile image
- **Name**: "Sarah Johnson"
- **Role Badge**: Orange "Finance"
- **Email**: "sarah.johnson@company.com"

#### Status Information
- **Sent**: "Just now"
- **Status**: "Pending"

#### Action Buttons
- **Primary Action**: Blue "Back to Member Management" button with people icon
- **Secondary Action**: White "Invite Another Member" button with "+" icon

**User Interaction**: User can return to member management or invite additional members

## 8. Invite Member Failed

**Page Type**: Error State
**Navigation**: When invitation sending fails

### Components and Elements:

#### Header
- **Back Arrow**: Navigation option
- **Page Title**: "Member Invitation"

#### Error Indicator
- **Error Icon**: Large red circular X mark
- **Error Message**: "Invitation sent has been declined."
- **Description**: "We're sorry, your invitation application has been declined."

#### Invitee Information Card
- **Avatar**: Circular profile image
- **Name**: "Sarah Johnson"
- **Role Badge**: Orange "Finance"
- **Email**: "sarah.johnson@company.com"

#### Status Information
- **Sent**: "Just now"
- **Status**: "Pending"

#### Action Buttons
- **Primary Action**: Blue "Back to Member Management" button with people icon
- **Secondary Action**: White "Invite Another Member" button with "+" icon

**User Interaction**: User can return to member management to retry or invite other members

## 9. Remove Member Confirmation

**Page Type**: Confirmation Dialog
**Navigation**: From Member Management ’ Remove button on member

### Components and Elements:

#### Background
- **Overlay**: Darkened background showing member management page underneath

#### Modal Dialog
- **Warning Icon**: Red circular warning/exclamation icon
- **Dialog Title**: "Remove Member"
- **Confirmation Message**: "Are you sure you want to remove this member? This action cannot be undone."

#### Action Buttons
- **Destructive Action**: Red "Remove" button
- **Cancel Action**: Gray "Cancel" button

**User Interaction**: User confirms removal with Remove button or cancels the action

## 10. Resent Member Confirmation

**Page Type**: Success Dialog
**Navigation**: After successfully resending invitation

### Components and Elements:

#### Background
- **Overlay**: Darkened background showing pending members page underneath

#### Modal Dialog
- **Success Icon**: Green circular checkmark
- **Dialog Title**: "Application Resent"
- **Success Message**: "The member's application has been resent successfully."

#### Action Button
- **Close Button**: "Close" button to dismiss dialog

**User Interaction**: User taps Close to return to pending members list

## 11. Invite Member Notifications (Modal)

**Page Type**: Notification Modal
**Navigation**: Appears as overlay on dashboard when user has pending invitation

### Components and Elements:

#### Background
- **Overlay**: Semi-transparent background showing dashboard
- **Verification Status Bar**: Orange warning bar with "Verification Status" and "Complete your verification to unlock features" message, plus blue "Verify Now" button

#### Notification Modal
- **Institution Icon**: Blue circular icon with institutional symbol
- **Modal Title**: "Join to PT. Bank Central Indonesia"
- **Invitation Message**: "You've been invited to join as a Finance member"
- **Role Information**:
  - Orange "Finance" role badge
  - Description: "Can create loan offers and manage financials, cannot manage members"

#### Action Buttons
- **Primary Action**: Blue "Details" button
- **Secondary Action**: Gray "Close" button

**User Interaction**: User can view details of invitation or close the notification

## 12. Institution Invitation Details

**Page Type**: Invitation Details View
**Navigation**: From notification modal ’ Details button

### Components and Elements:

#### Header
- **Back Arrow**: Navigation to return
- **Page Title**: "Invitation Details"
- **Trash Icon**: Delete/dismiss option

#### Invitation Header
- **Institution Icon**: Large blue circular institutional symbol
- **Invitation Title**: "Join to PT. Bank Central Indonesia"
- **Invitation Message**: "You've been invited to join as a Finance member"

#### Email Details Section
- **To**: "sarah.johnson@email.com"
- **Subject**: "Invitation to join PT. Bank Central Indonesia as Finance Member"

#### Message Content
Invitation email text: "Hi Sarah, We would like to invite you to join PT. Bank Central Indonesia Solutions Ltd as a Finance member..."

#### About Institutions Section
- **Section Title**: "About Institutions"
- **Description**: "PT. Bank Negara Indonesia (BNI) is one of the largest banks in Indonesia. It has branches in several countries and provides a wide range of financial funding is for business ...Read More"

#### Institution Card
- **Institution Name**: "PT. Bank Central Indonesia"
- **Verification**: Green "Verified" badge
- **Members**: "234 Active"
- **Role Badge**: Orange "Finance" with description "Can create loan offers and manage financials, cannot manage members"

#### Action Button
- **Continue Button**: Blue "Continue" button

**User Interaction**: User reviews invitation details and taps Continue to proceed with acceptance process

## 13. Institution Invitation (Institution Tab)

**Page Type**: Multi-step Invitation Review
**Navigation**: From invitation details ’ Continue button

### Components and Elements:

#### Header
- **Back Arrow**: Navigation to return
- **Page Title**: "Institution Invitation"

#### Invitation Summary
- **Main Message**: "You've been invited to join PT. Bank Central Indonesia"
- **User Info Card**:
  - Avatar: Circular profile image
  - Name: "Sarah Johnson"
  - Role Badge: Orange "Finance"
  - Email: "sarah.johnson@company.com"
- **Expiration Notice**: "This invitation expires in 5 days"

#### Tab Navigation
- **Institution Tab**: Active blue tab (currently selected)
- **Role Tab**: Inactive tab
- **Terms Tab**: Inactive tab

#### Institution Details Section
- **Section Title**: "Institution Details"
- **Company**: "PT. Bank Central Indonesia"
- **Registration**: "FSL-2024-001"
- **Industry**: "Financial Services"
- **Members**: "Since Jan 2024"

#### Contact Information Section
- **Section Title**: "Contact Information"
- **Address**: "123 Financial District, Suite 400"
- **Email**: "contact@pt.bankcentralindonesia.com"
- **Phone**: "+1 (555) 123-4567"

#### Before Accepting Section
- **Requirement 1**: "I understand my role and responsibilities as a Finance member"
- **Requirement 2**: "I am authorized to represent Bank Central Indonesia Solutions Ltd on this platform"
- **Requirement 3**: "I agree to platform terms and institution policies"

#### Action Buttons
- **Accept Invitation**: Blue button
- **Reject Invitation**: White button

**User Interaction**: User reviews institution information before proceeding to role details

## 14. Institution Invitation (Role Tab)

**Page Type**: Role Details View
**Navigation**: From Institution tab ’ Role tab

### Components and Elements:

#### Header and Invitation Summary
Same as Institution tab

#### Tab Navigation
- **Institution Tab**: Inactive tab
- **Role Tab**: Active blue tab (currently selected)
- **Terms Tab**: Inactive tab

#### Institution Details Section
- **Section Title**: "Institution Details"
- **What you can do**: List of permissions
  -  "Create and manage loan offers"
  -  "View financial data and reports"
  -  "Access withdrawal operations"
  -  "Monitor loan performance"

#### Restrictions Section
- **Restrictions**: List of limitations
  -  "Cannot manage institution members"
  -  "Cannot modify institution settings"
  -  "Cannot invite new members"

#### Your Responsibilities Section
- **Represent the institution**: "You will act on behalf of Fintech Solutions Ltd"
- **Maintain confidentiality**: "Protect institution financial data and information"
- **Follow compliance**: "All activities will be logged and auditable"

#### Before Accepting Section
Same requirements as Institution tab

#### Action Buttons
- **Accept Invitation**: Blue button
- **Reject Invitation**: White button

**User Interaction**: User reviews role permissions and restrictions before proceeding to terms

## 15. Institution Invitation (Terms Tab)

**Page Type**: Terms and Privacy View
**Navigation**: From Role tab ’ Terms tab

### Components and Elements:

#### Header and Invitation Summary
Same as previous tabs

#### Tab Navigation
- **Institution Tab**: Inactive tab
- **Role Tab**: Inactive tab
- **Terms Tab**: Active blue tab (currently selected)

#### Data Access & Privacy Section
- **Financial data access**: "You will have access to institution financial information"
- **Confidentiality requirement**: "You must protect institution data and maintain confidentiality"

#### Important Notice Section
Orange warning box with important terms:
- **Agreement points**:
  " "Act in the best interest of the institution"
  " "Comply with all applicable laws and regulations"
  " "Maintain the security of your account credentials"
  " "Report any suspicious activities immediately"

#### Before Accepting Section
Enhanced with checkmarks showing completion:
-  "I understand my role and responsibilities as a Finance member"
-  "I am authorized to represent Bank Central Indonesia Solutions Ltd on this platform"
-  "I agree to platform terms and institution policies"

#### Action Buttons
- **Accept Invitation**: Blue button (now enabled)
- **Reject Invitation**: White button

**User Interaction**: User reviews final terms and either accepts or rejects the invitation

## 16. Invitation Accepted Success

**Page Type**: Success Confirmation
**Navigation**: After accepting invitation

### Components and Elements:

#### Header
- **Back Arrow**: Navigation option
- **Page Title**: "Invitation Accepted"

#### Success State
- **Success Icon**: Large green circular checkmark
- **Success Message**: "Welcome to PT. Bank Central Indonesia"

#### Institution Information Card
- **Institution Name**: "PT. Bank Central Indonesia"
- **Subtitle**: "Your new institution"
- **Role Badge**: Orange "Finance"
- **Member Count**: "4 members " Active since Jan 2024"

#### Access Information
- **Section Title**: "You now have access to institution features"
- **Feature List**:
  -  "Create and manage loan offers"
  -  "View financial data and reports"
  -  "Access withdrawal operations"

#### Action Button
- **Return to Dashboard**: Blue button

**User Interaction**: User taps button to return to main dashboard with new institution access

## 17. Invitation Accepted Declined

**Page Type**: Declined State
**Navigation**: When invitation is declined

### Components and Elements:

#### Header
- **Back Arrow**: Navigation option
- **Page Title**: "Invitation Accepted"

#### Declined State
- **Declined Icon**: Large red circular X mark
- **Status Message**: "Invitation declined"
- **Notification**: "The institution owner has been notified"

#### Institution Information Card
- **Institution Name**: "PT. Bank Central Indonesia"
- **Subtitle**: "Your new institution"
- **Role Badge**: Orange "Finance"
- **Member Count**: "4 members " Active since Jan 2024"

#### Action Buttons
- **Return to Dashboard**: Blue button
- **Contact Support**: Gray link

**User Interaction**: User can return to dashboard or contact support for assistance

## 18. Invitation Accepted Expired

**Page Type**: Expired State
**Navigation**: When invitation has expired

### Components and Elements:

#### Header
- **Back Arrow**: Navigation option
- **Page Title**: "Invitation Accepted"

#### Expired State
- **Expired Icon**: Large orange circular clock icon
- **Status Message**: "Invitation Expired"
- **Details**: "This invitation to join Fintech Solutions Ltd has expired on Dec 15, 2024."

#### Institution Information Card
- **Institution Name**: "PT. Bank Central Indonesia"
- **Subtitle**: "Your new institution"
- **Role Badge**: Orange "Finance"
- **Member Count**: "4 members " Active since Jan 2024"

#### Action Buttons
- **Return to Dashboard**: Blue button
- **Contact Support**: Gray link

#### Need Help Section
- **Support Email**: "support@cryptogadai.com"
- **Support Phone**: "+1 (555) 123-4567"

**User Interaction**: User can return to dashboard or contact support to request a new invitation

---

## User Journey Summary

The complete flow represents a comprehensive institution member management system with the following key user paths:

1. **Institution Owner Journey**: Dashboard ’ Member Management ’ Invite Process ’ Success/Failure handling
2. **Invitee Journey**: Notification ’ Invitation Review ’ Acceptance/Rejection ’ Confirmation
3. **Management Journey**: Current/Pending member views ’ Member removal/resending

Each interface maintains consistent design patterns with clear navigation, status indicators, and appropriate user feedback for all actions.
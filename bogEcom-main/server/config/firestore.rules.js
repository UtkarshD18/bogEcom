/**
 * Firestore Security Rules for bogEcom
 *
 * Copy and paste these rules into Firebase Console:
 * Firebase Console > Firestore Database > Rules
 *
 * ARCHITECTURE:
 * - MongoDB is the source of truth
 * - Firestore is a READ-ONLY mirror for real-time updates
 * - Only server (Admin SDK) can write to Firestore
 * - Clients can only read their own orders
 */

/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Orders collection - READ ONLY for authenticated users
    match /orders/{orderId} {
      // Users can only read their own orders
      // The userId field in the document must match the authenticated user's UID
      allow read: if request.auth != null && 
                     resource.data.userId == request.auth.uid;
      
      // No client writes allowed - server only via Admin SDK
      allow write: if false;
    }
    
    // Block all other collections by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
*/

/**
 * ALTERNATIVE: If using custom auth (JWT from your backend, not Firebase Auth):
 * You may need to adjust rules or use a service account approach.
 *
 * For maximum security with custom auth, consider:
 * 1. Using Firebase Auth custom tokens
 * 2. Or, making Firestore completely private and exposing via API
 *
 * Current approach assumes Firebase Auth UID matches your userId.
 * If not using Firebase Auth for users, adjust the userId check accordingly.
 */

/**
 * QUICK SETUP (Development/Testing):
 * 
 * If you want to test without Firebase Auth, use these rules temporarily:
 * (NOT FOR PRODUCTION)
 *
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /orders/{orderId} {
      // Allow read for testing (INSECURE - for dev only)
      allow read: if true;
      allow write: if false;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
 */

export default null; // This file is documentation only

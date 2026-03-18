export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  statusMessage?: string;
  lastSeen?: any; // Timestamp
  isOfficial?: boolean;
}

export interface Chat {
  id: string;
  participants: string[];
  type: 'direct' | 'group';
  name?: string;
  photoURL?: string;
  lastMessage?: {
    text: string;
    createdAt: any; // Timestamp
    senderId: string;
    customTime?: string;
  };
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any; // Timestamp
  type: 'text' | 'image' | 'sticker';
  imageUrl?: string;
  stickerId?: string;
  read?: boolean;
  customTime?: string;
  mentions?: string[]; // Array of UIDs
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

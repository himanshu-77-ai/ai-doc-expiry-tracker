export interface Document {
  id: string;
  title: string;
  category: string;
  expiryDate: string;
  issueDate?: string;
  documentNumber?: string;
  status: 'Safe' | 'Expiring Soon' | 'Expired' | 'Renewed';
  fileUrl?: string;
  fileData?: string;
  summary?: string;
  createdAt: any;
  userId: string;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  plan?: string;
}

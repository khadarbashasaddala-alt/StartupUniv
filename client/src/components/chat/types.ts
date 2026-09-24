export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface Lead {
  name: string;
  email: string;
  phone?: string;
}

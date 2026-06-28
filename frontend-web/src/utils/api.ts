import auth from "./auth";

const BASE_URL = "http://localhost:8080/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.body instanceof FormData) {
    headers.delete("Content-Type");
  }

  let response: Response;
  try {
    // Dynamic token retrieval right before fetch execution
    const token = auth.getToken();
    if (token) {
      headers.set("Authorization", "Bearer " + token);
    }

    console.log("Initiating fetch to:", `${BASE_URL}${path}`);
    console.log("Authorization Header:", headers.get("Authorization") || "MISSING");
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    if (err instanceof TypeError || err.message?.includes("Failed to fetch") || err.message?.includes("fetch")) {
      throw new Error("Network Error: Cannot connect to backend on port 8080. Is it running?");
    }
    throw err;
  }

  if (!response.ok) {
    console.warn("API Call Failed:", response.status, response.statusText);
    let rawText = "";
    try {
      rawText = await response.text();
      console.warn("Raw response text:", rawText);
    } catch (_) {}

    let errorMessage = "An error occurred";
    try {
      if (rawText) {
        const errorJson = JSON.parse(rawText);
        errorMessage = errorJson.error || errorJson.message || errorMessage;
      }
    } catch (_) {
      if (rawText) {
        errorMessage = rawText;
      }
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return {} as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export interface GrammarCorrection {
  original: string;
  correction: string;
  explanation: string;
}

export interface Feedback {
  grammarCorrections: GrammarCorrection[];
  pronunciationScore: number;
  pronunciationFeedback: string;
  vocabularyTips: string;
}

export interface Message {
  id: string;
  role: "USER" | "ASSISTANT";
  transcript: string;
  createdAt: string;
  feedback: Feedback | null;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
}

export interface ConversationHistory {
  id: string;
  title: string;
  messages: Message[];
}

export const api = {
  async signup(email: string, password: string): Promise<{ userId: string; message: string }> {
    return request("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async login(email: string, password: string): Promise<{ token: string; email: string; expiresIn: number }> {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async getConversations(): Promise<Conversation[]> {
    return request("/conversations");
  },

  async createConversation(title: string): Promise<Conversation> {
    return request("/conversations", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  },

  async getConversationHistory(conversationId: string): Promise<ConversationHistory> {
    return request(`/conversations/${conversationId}`);
  },
  async deleteConversation(id: string): Promise<void> {
    return request(`/conversations/${id}`, {
      method: "DELETE",
    });
  },
  async sendVoiceMessage(
    conversationId: string,
    audioBlob: Blob
  ): Promise<ConversationHistory> {
    const token = auth.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }

    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`, {
        method: "POST",
        headers,
        body: formData,
      });
    } catch (err: any) {
      if (err instanceof TypeError || err.message?.includes("Failed to fetch") || err.message?.includes("fetch")) {
        throw new Error("Network Error: Cannot connect to backend on port 8080. Is it running?");
      }
      throw err;
    }

    if (!response.ok) {
      console.warn("API Call Failed:", response.status, response.statusText);
      let rawText = "";
      try {
        rawText = await response.text();
        console.warn("Raw response text:", rawText);
      } catch (_) {}

      let errorMessage = "Failed to upload audio";
      try {
        if (rawText) {
          const errorJson = JSON.parse(rawText);
          errorMessage = errorJson.error || errorMessage;
        }
      } catch (_) {
        if (rawText) {
          errorMessage = rawText;
        }
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }
};
export default api;

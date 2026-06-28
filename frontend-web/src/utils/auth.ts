const TOKEN_KEY = "coach_jwt_token";
const EMAIL_KEY = "coach_user_email";

export const auth = {
  setToken(token: string): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem("token", token);
    }
  },

  getToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem(TOKEN_KEY) || localStorage.getItem("token");
    }
    return null;
  },

  removeToken(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("token");
    }
  },

  setEmail(email: string): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(EMAIL_KEY, email);
    }
  },

  getEmail(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem(EMAIL_KEY);
    }
    return null;
  },

  removeEmail(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(EMAIL_KEY);
    }
  },

  logout(): void {
    this.removeToken();
    this.removeEmail();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  },

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    // Check basic JWT expiration
    try {
      const payloadBase64 = token.split(".")[1];
      if (!payloadBase64) return false;
      
      const payload = JSON.parse(atob(payloadBase64));
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        this.removeToken();
        this.removeEmail();
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }
};
export default auth;

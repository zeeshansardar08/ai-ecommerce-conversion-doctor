export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      reports: {
        Row: {
          id: string;
          created_at: string;
          url: string;
          page_type: "product" | "home" | "cart" | "other";
          status: "queued" | "running" | "done" | "failed";
          error: string | null;
          detected_platform: "shopify" | "woocommerce" | "unknown" | null;
          scraped_json: Json | null;
          result_json: Json | null;
          lead_captured: boolean;
          ip_hash: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          url: string;
          page_type: "product" | "home" | "cart" | "other";
          status?: "queued" | "running" | "done" | "failed";
          error?: string | null;
          detected_platform?: "shopify" | "woocommerce" | "unknown" | null;
          scraped_json?: Json | null;
          result_json?: Json | null;
          lead_captured?: boolean;
          ip_hash?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          url?: string;
          page_type?: "product" | "home" | "cart" | "other";
          status?: "queued" | "running" | "done" | "failed";
          error?: string | null;
          detected_platform?: "shopify" | "woocommerce" | "unknown" | null;
          scraped_json?: Json | null;
          result_json?: Json | null;
          lead_captured?: boolean;
          ip_hash?: string | null;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          created_at: string;
          report_id: string;
          email: string;
          consent: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          report_id: string;
          email: string;
          consent?: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          report_id?: string;
          email?: string;
          consent?: boolean;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          id: string;
          created_at: string;
          key: string;
          count: number;
          reset_at: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          key: string;
          count?: number;
          reset_at: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          key?: string;
          count?: number;
          reset_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

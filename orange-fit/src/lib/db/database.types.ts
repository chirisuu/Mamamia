
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admin_audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"id": string,"metadata": NonNullable<Json>,"target_id": string | null,"target_table": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"target_id"?: string | null,"target_table"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"target_id"?: string | null,"target_table"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ai_analysis_requests": {
                  Row: {
                    "created_at": string,"error_code": string | null,"estimated_cost_usd": number | null,"id": string,"input_storage_path": string | null,"kind": Database["public"]['Enums']["ai_request_kind"],"latency_ms": number | null,"model": string | null,"output": Json | null,"provider": string | null,"status": Database["public"]['Enums']["ai_request_status"],"tokens_input": number | null,"tokens_output": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error_code"?: string | null,"estimated_cost_usd"?: number | null,"id"?: string,"input_storage_path"?: string | null,"kind": Database["public"]['Enums']["ai_request_kind"],"latency_ms"?: number | null,"model"?: string | null,"output"?: Json | null,"provider"?: string | null,"status"?: Database["public"]['Enums']["ai_request_status"],"tokens_input"?: number | null,"tokens_output"?: number | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"error_code"?: string | null,"estimated_cost_usd"?: number | null,"id"?: string,"input_storage_path"?: string | null,"kind"?: Database["public"]['Enums']["ai_request_kind"],"latency_ms"?: number | null,"model"?: string | null,"output"?: Json | null,"provider"?: string | null,"status"?: Database["public"]['Enums']["ai_request_status"],"tokens_input"?: number | null,"tokens_output"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"app_settings": {
                  Row: {
                    "description": string | null,"is_public": boolean,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"is_public"?: boolean,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Update: {
                    "description"?: string | null,"is_public"?: boolean,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"assistant_conversations": {
                  Row: {
                    "created_at": string,"id": string,"title": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"title"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"title"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"assistant_messages": {
                  Row: {
                    "content": string,"conversation_id": string,"created_at": string,"flagged": boolean,"id": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"conversation_id": string,"created_at"?: string,"flagged"?: boolean,"id"?: string,"role": string,"user_id": string
                  }
                  Update: {
                    "content"?: string,"conversation_id"?: string,"created_at"?: string,"flagged"?: boolean,"id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assistant_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "assistant_conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"badges": {
                  Row: {
                    "code": string,"created_at": string,"criteria": NonNullable<Json>,"description": string | null,"icon": string,"id": string,"is_active": boolean,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"criteria"?: NonNullable<Json>,"description"?: string | null,"icon"?: string,"id"?: string,"is_active"?: boolean,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"criteria"?: NonNullable<Json>,"description"?: string | null,"icon"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"billing_events": {
                  Row: {
                    "event_id": string,"id": string,"processed_at": string,"provider": Database["public"]['Enums']["billing_provider"],"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"id"?: string,"processed_at"?: string,"provider": Database["public"]['Enums']["billing_provider"],"type": string
                  }
                  Update: {
                    "event_id"?: string,"id"?: string,"processed_at"?: string,"provider"?: Database["public"]['Enums']["billing_provider"],"type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"body_measurements": {
                  Row: {
                    "arm_cm": number | null,"calf_cm": number | null,"chest_cm": number | null,"created_at": string,"hip_cm": number | null,"id": string,"local_date": string,"neck_cm": number | null,"note": string | null,"thigh_cm": number | null,"user_id": string,"waist_cm": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "arm_cm"?: number | null,"calf_cm"?: number | null,"chest_cm"?: number | null,"created_at"?: string,"hip_cm"?: number | null,"id"?: string,"local_date": string,"neck_cm"?: number | null,"note"?: string | null,"thigh_cm"?: number | null,"user_id": string,"waist_cm"?: number | null
                  }
                  Update: {
                    "arm_cm"?: number | null,"calf_cm"?: number | null,"chest_cm"?: number | null,"created_at"?: string,"hip_cm"?: number | null,"id"?: string,"local_date"?: string,"neck_cm"?: number | null,"note"?: string | null,"thigh_cm"?: number | null,"user_id"?: string,"waist_cm"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"brands": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"name_normalized": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"name_normalized"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"name_normalized"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"challenges": {
                  Row: {
                    "code": string,"created_at": string,"description": string | null,"duration_days": number,"id": string,"is_active": boolean,"kind": string,"target_value": number,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"description"?: string | null,"duration_days": number,"id"?: string,"is_active"?: boolean,"kind": string,"target_value": number,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"description"?: string | null,"duration_days"?: number,"id"?: string,"is_active"?: boolean,"kind"?: string,"target_value"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"consents": {
                  Row: {
                    "consent_type": Database["public"]['Enums']["consent_type"],"created_at": string,"granted": boolean,"granted_at": string,"id": string,"revoked_at": string | null,"user_id": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consent_type": Database["public"]['Enums']["consent_type"],"created_at"?: string,"granted": boolean,"granted_at"?: string,"id"?: string,"revoked_at"?: string | null,"user_id": string,"version": string
                  }
                  Update: {
                    "consent_type"?: Database["public"]['Enums']["consent_type"],"created_at"?: string,"granted"?: boolean,"granted_at"?: string,"id"?: string,"revoked_at"?: string | null,"user_id"?: string,"version"?: string
                  }
                  Relationships: [
                    
                  ]
                },"content_pages": {
                  Row: {
                    "body_md": string,"created_at": string,"id": string,"kind": string,"slug": string,"sort_order": number,"status": string,"title": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body_md"?: string,"created_at"?: string,"id"?: string,"kind": string,"slug": string,"sort_order"?: number,"status"?: string,"title": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "body_md"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"slug"?: string,"sort_order"?: number,"status"?: string,"title"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"error_reports": {
                  Row: {
                    "created_at": string,"digest": string | null,"id": string,"message": string,"route": string | null,"status": string,"user_agent": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"digest"?: string | null,"id"?: string,"message": string,"route"?: string | null,"status"?: string,"user_agent"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"digest"?: string | null,"id"?: string,"message"?: string,"route"?: string | null,"status"?: string,"user_agent"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"exercise_logs": {
                  Row: {
                    "activity_code": string,"activity_name": string,"created_at": string,"duration_min": number,"energy_kcal": number,"energy_source": string,"id": string,"intensity": string | null,"local_date": string,"met": number | null,"note": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_code": string,"activity_name": string,"created_at"?: string,"duration_min": number,"energy_kcal": number,"energy_source"?: string,"id"?: string,"intensity"?: string | null,"local_date": string,"met"?: number | null,"note"?: string | null,"user_id": string
                  }
                  Update: {
                    "activity_code"?: string,"activity_name"?: string,"created_at"?: string,"duration_min"?: number,"energy_kcal"?: number,"energy_source"?: string,"id"?: string,"intensity"?: string | null,"local_date"?: string,"met"?: number | null,"note"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"fasting_sessions": {
                  Row: {
                    "created_at": string,"ended_at": string | null,"id": string,"note": string | null,"protocol": string,"started_at": string,"status": Database["public"]['Enums']["fasting_status"],"target_hours": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ended_at"?: string | null,"id"?: string,"note"?: string | null,"protocol": string,"started_at"?: string,"status"?: Database["public"]['Enums']["fasting_status"],"target_hours": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"ended_at"?: string | null,"id"?: string,"note"?: string | null,"protocol"?: string,"started_at"?: string,"status"?: Database["public"]['Enums']["fasting_status"],"target_hours"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"food_nutrients": {
                  Row: {
                    "amount_per_100g": number,"food_id": string,"nutrient_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_per_100g": number,"food_id": string,"nutrient_id": number
                  }
                  Update: {
                    "amount_per_100g"?: number,"food_id"?: string,"nutrient_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "food_nutrients_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "food_nutrients_nutrient_id_fkey"
      columns: ["nutrient_id"]
isOneToOne: false
      referencedRelation: "nutrient_definitions"
      referencedColumns: ["id"]
    }
                  ]
                },"food_portions": {
                  Row: {
                    "created_at": string,"food_id": string,"gram_weight": number,"id": string,"is_default": boolean,"label": string,"quantity": number,"unit": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"food_id": string,"gram_weight": number,"id"?: string,"is_default"?: boolean,"label": string,"quantity"?: number,"unit": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"food_id"?: string,"gram_weight"?: number,"id"?: string,"is_default"?: boolean,"label"?: string,"quantity"?: number,"unit"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "food_portions_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    }
                  ]
                },"foods": {
                  Row: {
                    "barcode": string | null,"brand_id": string | null,"carbs_g": number,"country_codes": (string)[],"created_at": string,"created_by": string | null,"density_g_per_ml": number | null,"description": string | null,"energy_kcal": number,"fat_g": number,"fiber_g": number | null,"food_type": string,"id": string,"is_public": boolean,"license": string | null,"name": string,"name_normalized": string,"protein_g": number,"saturated_fat_g": number | null,"search": unknown,"sodium_mg": number | null,"source": Database["public"]['Enums']["food_source"],"source_ref": string | null,"source_url": string | null,"sugar_g": number | null,"updated_at": string,"verification_status": Database["public"]['Enums']["verification_status"],"verified_at": string | null,"verified_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "barcode"?: string | null,"brand_id"?: string | null,"carbs_g": number,"country_codes"?: (string)[],"created_at"?: string,"created_by"?: string | null,"density_g_per_ml"?: number | null,"description"?: string | null,"energy_kcal": number,"fat_g": number,"fiber_g"?: number | null,"food_type"?: string,"id"?: string,"is_public"?: boolean,"license"?: string | null,"name": string,"name_normalized"?: string,"protein_g": number,"saturated_fat_g"?: number | null,"search"?: unknown,"sodium_mg"?: number | null,"source": Database["public"]['Enums']["food_source"],"source_ref"?: string | null,"source_url"?: string | null,"sugar_g"?: number | null,"updated_at"?: string,"verification_status"?: Database["public"]['Enums']["verification_status"],"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Update: {
                    "barcode"?: string | null,"brand_id"?: string | null,"carbs_g"?: number,"country_codes"?: (string)[],"created_at"?: string,"created_by"?: string | null,"density_g_per_ml"?: number | null,"description"?: string | null,"energy_kcal"?: number,"fat_g"?: number,"fiber_g"?: number | null,"food_type"?: string,"id"?: string,"is_public"?: boolean,"license"?: string | null,"name"?: string,"name_normalized"?: string,"protein_g"?: number,"saturated_fat_g"?: number | null,"search"?: unknown,"sodium_mg"?: number | null,"source"?: Database["public"]['Enums']["food_source"],"source_ref"?: string | null,"source_url"?: string | null,"sugar_g"?: number | null,"updated_at"?: string,"verification_status"?: Database["public"]['Enums']["verification_status"],"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "foods_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    }
                  ]
                },"meal_log_items": {
                  Row: {
                    "ai_request_id": string | null,"brand_name": string | null,"carbs_g": number,"confidence": number | null,"created_at": string,"data_provenance": string | null,"energy_kcal": number,"fat_g": number,"fiber_g": number | null,"food_id": string | null,"grams": number | null,"id": string,"is_estimate": boolean,"meal_log_id": string,"micronutrients": NonNullable<Json>,"name": string,"protein_g": number,"quantity": number,"recipe_id": string | null,"sodium_mg": number | null,"source": Database["public"]['Enums']["log_source"],"sugar_g": number | null,"unit": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_request_id"?: string | null,"brand_name"?: string | null,"carbs_g": number,"confidence"?: number | null,"created_at"?: string,"data_provenance"?: string | null,"energy_kcal": number,"fat_g": number,"fiber_g"?: number | null,"food_id"?: string | null,"grams"?: number | null,"id"?: string,"is_estimate"?: boolean,"meal_log_id": string,"micronutrients"?: NonNullable<Json>,"name": string,"protein_g": number,"quantity": number,"recipe_id"?: string | null,"sodium_mg"?: number | null,"source"?: Database["public"]['Enums']["log_source"],"sugar_g"?: number | null,"unit": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "ai_request_id"?: string | null,"brand_name"?: string | null,"carbs_g"?: number,"confidence"?: number | null,"created_at"?: string,"data_provenance"?: string | null,"energy_kcal"?: number,"fat_g"?: number,"fiber_g"?: number | null,"food_id"?: string | null,"grams"?: number | null,"id"?: string,"is_estimate"?: boolean,"meal_log_id"?: string,"micronutrients"?: NonNullable<Json>,"name"?: string,"protein_g"?: number,"quantity"?: number,"recipe_id"?: string | null,"sodium_mg"?: number | null,"source"?: Database["public"]['Enums']["log_source"],"sugar_g"?: number | null,"unit"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_log_items_ai_request_id_fkey"
      columns: ["ai_request_id"]
isOneToOne: false
      referencedRelation: "ai_analysis_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_log_items_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_log_items_meal_log_id_fkey"
      columns: ["meal_log_id"]
isOneToOne: false
      referencedRelation: "meal_logs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_log_items_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "meal_log_items_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"meal_logs": {
                  Row: {
                    "created_at": string,"custom_name": string | null,"id": string,"local_date": string,"meal_type": Database["public"]['Enums']["meal_type"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"custom_name"?: string | null,"id"?: string,"local_date": string,"meal_type": Database["public"]['Enums']["meal_type"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"custom_name"?: string | null,"id"?: string,"local_date"?: string,"meal_type"?: Database["public"]['Enums']["meal_type"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"meal_plan_items": {
                  Row: {
                    "carbs_g": number,"created_at": string,"day_index": number,"energy_kcal": number,"fat_g": number,"food_id": string | null,"grams": number | null,"id": string,"meal_type": Database["public"]['Enums']["meal_type"],"plan_id": string,"position": number,"protein_g": number,"recipe_id": string | null,"servings": number | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "carbs_g"?: number,"created_at"?: string,"day_index": number,"energy_kcal"?: number,"fat_g"?: number,"food_id"?: string | null,"grams"?: number | null,"id"?: string,"meal_type": Database["public"]['Enums']["meal_type"],"plan_id": string,"position"?: number,"protein_g"?: number,"recipe_id"?: string | null,"servings"?: number | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "carbs_g"?: number,"created_at"?: string,"day_index"?: number,"energy_kcal"?: number,"fat_g"?: number,"food_id"?: string | null,"grams"?: number | null,"id"?: string,"meal_type"?: Database["public"]['Enums']["meal_type"],"plan_id"?: string,"position"?: number,"protein_g"?: number,"recipe_id"?: string | null,"servings"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_plan_items_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_plan_items_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "meal_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_plan_items_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "meal_plan_items_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"meal_plans": {
                  Row: {
                    "created_at": string,"days": number,"generator": string,"id": string,"name": string,"params": NonNullable<Json>,"share_token": string | null,"shared_at": string | null,"start_date": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"days": number,"generator"?: string,"id"?: string,"name": string,"params"?: NonNullable<Json>,"share_token"?: string | null,"shared_at"?: string | null,"start_date": string,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"days"?: number,"generator"?: string,"id"?: string,"name"?: string,"params"?: NonNullable<Json>,"share_token"?: string | null,"shared_at"?: string | null,"start_date"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"meal_template_items": {
                  Row: {
                    "created_at": string,"food_id": string | null,"grams": number | null,"id": string,"position": number,"recipe_id": string | null,"servings": number | null,"template_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"food_id"?: string | null,"grams"?: number | null,"id"?: string,"position"?: number,"recipe_id"?: string | null,"servings"?: number | null,"template_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"food_id"?: string | null,"grams"?: number | null,"id"?: string,"position"?: number,"recipe_id"?: string | null,"servings"?: number | null,"template_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_template_items_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_template_items_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "meal_template_items_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meal_template_items_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "meal_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"meal_templates": {
                  Row: {
                    "created_at": string,"id": string,"meal_type": Database["public"]['Enums']["meal_type"],"name": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"meal_type": Database["public"]['Enums']["meal_type"],"name": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"meal_type"?: Database["public"]['Enums']["meal_type"],"name"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"read_at": string | null,"scheduled_for": string | null,"sent_at": string | null,"title": string,"type": string,"url": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"read_at"?: string | null,"scheduled_for"?: string | null,"sent_at"?: string | null,"title": string,"type": string,"url"?: string | null,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"read_at"?: string | null,"scheduled_for"?: string | null,"sent_at"?: string | null,"title"?: string,"type"?: string,"url"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"nutrient_definitions": {
                  Row: {
                    "code": string,"created_at": string,"id": number,"name_es": string,"unit": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: number,"name_es": string,"unit": string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: number,"name_es"?: string,"unit"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"nutrition_targets": {
                  Row: {
                    "carbs_g": number,"created_at": string,"created_by": string | null,"effective_from": string,"energy_kcal": number,"fat_g": number,"fiber_g": number | null,"id": string,"inputs": NonNullable<Json>,"method": string,"notes": string | null,"protein_g": number,"source": string,"user_id": string,"water_ml": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "carbs_g": number,"created_at"?: string,"created_by"?: string | null,"effective_from"?: string,"energy_kcal": number,"fat_g": number,"fiber_g"?: number | null,"id"?: string,"inputs"?: NonNullable<Json>,"method"?: string,"notes"?: string | null,"protein_g": number,"source"?: string,"user_id": string,"water_ml"?: number | null
                  }
                  Update: {
                    "carbs_g"?: number,"created_at"?: string,"created_by"?: string | null,"effective_from"?: string,"energy_kcal"?: number,"fat_g"?: number,"fiber_g"?: number | null,"id"?: string,"inputs"?: NonNullable<Json>,"method"?: string,"notes"?: string | null,"protein_g"?: number,"source"?: string,"user_id"?: string,"water_ml"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"payments": {
                  Row: {
                    "amount_cents": number,"created_at": string,"currency_code": string,"id": string,"paid_at": string | null,"provider": Database["public"]['Enums']["billing_provider"],"provider_payment_id": string,"status": string,"subscription_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"currency_code": string,"id"?: string,"paid_at"?: string | null,"provider": Database["public"]['Enums']["billing_provider"],"provider_payment_id": string,"status": string,"subscription_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"currency_code"?: string,"id"?: string,"paid_at"?: string | null,"provider"?: Database["public"]['Enums']["billing_provider"],"provider_payment_id"?: string,"status"?: string,"subscription_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_prices": {
                  Row: {
                    "amount_cents": number,"created_at": string,"currency_code": string,"id": string,"interval": Database["public"]['Enums']["billing_interval"],"is_active": boolean,"mercadopago_plan_id": string | null,"plan_id": string,"stripe_price_id": string | null,"trial_days": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"currency_code": string,"id"?: string,"interval": Database["public"]['Enums']["billing_interval"],"is_active"?: boolean,"mercadopago_plan_id"?: string | null,"plan_id": string,"stripe_price_id"?: string | null,"trial_days"?: number,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"currency_code"?: string,"id"?: string,"interval"?: Database["public"]['Enums']["billing_interval"],"is_active"?: boolean,"mercadopago_plan_id"?: string | null,"plan_id"?: string,"stripe_price_id"?: string | null,"trial_days"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_prices_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "ai_monthly_limits": NonNullable<Json>,"created_at": string,"description": string | null,"features": (string)[],"id": string,"is_active": boolean,"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_monthly_limits"?: NonNullable<Json>,"created_at"?: string,"description"?: string | null,"features"?: (string)[],"id": string,"is_active"?: boolean,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "ai_monthly_limits"?: NonNullable<Json>,"created_at"?: string,"description"?: string | null,"features"?: (string)[],"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"professional_access": {
                  Row: {
                    "granted_at": string,"id": string,"professional_id": string,"revoked_at": string | null,"scope": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"id"?: string,"professional_id": string,"revoked_at"?: string | null,"scope"?: string,"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"id"?: string,"professional_id"?: string,"revoked_at"?: string | null,"scope"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"birth_date": string | null,"count_exercise_calories": boolean,"country_code": string,"created_at": string,"currency_code": string,"display_name": string | null,"height_cm": number | null,"id": string,"locale": string,"notification_prefs": NonNullable<Json>,"onboarding_completed_at": string | null,"sex": Database["public"]['Enums']["sex_for_calc"] | null,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"birth_date"?: string | null,"count_exercise_calories"?: boolean,"country_code"?: string,"created_at"?: string,"currency_code"?: string,"display_name"?: string | null,"height_cm"?: number | null,"id": string,"locale"?: string,"notification_prefs"?: NonNullable<Json>,"onboarding_completed_at"?: string | null,"sex"?: Database["public"]['Enums']["sex_for_calc"] | null,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"birth_date"?: string | null,"count_exercise_calories"?: boolean,"country_code"?: string,"created_at"?: string,"currency_code"?: string,"display_name"?: string | null,"height_cm"?: number | null,"id"?: string,"locale"?: string,"notification_prefs"?: NonNullable<Json>,"onboarding_completed_at"?: string | null,"sex"?: Database["public"]['Enums']["sex_for_calc"] | null,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"progress_photos": {
                  Row: {
                    "created_at": string,"id": string,"local_date": string,"note": string | null,"pose": Database["public"]['Enums']["photo_pose"],"storage_path": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"local_date": string,"note"?: string | null,"pose"?: Database["public"]['Enums']["photo_pose"],"storage_path": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"local_date"?: string,"note"?: string | null,"pose"?: Database["public"]['Enums']["photo_pose"],"storage_path"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"p256dh": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"p256dh": string,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"p256dh"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recipe_ingredients": {
                  Row: {
                    "created_at": string,"display_quantity": number | null,"display_unit": string | null,"food_id": string,"grams": number,"id": string,"note": string | null,"position": number,"recipe_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_quantity"?: number | null,"display_unit"?: string | null,"food_id": string,"grams": number,"id"?: string,"note"?: string | null,"position"?: number,"recipe_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_quantity"?: number | null,"display_unit"?: string | null,"food_id"?: string,"grams"?: number,"id"?: string,"note"?: string | null,"position"?: number,"recipe_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_ingredients_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_ingredients_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "recipe_ingredients_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipes": {
                  Row: {
                    "allergens": (string)[],"cook_minutes": number | null,"cost_currency": string | null,"country_code": string | null,"created_at": string,"description": string | null,"diet_tags": (string)[],"difficulty": string | null,"estimated_cost": number | null,"id": string,"image_path": string | null,"is_public": boolean,"meal_types": (Database["public"]['Enums']["meal_type"])[],"owner_id": string | null,"prep_minutes": number | null,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"servings": number,"slug": string,"status": Database["public"]['Enums']["recipe_status"],"steps": NonNullable<Json>,"tags": (string)[],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allergens"?: (string)[],"cook_minutes"?: number | null,"cost_currency"?: string | null,"country_code"?: string | null,"created_at"?: string,"description"?: string | null,"diet_tags"?: (string)[],"difficulty"?: string | null,"estimated_cost"?: number | null,"id"?: string,"image_path"?: string | null,"is_public"?: boolean,"meal_types"?: (Database["public"]['Enums']["meal_type"])[],"owner_id"?: string | null,"prep_minutes"?: number | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"servings"?: number,"slug": string,"status"?: Database["public"]['Enums']["recipe_status"],"steps"?: NonNullable<Json>,"tags"?: (string)[],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "allergens"?: (string)[],"cook_minutes"?: number | null,"cost_currency"?: string | null,"country_code"?: string | null,"created_at"?: string,"description"?: string | null,"diet_tags"?: (string)[],"difficulty"?: string | null,"estimated_cost"?: number | null,"id"?: string,"image_path"?: string | null,"is_public"?: boolean,"meal_types"?: (Database["public"]['Enums']["meal_type"])[],"owner_id"?: string | null,"prep_minutes"?: number | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"servings"?: number,"slug"?: string,"status"?: Database["public"]['Enums']["recipe_status"],"steps"?: NonNullable<Json>,"tags"?: (string)[],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reference_prices": {
                  Row: {
                    "country_code": string,"created_at": string,"created_by": string | null,"currency_code": string,"food_id": string | null,"id": string,"item_name": string,"observed_on": string,"per_quantity": number,"per_unit": string,"price": number,"source": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "country_code"?: string,"created_at"?: string,"created_by"?: string | null,"currency_code"?: string,"food_id"?: string | null,"id"?: string,"item_name": string,"observed_on": string,"per_quantity"?: number,"per_unit": string,"price": number,"source": string,"updated_at"?: string
                  }
                  Update: {
                    "country_code"?: string,"created_at"?: string,"created_by"?: string | null,"currency_code"?: string,"food_id"?: string | null,"id"?: string,"item_name"?: string,"observed_on"?: string,"per_quantity"?: number,"per_unit"?: string,"price"?: number,"source"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reference_prices_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    }
                  ]
                },"shopping_list_items": {
                  Row: {
                    "category": string | null,"checked": boolean,"created_at": string,"estimated_price": number | null,"food_id": string | null,"id": string,"list_id": string,"name": string,"position": number,"price_source": string | null,"quantity": number | null,"unit": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string | null,"checked"?: boolean,"created_at"?: string,"estimated_price"?: number | null,"food_id"?: string | null,"id"?: string,"list_id": string,"name": string,"position"?: number,"price_source"?: string | null,"quantity"?: number | null,"unit"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "category"?: string | null,"checked"?: boolean,"created_at"?: string,"estimated_price"?: number | null,"food_id"?: string | null,"id"?: string,"list_id"?: string,"name"?: string,"position"?: number,"price_source"?: string | null,"quantity"?: number | null,"unit"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_list_items_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shopping_list_items_list_id_fkey"
      columns: ["list_id"]
isOneToOne: false
      referencedRelation: "shopping_lists"
      referencedColumns: ["id"]
    }
                  ]
                },"shopping_lists": {
                  Row: {
                    "budget": number | null,"created_at": string,"currency_code": string,"id": string,"meal_plan_id": string | null,"name": string,"share_token": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "budget"?: number | null,"created_at"?: string,"currency_code"?: string,"id"?: string,"meal_plan_id"?: string | null,"name": string,"share_token"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "budget"?: number | null,"created_at"?: string,"currency_code"?: string,"id"?: string,"meal_plan_id"?: string | null,"name"?: string,"share_token"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_lists_meal_plan_id_fkey"
      columns: ["meal_plan_id"]
isOneToOne: false
      referencedRelation: "meal_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "cancel_at_period_end": boolean,"canceled_at": string | null,"created_at": string,"current_period_end": string | null,"current_period_start": string | null,"id": string,"plan_id": string,"price_id": string | null,"provider": Database["public"]['Enums']["billing_provider"],"provider_customer_id": string | null,"provider_subscription_id": string | null,"status": Database["public"]['Enums']["subscription_status"],"trial_end": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_at_period_end"?: boolean,"canceled_at"?: string | null,"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"id"?: string,"plan_id": string,"price_id"?: string | null,"provider": Database["public"]['Enums']["billing_provider"],"provider_customer_id"?: string | null,"provider_subscription_id"?: string | null,"status": Database["public"]['Enums']["subscription_status"],"trial_end"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "cancel_at_period_end"?: boolean,"canceled_at"?: string | null,"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"id"?: string,"plan_id"?: string,"price_id"?: string | null,"provider"?: Database["public"]['Enums']["billing_provider"],"provider_customer_id"?: string | null,"provider_subscription_id"?: string | null,"status"?: Database["public"]['Enums']["subscription_status"],"trial_end"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_price_id_fkey"
      columns: ["price_id"]
isOneToOne: false
      referencedRelation: "plan_prices"
      referencedColumns: ["id"]
    }
                  ]
                },"user_badges": {
                  Row: {
                    "badge_id": string,"earned_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "badge_id": string,"earned_at"?: string,"user_id": string
                  }
                  Update: {
                    "badge_id"?: string,"earned_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_badges_badge_id_fkey"
      columns: ["badge_id"]
isOneToOne: false
      referencedRelation: "badges"
      referencedColumns: ["id"]
    }
                  ]
                },"user_challenges": {
                  Row: {
                    "challenge_id": string,"completed_at": string | null,"created_at": string,"id": string,"progress": NonNullable<Json>,"started_on": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_id": string,"completed_at"?: string | null,"created_at"?: string,"id"?: string,"progress"?: NonNullable<Json>,"started_on"?: string,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "challenge_id"?: string,"completed_at"?: string | null,"created_at"?: string,"id"?: string,"progress"?: NonNullable<Json>,"started_on"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_challenges_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "challenges"
      referencedColumns: ["id"]
    }
                  ]
                },"user_favorites": {
                  Row: {
                    "created_at": string,"food_id": string | null,"id": string,"recipe_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"food_id"?: string | null,"id"?: string,"recipe_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"food_id"?: string | null,"id"?: string,"recipe_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_favorites_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_favorites_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipe_nutrition"
      referencedColumns: ["recipe_id"]
    },{
      foreignKeyName: "user_favorites_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"user_goals": {
                  Row: {
                    "activity_level": Database["public"]['Enums']["activity_level"],"allergies": (string)[],"budget_currency": string | null,"created_at": string,"current_weight_kg": number | null,"diet_pattern": string | null,"disliked_foods": (string)[],"goal_type": Database["public"]['Enums']["goal_type"],"health_flags": (string)[],"id": string,"intolerances": (string)[],"is_active": boolean,"meals_per_day": number | null,"nutrition_experience": string | null,"requires_professional_review": boolean,"restrictions": (string)[],"target_weight_kg": number | null,"training_days_per_week": number | null,"user_id": string,"weekly_budget": number | null,"weekly_rate_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_level"?: Database["public"]['Enums']["activity_level"],"allergies"?: (string)[],"budget_currency"?: string | null,"created_at"?: string,"current_weight_kg"?: number | null,"diet_pattern"?: string | null,"disliked_foods"?: (string)[],"goal_type": Database["public"]['Enums']["goal_type"],"health_flags"?: (string)[],"id"?: string,"intolerances"?: (string)[],"is_active"?: boolean,"meals_per_day"?: number | null,"nutrition_experience"?: string | null,"requires_professional_review"?: boolean,"restrictions"?: (string)[],"target_weight_kg"?: number | null,"training_days_per_week"?: number | null,"user_id": string,"weekly_budget"?: number | null,"weekly_rate_kg"?: number | null
                  }
                  Update: {
                    "activity_level"?: Database["public"]['Enums']["activity_level"],"allergies"?: (string)[],"budget_currency"?: string | null,"created_at"?: string,"current_weight_kg"?: number | null,"diet_pattern"?: string | null,"disliked_foods"?: (string)[],"goal_type"?: Database["public"]['Enums']["goal_type"],"health_flags"?: (string)[],"id"?: string,"intolerances"?: (string)[],"is_active"?: boolean,"meals_per_day"?: number | null,"nutrition_experience"?: string | null,"requires_professional_review"?: boolean,"restrictions"?: (string)[],"target_weight_kg"?: number | null,"training_days_per_week"?: number | null,"user_id"?: string,"weekly_budget"?: number | null,"weekly_rate_kg"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"user_roles": {
                  Row: {
                    "granted_at": string,"granted_by": string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"granted_by"?: string | null,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"granted_by"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"water_logs": {
                  Row: {
                    "amount_ml": number,"id": string,"local_date": string,"logged_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_ml": number,"id"?: string,"local_date": string,"logged_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount_ml"?: number,"id"?: string,"local_date"?: string,"logged_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"weight_logs": {
                  Row: {
                    "body_fat_method": string | null,"body_fat_pct": number | null,"created_at": string,"id": string,"local_date": string,"note": string | null,"user_id": string,"weight_kg": number
                  }
                  ComputedFields: never
                  Insert: {
                    "body_fat_method"?: string | null,"body_fat_pct"?: number | null,"created_at"?: string,"id"?: string,"local_date": string,"note"?: string | null,"user_id": string,"weight_kg": number
                  }
                  Update: {
                    "body_fat_method"?: string | null,"body_fat_pct"?: number | null,"created_at"?: string,"id"?: string,"local_date"?: string,"note"?: string | null,"user_id"?: string,"weight_kg"?: number
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "daily_nutrition_totals": {
                  Row: {
                    "carbs_g": number | null,"energy_kcal": number | null,"fat_g": number | null,"fiber_g": number | null,"items_count": number | null,"local_date": string | null,"protein_g": number | null,"sodium_mg": number | null,"sugar_g": number | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"recipe_nutrition": {
                  Row: {
                    "fiber_incomplete": boolean | null,"ingredients_count": number | null,"per_serving_carbs_g": number | null,"per_serving_energy_kcal": number | null,"per_serving_fat_g": number | null,"per_serving_fiber_g": number | null,"per_serving_grams": number | null,"per_serving_protein_g": number | null,"recipe_id": string | null,"servings": number | null,"total_carbs_g": number | null,"total_energy_kcal": number | null,"total_fat_g": number | null,"total_fiber_g": number | null,"total_grams": number | null,"total_protein_g": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "admin_ai_usage":
{ Args: { "months"?: number }; Returns: Json
                           },
"admin_merge_foods":
{ Args: { "drop_id": string,"keep_id": string }; Returns: Json
                           },
"admin_metrics":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"check_rate_limit":
{ Args: { "bucket": string,"max_hits": number,"window_seconds": number }; Returns: boolean
                           },
"complete_ai_request":
{ Args: { "error_code"?: string,"estimated_cost_usd"?: number,"input_storage_path"?: string,"latency_ms"?: number,"model"?: string,"output"?: Json,"provider"?: string,"request_id": string,"status": Database["public"]['Enums']["ai_request_status"],"tokens_input"?: number,"tokens_output"?: number }; Returns: boolean
                           },
"consume_ai_quota":
{ Args: { "kind": Database["public"]['Enums']["ai_request_kind"] }; Returns: Json
                           },
"get_shared_plan":
{ Args: { "token": string }; Returns: Json
                           },
"has_professional_access":
{ Args: { "require_write"?: boolean,"target_user": string }; Returns: boolean
                           },
"has_role":
{ Args: { "role": Database["public"]['Enums']["app_role"] }; Returns: boolean
                           },
"is_premium":
{ Args: { "uid"?: string }; Returns: boolean
                           },
"log_admin_action":
{ Args: { "action": string,"metadata"?: Json,"target_id"?: string,"target_table"?: string }; Returns: undefined
                           },
"normalize_text":
{ Args: { "value": string }; Returns: string
                           },
"register_push_subscription":
{ Args: { "sub_auth": string,"sub_endpoint": string,"sub_p256dh": string }; Returns: string
                           },
"request_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"search_foods":
{ Args: { "max_results"?: number,"query": string }; Returns: {
              "barcode": string | null,
"brand_id": string | null,
"carbs_g": number,
"country_codes": (string)[],
"created_at": string,
"created_by": string | null,
"density_g_per_ml": number | null,
"description": string | null,
"energy_kcal": number,
"fat_g": number,
"fiber_g": number | null,
"food_type": string,
"id": string,
"is_public": boolean,
"license": string | null,
"name": string,
"name_normalized": string,
"protein_g": number,
"saturated_fat_g": number | null,
"search": unknown,
"sodium_mg": number | null,
"source": Database["public"]['Enums']["food_source"],
"source_ref": string | null,
"source_url": string | null,
"sugar_g": number | null,
"updated_at": string,
"verification_status": Database["public"]['Enums']["verification_status"],
"verified_at": string | null,
"verified_by": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "foods"
        isOneToOne: false
        isSetofReturn: true
      } }
          }
          Enums: {
            "activity_level": "sedentary"|"light"|"moderate"|"active"|"very_active","ai_request_kind": "photo"|"text"|"voice"|"chat"|"plan","ai_request_status": "pending"|"succeeded"|"failed"|"rejected_quota"|"not_configured","app_role": "superadmin"|"admin"|"editor"|"professional","billing_interval": "month"|"year","billing_provider": "stripe"|"mercadopago","consent_type": "terms"|"privacy"|"health_data"|"ai_processing"|"progress_photos"|"marketing","fasting_status": "active"|"completed"|"cancelled","food_source": "usda"|"open_food_facts"|"curated"|"user"|"admin","goal_type": "lose_fat"|"gain_muscle"|"maintain"|"recomposition"|"improve_habits","log_source": "manual"|"search"|"barcode"|"photo_ai"|"voice_ai"|"text_ai"|"recipe"|"plan"|"template"|"copy","meal_type": "breakfast"|"lunch"|"dinner"|"snack"|"custom","photo_pose": "front"|"side"|"back"|"other","recipe_status": "draft"|"pending_review"|"published"|"rejected","sex_for_calc": "male"|"female","subscription_status": "trialing"|"active"|"past_due"|"canceled"|"incomplete"|"paused"|"expired","verification_status": "unverified"|"curated"|"verified"|"rejected"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "activity_level": ["sedentary", "light", "moderate", "active", "very_active"],"ai_request_kind": ["photo", "text", "voice", "chat", "plan"],"ai_request_status": ["pending", "succeeded", "failed", "rejected_quota", "not_configured"],"app_role": ["superadmin", "admin", "editor", "professional"],"billing_interval": ["month", "year"],"billing_provider": ["stripe", "mercadopago"],"consent_type": ["terms", "privacy", "health_data", "ai_processing", "progress_photos", "marketing"],"fasting_status": ["active", "completed", "cancelled"],"food_source": ["usda", "open_food_facts", "curated", "user", "admin"],"goal_type": ["lose_fat", "gain_muscle", "maintain", "recomposition", "improve_habits"],"log_source": ["manual", "search", "barcode", "photo_ai", "voice_ai", "text_ai", "recipe", "plan", "template", "copy"],"meal_type": ["breakfast", "lunch", "dinner", "snack", "custom"],"photo_pose": ["front", "side", "back", "other"],"recipe_status": ["draft", "pending_review", "published", "rejected"],"sex_for_calc": ["male", "female"],"subscription_status": ["trialing", "active", "past_due", "canceled", "incomplete", "paused", "expired"],"verification_status": ["unverified", "curated", "verified", "rejected"]
          }
        }
} as const

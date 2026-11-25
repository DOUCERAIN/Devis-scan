
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "analysis_runs": {
                  Row: {
                    "company_id": string,"cost_usd": number | null,"created_at": string,"error_code": string | null,"error_message": string | null,"finished_at": string | null,"frames_count": number | null,"id": string,"images_count": number | null,"input_tokens": number | null,"model": string | null,"output_tokens": number | null,"provider": string | null,"raw_output": Json | null,"request_id": string,"rooms_done": number | null,"rooms_total": number | null,"simulated": boolean,"stage": string | null,"started_at": string | null,"status": Database["public"]['Enums']["analysis_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"cost_usd"?: number | null,"created_at"?: string,"error_code"?: string | null,"error_message"?: string | null,"finished_at"?: string | null,"frames_count"?: number | null,"id"?: string,"images_count"?: number | null,"input_tokens"?: number | null,"model"?: string | null,"output_tokens"?: number | null,"provider"?: string | null,"raw_output"?: Json | null,"request_id": string,"rooms_done"?: number | null,"rooms_total"?: number | null,"simulated"?: boolean,"stage"?: string | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["analysis_status"],"updated_at"?: string
                  }
                  Update: {
                    "company_id"?: string,"cost_usd"?: number | null,"created_at"?: string,"error_code"?: string | null,"error_message"?: string | null,"finished_at"?: string | null,"frames_count"?: number | null,"id"?: string,"images_count"?: number | null,"input_tokens"?: number | null,"model"?: string | null,"output_tokens"?: number | null,"provider"?: string | null,"raw_output"?: Json | null,"request_id"?: string,"rooms_done"?: number | null,"rooms_total"?: number | null,"simulated"?: boolean,"stage"?: string | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["analysis_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "analysis_runs_request_id_company_id_fkey"
      columns: ["request_id","company_id"]
isOneToOne: false
      referencedRelation: "quote_requests"
      referencedColumns: ["id","company_id"]
    }
                  ]
                },"catalog_sources": {
                  Row: {
                    "author": string | null,"consulted_on": string,"id": string,"imported_data": string | null,"integrated": boolean,"licence": string,"modifications": string | null,"name": string,"terms": string | null,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author"?: string | null,"consulted_on": string,"id": string,"imported_data"?: string | null,"integrated"?: boolean,"licence": string,"modifications"?: string | null,"name": string,"terms"?: string | null,"url"?: string | null
                  }
                  Update: {
                    "author"?: string | null,"consulted_on"?: string,"id"?: string,"imported_data"?: string | null,"integrated"?: boolean,"licence"?: string,"modifications"?: string | null,"name"?: string,"terms"?: string | null,"url"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"companies": {
                  Row: {
                    "address_line1": string | null,"address_line2": string | null,"auto_formal_quotes": boolean,"brand_color": string | null,"city": string | null,"country": string,"created_at": string,"email": string | null,"id": string,"insurance_info": string | null,"is_demo": boolean,"legal_name": string | null,"liability_terms": string | null,"logo_path": string | null,"name": string,"next_request_number": number,"payment_terms": string | null,"phone": string | null,"postal_code": string | null,"quote_terms": string | null,"quote_validity_days": number,"request_reference_prefix": string,"reserves_terms": string | null,"siret": string | null,"slug": string,"updated_at": string,"vat_number": string | null,"video_retention_days": number,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address_line1"?: string | null,"address_line2"?: string | null,"auto_formal_quotes"?: boolean,"brand_color"?: string | null,"city"?: string | null,"country"?: string,"created_at"?: string,"email"?: string | null,"id"?: string,"insurance_info"?: string | null,"is_demo"?: boolean,"legal_name"?: string | null,"liability_terms"?: string | null,"logo_path"?: string | null,"name": string,"next_request_number"?: number,"payment_terms"?: string | null,"phone"?: string | null,"postal_code"?: string | null,"quote_terms"?: string | null,"quote_validity_days"?: number,"request_reference_prefix"?: string,"reserves_terms"?: string | null,"siret"?: string | null,"slug": string,"updated_at"?: string,"vat_number"?: string | null,"video_retention_days"?: number,"website"?: string | null
                  }
                  Update: {
                    "address_line1"?: string | null,"address_line2"?: string | null,"auto_formal_quotes"?: boolean,"brand_color"?: string | null,"city"?: string | null,"country"?: string,"created_at"?: string,"email"?: string | null,"id"?: string,"insurance_info"?: string | null,"is_demo"?: boolean,"legal_name"?: string | null,"liability_terms"?: string | null,"logo_path"?: string | null,"name"?: string,"next_request_number"?: number,"payment_terms"?: string | null,"phone"?: string | null,"postal_code"?: string | null,"quote_terms"?: string | null,"quote_validity_days"?: number,"request_reference_prefix"?: string,"reserves_terms"?: string | null,"siret"?: string | null,"slug"?: string,"updated_at"?: string,"vat_number"?: string | null,"video_retention_days"?: number,"website"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"company_members": {
                  Row: {
                    "company_id": string,"created_at": string,"role": Database["public"]['Enums']["member_role"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_members_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"customer_notifications": {
                  Row: {
                    "body_text": string,"company_id": string,"created_at": string,"error": string | null,"id": string,"kind": string,"provider_message_id": string | null,"request_id": string,"sent_at": string | null,"status": string,"subject": string,"to_email": string | null,"verification_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body_text": string,"company_id": string,"created_at"?: string,"error"?: string | null,"id"?: string,"kind": string,"provider_message_id"?: string | null,"request_id": string,"sent_at"?: string | null,"status"?: string,"subject": string,"to_email"?: string | null,"verification_id"?: string | null
                  }
                  Update: {
                    "body_text"?: string,"company_id"?: string,"created_at"?: string,"error"?: string | null,"id"?: string,"kind"?: string,"provider_message_id"?: string | null,"request_id"?: string,"sent_at"?: string | null,"status"?: string,"subject"?: string,"to_email"?: string | null,"verification_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "customer_notifications_request_id_company_id_fkey"
      columns: ["request_id","company_id"]
isOneToOne: false
      referencedRelation: "quote_requests"
      referencedColumns: ["id","company_id"]
    },{
      foreignKeyName: "customer_notifications_verification_id_fkey"
      columns: ["verification_id"]
isOneToOne: false
      referencedRelation: "inventory_verifications"
      referencedColumns: ["id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "company_id": string,"company_name": string | null,"created_at": string,"customer_type": string,"email": string | null,"first_name": string | null,"full_name": string,"id": string,"last_name": string | null,"marketing_consent": boolean,"marketing_consent_at": string | null,"phone": string | null,"privacy_accepted_at": string | null,"siret": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"company_name"?: string | null,"created_at"?: string,"customer_type"?: string,"email"?: string | null,"first_name"?: string | null,"full_name": string,"id"?: string,"last_name"?: string | null,"marketing_consent"?: boolean,"marketing_consent_at"?: string | null,"phone"?: string | null,"privacy_accepted_at"?: string | null,"siret"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "company_id"?: string,"company_name"?: string | null,"created_at"?: string,"customer_type"?: string,"email"?: string | null,"first_name"?: string | null,"full_name"?: string,"id"?: string,"last_name"?: string | null,"marketing_consent"?: boolean,"marketing_consent_at"?: string | null,"phone"?: string | null,"privacy_accepted_at"?: string | null,"siret"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"dwellings": {
                  Row: {
                    "access_notes": string | null,"address_line": string | null,"carrying_distance_m": number | null,"city": string | null,"company_id": string,"country": string,"created_at": string,"elevator": Database["public"]['Enums']["elevator_type"] | null,"floor": number | null,"housing_type": Database["public"]['Enums']["housing_type"] | null,"id": string,"kind": Database["public"]['Enums']["dwelling_kind"],"latitude": number | null,"longitude": number | null,"parking_notes": string | null,"postal_code": string | null,"request_id": string,"room_count": number | null,"surface_m2": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_notes"?: string | null,"address_line"?: string | null,"carrying_distance_m"?: number | null,"city"?: string | null,"company_id": string,"country"?: string,"created_at"?: string,"elevator"?: Database["public"]['Enums']["elevator_type"] | null,"floor"?: number | null,"housing_type"?: Database["public"]['Enums']["housing_type"] | null,"id"?: string,"kind": Database["public"]['Enums']["dwelling_kind"],"latitude"?: number | null,"longitude"?: number | null,"parking_notes"?: string | null,"postal_code"?: string | null,"request_id": string,"room_count"?: number | null,"surface_m2"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "access_notes"?: string | null,"address_line"?: string | null,"carrying_distance_m"?: number | null,"city"?: string | null,"company_id"?: string,"country"?: string,"created_at"?: string,"elevator"?: Database["public"]['Enums']["elevator_type"] | null,"floor"?: number | null,"housing_type"?: Database["public"]['Enums']["housing_type"] | null,"id"?: string,"kind"?: Database["public"]['Enums']["dwelling_kind"],"latitude"?: number | null,"longitude"?: number | null,"parking_notes"?: string | null,"postal_code"?: string | null,"request_id"?: string,"room_count"?: number | null,"surface_m2"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dwellings_request_id_company_id_fkey"
      columns: ["request_id","company_id"]
isOneToOne: false
      referencedRelation: "quote_requests"
      referencedColumns: ["id","company_id"]
    }
                  ]
                },"furniture_catalog": {
                  Row: {
                    "category": string,"category_label": string,"coco_class": string | null,"dims_cm": Json | null,"dims_reliability": string,"geometric_volume_avg": number | null,"geometric_volume_max": number | null,"geometric_volume_min": number | null,"handling": string,"heavy": boolean,"id": string,"method": string,"moving_volume_avg": number | null,"moving_volume_max": number | null,"moving_volume_min": number | null,"moving_volume_reliability": string,"name": string,"professional_volume": number | null,"sample_size": number,"sources": (string)[],"subcategory": string,"synonyms": (string)[],"updated_on": string,"weight_kg_avg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"category_label": string,"coco_class"?: string | null,"dims_cm"?: Json | null,"dims_reliability": string,"geometric_volume_avg"?: number | null,"geometric_volume_max"?: number | null,"geometric_volume_min"?: number | null,"handling": string,"heavy"?: boolean,"id": string,"method": string,"moving_volume_avg"?: number | null,"moving_volume_max"?: number | null,"moving_volume_min"?: number | null,"moving_volume_reliability": string,"name": string,"professional_volume"?: number | null,"sample_size"?: number,"sources"?: (string)[],"subcategory": string,"synonyms"?: (string)[],"updated_on": string,"weight_kg_avg"?: number | null
                  }
                  Update: {
                    "category"?: string,"category_label"?: string,"coco_class"?: string | null,"dims_cm"?: Json | null,"dims_reliability"?: string,"geometric_volume_avg"?: number | null,"geometric_volume_max"?: number | null,"geometric_volume_min"?: number | null,"handling"?: string,"heavy"?: boolean,"id"?: string,"method"?: string,"moving_volume_avg"?: number | null,"moving_volume_max"?: number | null,"moving_volume_min"?: number | null,"moving_volume_reliability"?: string,"name"?: string,"professional_volume"?: number | null,"sample_size"?: number,"sources"?: (string)[],"subcategory"?: string,"synonyms"?: (string)[],"updated_on"?: string,"weight_kg_avg"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"inventory_item_changes": {
                  Row: {
                    "action": string,"actor": string,"changed_at": string,"changed_by": string | null,"changes": NonNullable<Json>,"company_id": string,"id": number,"item_id": string | null,"request_id": string,"volume_after_m3": number | null,"volume_before_m3": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor"?: string,"changed_at"?: string,"changed_by"?: string | null,"changes"?: NonNullable<Json>,"company_id": string,"id"?: never,"item_id"?: string | null,"request_id": string,"volume_after_m3"?: number | null,"volume_before_m3"?: number | null
                  }
                  Update: {
                    "action"?: string,"actor"?: string,"changed_at"?: string,"changed_by"?: string | null,"changes"?: NonNullable<Json>,"company_id"?: string,"id"?: never,"item_id"?: string | null,"request_id"?: string,"volume_after_m3"?: number | null,"volume_before_m3"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_item_changes_request_id_company_id_fkey"
      columns: ["request_id","company_id"]
isOneToOne: false
      referencedRelation: "quote_requests"
      referencedColumns: ["id","company_id"]
    }
                  ]
                },"inventory_item_frames": {
                  Row: {
                    "bounding_box": Json | null,"company_id": string,"frame_id": string,"item_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bounding_box"?: Json | null,"company_id": string,"frame_id": string,"item_id": string
                  }
                  Update: {
                    "bounding_box"?: Json | null,"company_id"?: string,"frame_id"?: string,"item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_item_frames_frame_id_company_id_fkey"
      columns: ["frame_id","company_id"]
isOneToOne: false
      referencedRelation: "video_frames"
      referencedColumns: ["id","company_id"]
    },{
      foreignKeyName: "inventory_item_frames_item_id_company_id_fkey"
      columns: ["item_id","company_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id","company_id"]
    }
                  ]
                },"inventory_items": {
                  Row: {
                    "ai_label": string | null,"ai_proposal": Json | null,"analysis_run_id": string | null,"catalog_key": string | null,"category": string | null,"company_id": string,"confidence": number | null,"created_at": string,"customer_comment": string | null,"customer_decided_at": string | null,"customer_duplicate_decision": string | null,"duplicate_of_item_id": string | null,"duplicate_reason": string | null,"geometric_volume_m3": number | null,"height_cm": number | null,"human_modified": boolean,"id": string,"is_fragile": boolean,"is_heavy": boolean,"length_cm": number | null,"merged_into_item_id": string | null,"mover_decided_at": string | null,"mover_decided_by": string | null,"mover_duplicate_decision": string | null,"name": string,"needs_disassembly": boolean,"notes": string | null,"possible_duplicate": boolean,"quantity": number,"removed": boolean,"request_id": string,"room_id": string | null,"size_class": string | null,"source": Database["public"]['Enums']["item_source"],"unit_volume_m3": number,"unit_volume_max_m3": number | null,"unit_volume_min_m3": number | null,"updated_at": string,"validated_at": string | null,"validated_by": string | null,"validated_by_human": boolean,"visibility": string | null,"volume_note": string | null,"volume_source": string | null,"width_cm": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_label"?: string | null,"ai_proposal"?: Json | null,"analysis_run_id"?: string | null,"catalog_key"?: string | null,"category"?: string | null,"company_id": string,"confidence"?: number | null,"created_at"?: string,"customer_comment"?: string | null,"customer_decided_at"?: string | null,"customer_duplicate_decision"?: string | null,"duplicate_of_item_id"?: string | null,"duplicate_reason"?: string | null,"geometric_volume_m3"?: number | null,"height_cm"?: number | null,"human_modified"?: boolean,"id"?: string,"is_fragile"?: boolean,"is_heavy"?: boolean,"length_cm"?: number | null,"merged_into_item_id"?: string | null,"mover_decided_at"?: string | null,"mover_decided_by"?: string | null,"mover_duplicate_decision"?: string | null,"name": string,"needs_disassembly"?: boolean,"notes"?: string | null,"possible_duplicate"?: boolean,"quantity"?: number,"removed"?: boolean,"request_id": string,"room_id"?: string | null,"size_class"?: string | null,"source": Database["public"]['Enums']["item_source"],"unit_volume_m3": number,"unit_volume_max_m3"?: number | null,"unit_volume_min_m3"?: number | null,"updated_at"?: string,"validated_at"?: string | null,"validated_by"?: string | null,"validated_by_human"?: boolean,"visibility"?: string | null,"volume_note"?: string | null,"volume_source"?: string | null,"width_cm"?: number | null
                  }
                  Update: {
                    "ai_label"?: string | null,"ai_proposal"?: Json | null,"analysis_run_id"?: string | null,"catalog_key"?: string | null,"category"?: string | null,"company_id"?: string,"confidence"?: number | null,"created_at"?: string,"customer_comment"?: string | null,"customer_decided_at"?: string | null,"customer_duplicate_decision"?: string | null,"duplicate_of_item_id"?: string | null,"duplicate_reason"?: string | null,"geometric_volume_m3"?: number | null,"height_cm"?: number | null,"human_modified"?: boolean,"id"?: string,"is_fragile"?: boolean,"is_heavy"?: boolean,"length_cm"?: number | null,"merged_into_item_id"?: string | null,"mover_decided_at"?: string | null,"mover_decided_by"?: string | null,"mover_duplicate_decision"?: string | null,"name"?: string,"needs_disassembly"?: boolean,"notes"?: string | null,"possible_duplicate"?: boolean,"quantity"?: number,"removed"?: boolean,"request_id"?: string,"room_id"?: string | null,"size_class"?: string | null,"source"?: Database["public"]['Enums']["item_source"],"unit_volume_m3"?: number,"unit_volume_max_m3"?: number | null,"unit_volume_min_m3"?: number | null,"updated_at"?: string,"validated_at"?: string | null,"validated_by"?: string | null,"validated_by_human"?: boolean,"visibility"?: string | null,"volume_note"?: string | null,"volume_source"?: string | null,"width_cm"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_items_analysis_run_id_request_id_fkey"
      columns: ["analysis_run_id","request_id"]
isOneToOne: false
      referencedRelation: "analysis_runs"
      referencedColumns: ["id","request_id"]
    },{
      foreignKeyName: "inventory_items_catalog_fk"
      columns: ["catalog_key"]
isOneToOne: false
      referencedRelation: "furniture_catalog"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_items_duplicate_of_item_id_request_id_fkey"
      columns: ["duplicate_of_item_id","request_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id","request_id"]
    },{
      foreignKeyName: "inventory_items_merged_fk"
      columns: ["merged_into_item_id","request_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id","request_id"]
    },{
      foreignKeyName: "inventory_items_request_id_company_id_fkey"
      columns: ["request_id","company_id"]
isOneToOne: false
      referencedRelation: "quote_requests"
      referencedColumns: ["id","company_id"]
    },{
      foreignKeyName: "inventory_items_room_id_request_id_fkey"
      columns: ["room_id","request_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id","request_id"]
    }
                  ]
                },"inventory_verifications": {
                  Row: {
                    "changes": NonNullable<Json>,"company_id": string,"created_at": string,"id": string,"outcome": string,"quote_after_id": string | null,"quote_before_id": string | null,"reason": string | null,"request_id": string,"total_after_cents": number | null,"total_before_cents": number | null,"verified_by": string | null,"volume_after_m3": number | null,"volume_before_m3": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "changes"?: NonNullable<Json>,"company_id": string,"created_at"?: string,"id"?: string,"outcome": string,"quote_after_id"?: string | null,"quote_before_id"?: string | null,"reason"?: string | null,"request_id": string,"total_after_cents"?: number | null,"total_before_cents"?: number | null,"verified_by"?: string | null,"volume_after_m3"?: number | null,"volume_before_m3"?: number | null
                  }
                  Update: {
                    "changes"?: NonNullable<Json>,"company_id"?: string,"created_at"?: string,"id"?: string,"outcome"?: string,"quote_after_id"?: string | null,"quote_before_id"?: string | null,"reason"?: string | null,"request_id"?: string,"total_after_cents"?: number | null,"total_before_cents"?: number | null,"verified_by"?: string | null,"volume_after_m3"?: number | null,"volume_before_m3"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_verifications_quote_after_id_request_id_fkey"
      columns: ["quote_after_id","request_id"]
isOneToOne: false
      referencedRelation: "quotes"
      referencedColumns: ["id","request_id"]
    },{
      foreignKeyName: "inventory_verifications_quote_before_id_request_id_fkey"
      columns: ["quote_before_id","request_id"]
isOneToOne: false
      referencedRelation: "quotes"
      referencedColumns: ["id","request_id"]
    },{
      foreignKeyName: "inventory_verifications_request_id_company_id_fkey"
      columns: ["request_id","company_id"]
isOneToOne: false
      referencedRelation: "quote_requests"
      referencedColumns: ["id","company_id"]
    }
                  ]
                },"pricing_item_surcharges": {
                  Row: {
                    "company_id": string,"created_at": string,"id": string,"name": string,"surcharge": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"id"?: string,"name": string,"surcharge": number,"updated_at"?: string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"id"?: string,"name"?: string,"surcharge"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pricing_item_surcharges_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"pricing_options": {
                  Row: {
                    "company_id": string,"created_at": string,"description": string | null,"id": string,"is_active": boolean,"name": string,"position": number,"price": number,"pricing_mode": Database["public"]['Enums']["pricing_mode"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"position"?: number,"price": number,"pricing_mode"?: Database["public"]['Enums']["pricing_mode"],"updated_at"?: string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"position"?: number,"price"?: number,"pricing_mode"?: Database["public"]['Enums']["pricing_mode"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pricing_options_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"pricing_settings": {
                  Row: {
                    "carrying_fee_per_10m": number,"company_id": string,"configured_at": string | null,"currency": string,"floor_fee_small_elevator": number,"floor_fee_without_elevator": number,"free_carrying_distance_m": number,"heavy_item_fee": number,"included_distance_km": number,"minimum_price": number,"price_per_extra_km": number,"price_per_m3": number,"travel_fee": number,"trip_type": string | null,"updated_at": string,"vat_rate": number
                  }
                  ComputedFields: never
                  Insert: {
                    "carrying_fee_per_10m"?: number,"company_id": string,"configured_at"?: string | null,"currency"?: string,"floor_fee_small_elevator"?: number,"floor_fee_without_elevator"?: number,"free_carrying_distance_m"?: number,"heavy_item_fee"?: number,"included_distance_km"?: number,"minimum_price"?: number,"price_per_extra_km"?: number,"price_per_m3"?: number,"travel_fee"?: number,"trip_type"?: string | null,"updated_at"?: string,"vat_rate"?: number
                  }
                  Update: {
                    "carrying_fee_per_10m"?: number,"company_id"?: string,"configured_at"?: string | null,"currency"?: string,"floor_fee_small_elevator"?: number,"floor_fee_without_elevator"?: number,"free_carrying_distance_m"?: number,"heavy_item_fee"?: number,"included_distance_km"?: number,"minimum_price"?: number,"price_per_extra_km"?: number,"price_per_m3"?: number,"travel_fee"?: number,"trip_type"?: string | null,"updated_at"?: string,"vat_rate"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pricing_settings_company_id_fkey"
      columns: ["company_id"]
isOneToOne: true
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string | null,"id": string,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string | null,"id": string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string | null,"id"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"quote_requests": {
                  Row: {
                    "access_token_expires_at": string | null,"access_token_hash": string | null,"alternative_moving_date": string | null,"alternative_moving_dates": (string)[],"company_id": string,"created_at": string,"customer_acknowledged_at": string | null,"customer_acknowledgement": string | null,"customer_id": string | null,"customer_notes": string | null,"customer_validated_at": string | null,"distance_km": number | null,"distance_method": string | null,"estimated_volume_m3": number | null,"id": string,"internal_notes": string | null,"inventory_method": string | null,"moving_date": string | null,"moving_date_flexible": boolean,"request_number": number,"selected_options": NonNullable<Json>,"source": Database["public"]['Enums']["request_source"],"status": Database["public"]['Enums']["request_status"],"submitted_at": string | null,"updated_at": string,"verification_status": string,"verified_at": string | null,"verified_by": string | null,"view_token_hash": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "access_token_expires_at"?: string | null,"access_token_hash"?: string | null,"alternative_moving_date"?: string | null,"alternative_moving_dates"?: (string)[],"company_id": string,"created_at"?: string,"customer_acknowledged_at"?: string | null,"customer_acknowledgement"?: string | null,"customer_id"?: string | null,"customer_notes"?: string | null,"customer_validated_at"?: string | null,"distance_km"?: number | null,"distance_method"?: string | null,"estimated_volume_m3"?: number | null,"id"?: string,"internal_notes"?: string | null,"inventory_method"?: string | null,"moving_date"?: string | null,"moving_date_flexible"?: boolean,"request_number": number,"selected_options"?: NonNullable<Json>,"source"?: Database["public"]['Enums']["request_source"],"status"?: Database["public"]['Enums']["request_status"],"submitted_at"?: string | null,"updated_at"?: string,"verification_status"?: string,"verified_at"?: string | null,"verified_by"?: string | null,"view_token_hash"?: string | null
                  }
                  Update: {
                    "access_token_expires_at"?: string | null,"access_token_hash"?: string | null,"alternative_moving_date"?: string | null,"alternative_moving_dates"?: (string)[],"company_id"?: string,"created_at"?: string,"customer_acknowledged_at"?: string | null,"customer_acknowledgement"?: string | null,"customer_id"?: string | null,"customer_notes"?: string | null,"customer_validated_at"?: string | null,"distance_km"?: number | null,"distance_method"?: string | null,"estimated_volume_m3"?: number | null,"id"?: string,"internal_notes"?: string | null,"inventory_method"?: string | null,"moving_date"?: string | null,"moving_date_flexible"?: boolean,"request_number"?: number,"selected_options"?: NonNullable<Json>,"source"?: Database["public"]['Enums']["request_source"],"status"?: Database["public"]['Enums']["request_status"],"submitted_at"?: string | null,"updated_at"?: string,"verification_status"?: string,"verified_at"?: string | null,"verified_by"?: string | null,"view_token_hash"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quote_requests_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quote_requests_customer_id_company_id_fkey"
      columns: ["customer_id","company_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id","company_id"]
    }
                  ]
                },"quotes": {
                  Row: {
                    "accepted_at": string | null,"amends_quote_id": string | null,"assumptions": NonNullable<Json>,"changes_summary": Json | null,"company_id": string,"company_snapshot": Json | null,"created_at": string,"created_by": string | null,"currency": string,"distance_km": number | null,"distance_method": string | null,"id": string,"inventory_snapshot": Json | null,"kind": string,"lines": NonNullable<Json>,"origin": string,"pdf_path": string | null,"pricing_snapshot": Json | null,"refused_at": string | null,"request_id": string,"request_snapshot": Json | null,"review_reasons": NonNullable<Json>,"sent_at": string | null,"status": Database["public"]['Enums']["quote_status"],"supersedes_id": string | null,"total_ht": number | null,"total_ht_cents": number | null,"total_ttc": number | null,"total_ttc_cents": number | null,"updated_at": string,"valid_until": string | null,"vat_amount": number | null,"vat_cents": number | null,"vat_rate": number | null,"version": number,"volume_snapshot": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"amends_quote_id"?: string | null,"assumptions"?: NonNullable<Json>,"changes_summary"?: Json | null,"company_id": string,"company_snapshot"?: Json | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"distance_km"?: number | null,"distance_method"?: string | null,"id"?: string,"inventory_snapshot"?: Json | null,"kind"?: string,"lines"?: NonNullable<Json>,"origin"?: string,"pdf_path"?: string | null,"pricing_snapshot"?: Json | null,"refused_at"?: string | null,"request_id": string,"request_snapshot"?: Json | null,"review_reasons"?: NonNullable<Json>,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["quote_status"],"supersedes_id"?: string | null,"total_ht"?: number | null,"total_ht_cents"?: number | null,"total_ttc"?: number | null,"total_ttc_cents"?: number | null,"updated_at"?: string,"valid_until"?: string | null,"vat_amount"?: number | null,"vat_cents"?: number | null,"vat_rate"?: number | null,"version"?: number,"volume_snapshot"?: Json | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"amends_quote_id"?: string | null,"assumptions"?: NonNullable<Json>,"changes_summary"?: Json | null,"company_id"?: string,"company_snapshot"?: Json | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"distance_km"?: number | null,"distance_method"?: string | null,"id"?: string,"inventory_snapshot"?: Json | null,"kind"?: string,"lines"?: NonNullable<Json>,"origin"?: string,"pdf_path"?: string | null,"pricing_snapshot"?: Json | null,"refused_at"?: string | null,"request_id"?: string,"request_snapshot"?: Json | null,"review_reasons"?: NonNullable<Json>,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["quote_status"],"supersedes_id"?: string | null,"total_ht"?: number | null,"total_ht_cents"?: number | null,"total_ttc"?: number | null,"total_ttc_cents"?: number | null,"updated_at"?: string,"valid_until"?: string | null,"vat_amount"?: number | null,"vat_cents"?: number | null,"vat_rate"?: number | null,"version"?: number,"volume_snapshot"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quotes_amends_fk"
      columns: ["amends_quote_id","request_id"]
isOneToOne: false
      referencedRelation: "quotes"
      referencedColumns: ["id","request_id"]
    },{
      foreignKeyName: "quotes_request_id_company_id_fkey"
      columns: ["request_id","company_id"]
isOneToOne: false
      referencedRelation: "quote_requests"
      referencedColumns: ["id","company_id"]
    },{
      foreignKeyName: "quotes_supersedes_fk"
      columns: ["supersedes_id","request_id"]
isOneToOne: false
      referencedRelation: "quotes"
      referencedColumns: ["id","request_id"]
    }
                  ]
                },"request_events": {
                  Row: {
                    "actor_user_id": string | null,"company_id": string,"created_at": string,"event_type": string,"from_status": Database["public"]['Enums']["request_status"] | null,"id": number,"message": string | null,"request_id": string,"to_status": Database["public"]['Enums']["request_status"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_user_id"?: string | null,"company_id": string,"created_at"?: string,"event_type": string,"from_status"?: Database["public"]['Enums']["request_status"] | null,"id"?: never,"message"?: string | null,"request_id": string,"to_status"?: Database["public"]['Enums']["request_status"] | null
                  }
                  Update: {
                    "actor_user_id"?: string | null,"company_id"?: string,"created_at"?: string,"event_type"?: string,"from_status"?: Database["public"]['Enums']["request_status"] | null,"id"?: never,"message"?: string | null,"request_id"?: string,"to_status"?: Database["public"]['Enums']["request_status"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_events_request_id_company_id_fkey"
      columns: ["request_id","company_id"]
isOneToOne: false
      referencedRelation: "quote_requests"
      referencedColumns: ["id","company_id"]
    }
                  ]
                },"room_videos": {
                  Row: {
                    "capture_source": string | null,"company_id": string,"created_at": string,"delete_after": string | null,"deleted_at": string | null,"duration_seconds": number | null,"encoder": string | null,"failure_reason": string | null,"height": number | null,"id": string,"mime_type": string | null,"original_duration_seconds": number | null,"original_height": number | null,"original_mime_type": string | null,"original_size_bytes": number | null,"original_width": number | null,"processing": string | null,"request_id": string,"room_id": string,"size_bytes": number | null,"status": Database["public"]['Enums']["video_status"],"storage_path": string,"updated_at": string,"uploaded_at": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "capture_source"?: string | null,"company_id": string,"created_at"?: string,"delete_after"?: string | null,"deleted_at"?: string | null,"duration_seconds"?: number | null,"encoder"?: string | null,"failure_reason"?: string | null,"height"?: number | null,"id"?: string,"mime_type"?: string | null,"original_duration_seconds"?: number | null,"original_height"?: number | null,"original_mime_type"?: string | null,"original_size_bytes"?: number | null,"original_width"?: number | null,"processing"?: string | null,"request_id": string,"room_id": string,"size_bytes"?: number | null,"status"?: Database["public"]['Enums']["video_status"],"storage_path": string,"updated_at"?: string,"uploaded_at"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "capture_source"?: string | null,"company_id"?: string,"created_at"?: string,"delete_after"?: string | null,"deleted_at"?: string | null,"duration_seconds"?: number | null,"encoder"?: string | null,"failure_reason"?: string | null,"height"?: number | null,"id"?: string,"mime_type"?: string | null,"original_duration_seconds"?: number | null,"original_height"?: number | null,"original_mime_type"?: string | null,"original_size_bytes"?: number | null,"original_width"?: number | null,"processing"?: string | null,"request_id"?: string,"room_id"?: string,"size_bytes"?: number | null,"status"?: Database["public"]['Enums']["video_status"],"storage_path"?: string,"updated_at"?: string,"uploaded_at"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "room_videos_request_id_company_id_fkey"
      columns: ["request_id","company_id"]
isOneToOne: false
      referencedRelation: "quote_requests"
      referencedColumns: ["id","company_id"]
    },{
      foreignKeyName: "room_videos_room_id_request_id_fkey"
      columns: ["room_id","request_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id","request_id"]
    }
                  ]
                },"rooms": {
                  Row: {
                    "company_id": string,"created_at": string,"description": string | null,"dwelling_id": string | null,"id": string,"name": string,"position": number,"request_id": string,"room_type": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"description"?: string | null,"dwelling_id"?: string | null,"id"?: string,"name": string,"position"?: number,"request_id": string,"room_type"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"description"?: string | null,"dwelling_id"?: string | null,"id"?: string,"name"?: string,"position"?: number,"request_id"?: string,"room_type"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rooms_dwelling_id_request_id_fkey"
      columns: ["dwelling_id","request_id"]
isOneToOne: false
      referencedRelation: "dwellings"
      referencedColumns: ["id","request_id"]
    },{
      foreignKeyName: "rooms_request_id_company_id_fkey"
      columns: ["request_id","company_id"]
isOneToOne: false
      referencedRelation: "quote_requests"
      referencedColumns: ["id","company_id"]
    }
                  ]
                },"video_frames": {
                  Row: {
                    "captured_at_ms": number | null,"company_id": string,"created_at": string,"height": number | null,"id": string,"request_id": string,"storage_path": string,"video_id": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "captured_at_ms"?: number | null,"company_id": string,"created_at"?: string,"height"?: number | null,"id"?: string,"request_id": string,"storage_path": string,"video_id": string,"width"?: number | null
                  }
                  Update: {
                    "captured_at_ms"?: number | null,"company_id"?: string,"created_at"?: string,"height"?: number | null,"id"?: string,"request_id"?: string,"storage_path"?: string,"video_id"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_frames_request_id_company_id_fkey"
      columns: ["request_id","company_id"]
isOneToOne: false
      referencedRelation: "quote_requests"
      referencedColumns: ["id","company_id"]
    },{
      foreignKeyName: "video_frames_video_id_request_id_fkey"
      columns: ["video_id","request_id"]
isOneToOne: false
      referencedRelation: "room_videos"
      referencedColumns: ["id","request_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_public_frames":
{ Args: { "access_token": string,"frames": Json,"video_id": string }; Returns: number
                           },
"add_public_room":
{ Args: { "access_token": string,"room_description"?: string,"room_kind"?: string,"room_name": string }; Returns: string
                           },
"claim_abandoned_drafts":
{ Args: { "max_items"?: number }; Returns: {
              "file_paths": (string)[],"request_id": string
            }[]
                           },
"claim_videos_for_purge":
{ Args: { "max_items"?: number }; Returns: {
              "frame_paths": (string)[],"storage_path": string,"video_id": string
            }[]
                           },
"create_company":
{ Args: { "company_name": string }; Returns: {
              "address_line1": string | null,
"address_line2": string | null,
"auto_formal_quotes": boolean,
"brand_color": string | null,
"city": string | null,
"country": string,
"created_at": string,
"email": string | null,
"id": string,
"insurance_info": string | null,
"is_demo": boolean,
"legal_name": string | null,
"liability_terms": string | null,
"logo_path": string | null,
"name": string,
"next_request_number": number,
"payment_terms": string | null,
"phone": string | null,
"postal_code": string | null,
"quote_terms": string | null,
"quote_validity_days": number,
"request_reference_prefix": string,
"reserves_terms": string | null,
"siret": string | null,
"slug": string,
"updated_at": string,
"vat_number": string | null,
"video_retention_days": number,
"website": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "companies"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_manual_request":
{ Args: { "payload": Json }; Returns: string
                           },
"create_public_request":
{ Args: { "company_slug": string,"payload": Json }; Returns: {
              "access_token": string,"request_id": string
            }[]
                           },
"delete_abandoned_drafts":
{ Args: { "request_ids": (string)[] }; Returns: number
                           },
"discard_public_video":
{ Args: { "access_token": string,"video_id": string }; Returns: undefined
                           },
"get_public_company":
{ Args: { "company_slug": string }; Returns: {
              "brand_color": string,"email": string,"id": string,"logo_path": string,"name": string,"phone": string,"slug": string,"website": string
            }[]
                           },
"get_public_company_options":
{ Args: { "company_slug": string }; Returns: {
              "description": string,"id": string,"name": string,"price": number,"pricing_mode": Database["public"]['Enums']["pricing_mode"]
            }[]
                           },
"get_public_inventory":
{ Args: { "token": string }; Returns: Json
                           },
"get_public_quote_view":
{ Args: { "token": string }; Returns: Json
                           },
"get_public_request":
{ Args: { "access_token": string }; Returns: Json
                           },
"get_public_selected_options":
{ Args: { "access_token": string }; Returns: Json
                           },
"mark_video_uploaded":
{ Args: { "access_token": string,"actual_size": number,"duration_seconds"?: number,"height"?: number,"video_id": string,"width"?: number }; Returns: undefined
                           },
"mark_videos_purged":
{ Args: { "video_ids": (string)[] }; Returns: number
                           },
"public_inventory_add":
{ Args: { "item": Json,"token": string }; Returns: string
                           },
"public_inventory_remove":
{ Args: { "item_id": string,"token": string }; Returns: undefined
                           },
"public_inventory_update":
{ Args: { "item_id": string,"new_quantity": number,"token": string }; Returns: undefined
                           },
"public_resume_manual":
{ Args: { "token": string }; Returns: string
                           },
"register_public_video":
{ Args: { "access_token": string,"meta"?: Json,"mime_type": string,"room_id": string,"size_bytes": number }; Returns: {
              "storage_path": string,"video_id": string
            }[]
                           },
"remove_public_room":
{ Args: { "access_token": string,"room_id": string }; Returns: undefined
                           },
"respond_public_quote":
{ Args: { "decision": string,"quote_id": string,"token": string }; Returns: string
                           },
"set_public_options":
{ Args: { "access_token": string,"options": Json }; Returns: undefined
                           },
"submit_public_manual_request":
{ Args: { "access_token": string,"acknowledgement": string }; Returns: string
                           },
"submit_public_request":
{ Args: { "access_token": string }; Returns: string
                           },
"update_public_request":
{ Args: { "access_token": string,"payload": Json }; Returns: undefined
                           },
"update_public_room":
{ Args: { "access_token": string,"room_description"?: string,"room_id": string,"room_kind"?: string,"room_name": string }; Returns: undefined
                           },
"validate_public_inventory":
{ Args: { "acknowledgement": string,"decisions": Json,"token": string }; Returns: string
                           }
          }
          Enums: {
            "analysis_status": "queued"|"running"|"succeeded"|"failed","dwelling_kind": "origin"|"destination","elevator_type": "none"|"small"|"standard"|"large","housing_type": "apartment"|"house"|"storage_unit"|"office"|"other","item_source": "ai"|"customer"|"mover","member_role": "owner"|"admin"|"member","pricing_mode": "fixed"|"per_m3"|"per_item","quote_status": "draft"|"sent"|"accepted"|"refused"|"expired"|"cancelled"|"generated"|"corrected"|"superseded","request_source": "customer_link"|"mover_manual","request_status": "draft"|"submitted"|"analyzing"|"awaiting_customer"|"customer_validated"|"to_review"|"quote_sent"|"accepted"|"refused"|"cancelled"|"archived","video_status": "awaiting_upload"|"uploaded"|"processing"|"ready"|"failed"|"deleted"
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
  "public": {
          Enums: {
            "analysis_status": ["queued", "running", "succeeded", "failed"],"dwelling_kind": ["origin", "destination"],"elevator_type": ["none", "small", "standard", "large"],"housing_type": ["apartment", "house", "storage_unit", "office", "other"],"item_source": ["ai", "customer", "mover"],"member_role": ["owner", "admin", "member"],"pricing_mode": ["fixed", "per_m3", "per_item"],"quote_status": ["draft", "sent", "accepted", "refused", "expired", "cancelled", "generated", "corrected", "superseded"],"request_source": ["customer_link", "mover_manual"],"request_status": ["draft", "submitted", "analyzing", "awaiting_customer", "customer_validated", "to_review", "quote_sent", "accepted", "refused", "cancelled", "archived"],"video_status": ["awaiting_upload", "uploaded", "processing", "ready", "failed", "deleted"]
          }
        }
} as const

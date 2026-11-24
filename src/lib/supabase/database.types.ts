
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "analysis_runs": {
                  Row: {
                    "company_id": string,"created_at": string,"error_message": string | null,"finished_at": string | null,"frames_count": number | null,"id": string,"model": string | null,"provider": string | null,"raw_output": Json | null,"request_id": string,"started_at": string | null,"status": Database["public"]['Enums']["analysis_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"error_message"?: string | null,"finished_at"?: string | null,"frames_count"?: number | null,"id"?: string,"model"?: string | null,"provider"?: string | null,"raw_output"?: Json | null,"request_id": string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["analysis_status"],"updated_at"?: string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"error_message"?: string | null,"finished_at"?: string | null,"frames_count"?: number | null,"id"?: string,"model"?: string | null,"provider"?: string | null,"raw_output"?: Json | null,"request_id"?: string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["analysis_status"],"updated_at"?: string
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
                },"companies": {
                  Row: {
                    "address_line1": string | null,"address_line2": string | null,"brand_color": string | null,"city": string | null,"country": string,"created_at": string,"email": string | null,"id": string,"insurance_info": string | null,"is_demo": boolean,"legal_name": string | null,"logo_path": string | null,"name": string,"next_request_number": number,"payment_terms": string | null,"phone": string | null,"postal_code": string | null,"quote_terms": string | null,"quote_validity_days": number,"request_reference_prefix": string,"siret": string | null,"slug": string,"updated_at": string,"vat_number": string | null,"video_retention_days": number,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address_line1"?: string | null,"address_line2"?: string | null,"brand_color"?: string | null,"city"?: string | null,"country"?: string,"created_at"?: string,"email"?: string | null,"id"?: string,"insurance_info"?: string | null,"is_demo"?: boolean,"legal_name"?: string | null,"logo_path"?: string | null,"name": string,"next_request_number"?: number,"payment_terms"?: string | null,"phone"?: string | null,"postal_code"?: string | null,"quote_terms"?: string | null,"quote_validity_days"?: number,"request_reference_prefix"?: string,"siret"?: string | null,"slug": string,"updated_at"?: string,"vat_number"?: string | null,"video_retention_days"?: number,"website"?: string | null
                  }
                  Update: {
                    "address_line1"?: string | null,"address_line2"?: string | null,"brand_color"?: string | null,"city"?: string | null,"country"?: string,"created_at"?: string,"email"?: string | null,"id"?: string,"insurance_info"?: string | null,"is_demo"?: boolean,"legal_name"?: string | null,"logo_path"?: string | null,"name"?: string,"next_request_number"?: number,"payment_terms"?: string | null,"phone"?: string | null,"postal_code"?: string | null,"quote_terms"?: string | null,"quote_validity_days"?: number,"request_reference_prefix"?: string,"siret"?: string | null,"slug"?: string,"updated_at"?: string,"vat_number"?: string | null,"video_retention_days"?: number,"website"?: string | null
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
                },"customers": {
                  Row: {
                    "company_id": string,"created_at": string,"email": string | null,"full_name": string,"id": string,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"email"?: string | null,"full_name": string,"id"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"phone"?: string | null,"updated_at"?: string
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
                    "analysis_run_id": string | null,"catalog_key": string | null,"company_id": string,"confidence": number | null,"created_at": string,"duplicate_of_item_id": string | null,"height_cm": number | null,"id": string,"is_fragile": boolean,"is_heavy": boolean,"length_cm": number | null,"name": string,"needs_disassembly": boolean,"notes": string | null,"possible_duplicate": boolean,"quantity": number,"removed": boolean,"request_id": string,"room_id": string | null,"source": Database["public"]['Enums']["item_source"],"unit_volume_m3": number,"updated_at": string,"validated_at": string | null,"validated_by": string | null,"validated_by_human": boolean,"width_cm": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "analysis_run_id"?: string | null,"catalog_key"?: string | null,"company_id": string,"confidence"?: number | null,"created_at"?: string,"duplicate_of_item_id"?: string | null,"height_cm"?: number | null,"id"?: string,"is_fragile"?: boolean,"is_heavy"?: boolean,"length_cm"?: number | null,"name": string,"needs_disassembly"?: boolean,"notes"?: string | null,"possible_duplicate"?: boolean,"quantity"?: number,"removed"?: boolean,"request_id": string,"room_id"?: string | null,"source": Database["public"]['Enums']["item_source"],"unit_volume_m3": number,"updated_at"?: string,"validated_at"?: string | null,"validated_by"?: string | null,"validated_by_human"?: boolean,"width_cm"?: number | null
                  }
                  Update: {
                    "analysis_run_id"?: string | null,"catalog_key"?: string | null,"company_id"?: string,"confidence"?: number | null,"created_at"?: string,"duplicate_of_item_id"?: string | null,"height_cm"?: number | null,"id"?: string,"is_fragile"?: boolean,"is_heavy"?: boolean,"length_cm"?: number | null,"name"?: string,"needs_disassembly"?: boolean,"notes"?: string | null,"possible_duplicate"?: boolean,"quantity"?: number,"removed"?: boolean,"request_id"?: string,"room_id"?: string | null,"source"?: Database["public"]['Enums']["item_source"],"unit_volume_m3"?: number,"updated_at"?: string,"validated_at"?: string | null,"validated_by"?: string | null,"validated_by_human"?: boolean,"width_cm"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_items_analysis_run_id_request_id_fkey"
      columns: ["analysis_run_id","request_id"]
isOneToOne: false
      referencedRelation: "analysis_runs"
      referencedColumns: ["id","request_id"]
    },{
      foreignKeyName: "inventory_items_duplicate_of_item_id_request_id_fkey"
      columns: ["duplicate_of_item_id","request_id"]
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
                    "carrying_fee_per_10m": number,"company_id": string,"currency": string,"floor_fee_small_elevator": number,"floor_fee_without_elevator": number,"free_carrying_distance_m": number,"heavy_item_fee": number,"included_distance_km": number,"minimum_price": number,"price_per_extra_km": number,"price_per_m3": number,"travel_fee": number,"updated_at": string,"vat_rate": number
                  }
                  ComputedFields: never
                  Insert: {
                    "carrying_fee_per_10m"?: number,"company_id": string,"currency"?: string,"floor_fee_small_elevator"?: number,"floor_fee_without_elevator"?: number,"free_carrying_distance_m"?: number,"heavy_item_fee"?: number,"included_distance_km"?: number,"minimum_price"?: number,"price_per_extra_km"?: number,"price_per_m3"?: number,"travel_fee"?: number,"updated_at"?: string,"vat_rate"?: number
                  }
                  Update: {
                    "carrying_fee_per_10m"?: number,"company_id"?: string,"currency"?: string,"floor_fee_small_elevator"?: number,"floor_fee_without_elevator"?: number,"free_carrying_distance_m"?: number,"heavy_item_fee"?: number,"included_distance_km"?: number,"minimum_price"?: number,"price_per_extra_km"?: number,"price_per_m3"?: number,"travel_fee"?: number,"updated_at"?: string,"vat_rate"?: number
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
                    "access_token_expires_at": string | null,"access_token_hash": string | null,"company_id": string,"created_at": string,"customer_id": string | null,"customer_notes": string | null,"distance_km": number | null,"estimated_volume_m3": number | null,"id": string,"internal_notes": string | null,"moving_date": string | null,"moving_date_flexible": boolean,"request_number": number,"source": Database["public"]['Enums']["request_source"],"status": Database["public"]['Enums']["request_status"],"submitted_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_token_expires_at"?: string | null,"access_token_hash"?: string | null,"company_id": string,"created_at"?: string,"customer_id"?: string | null,"customer_notes"?: string | null,"distance_km"?: number | null,"estimated_volume_m3"?: number | null,"id"?: string,"internal_notes"?: string | null,"moving_date"?: string | null,"moving_date_flexible"?: boolean,"request_number": number,"source"?: Database["public"]['Enums']["request_source"],"status"?: Database["public"]['Enums']["request_status"],"submitted_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "access_token_expires_at"?: string | null,"access_token_hash"?: string | null,"company_id"?: string,"created_at"?: string,"customer_id"?: string | null,"customer_notes"?: string | null,"distance_km"?: number | null,"estimated_volume_m3"?: number | null,"id"?: string,"internal_notes"?: string | null,"moving_date"?: string | null,"moving_date_flexible"?: boolean,"request_number"?: number,"source"?: Database["public"]['Enums']["request_source"],"status"?: Database["public"]['Enums']["request_status"],"submitted_at"?: string | null,"updated_at"?: string
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
                    "accepted_at": string | null,"company_id": string,"created_at": string,"created_by": string | null,"currency": string,"id": string,"lines": NonNullable<Json>,"pdf_path": string | null,"refused_at": string | null,"request_id": string,"sent_at": string | null,"status": Database["public"]['Enums']["quote_status"],"total_ht": number | null,"total_ttc": number | null,"updated_at": string,"valid_until": string | null,"vat_amount": number | null,"vat_rate": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"company_id": string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"lines"?: NonNullable<Json>,"pdf_path"?: string | null,"refused_at"?: string | null,"request_id": string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["quote_status"],"total_ht"?: number | null,"total_ttc"?: number | null,"updated_at"?: string,"valid_until"?: string | null,"vat_amount"?: number | null,"vat_rate"?: number | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"company_id"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"lines"?: NonNullable<Json>,"pdf_path"?: string | null,"refused_at"?: string | null,"request_id"?: string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["quote_status"],"total_ht"?: number | null,"total_ttc"?: number | null,"updated_at"?: string,"valid_until"?: string | null,"vat_amount"?: number | null,"vat_rate"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quotes_request_id_company_id_fkey"
      columns: ["request_id","company_id"]
isOneToOne: false
      referencedRelation: "quote_requests"
      referencedColumns: ["id","company_id"]
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
                    "company_id": string,"created_at": string,"delete_after": string | null,"deleted_at": string | null,"duration_seconds": number | null,"failure_reason": string | null,"height": number | null,"id": string,"mime_type": string | null,"request_id": string,"room_id": string,"size_bytes": number | null,"status": Database["public"]['Enums']["video_status"],"storage_path": string,"updated_at": string,"uploaded_at": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"delete_after"?: string | null,"deleted_at"?: string | null,"duration_seconds"?: number | null,"failure_reason"?: string | null,"height"?: number | null,"id"?: string,"mime_type"?: string | null,"request_id": string,"room_id": string,"size_bytes"?: number | null,"status"?: Database["public"]['Enums']["video_status"],"storage_path": string,"updated_at"?: string,"uploaded_at"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"delete_after"?: string | null,"deleted_at"?: string | null,"duration_seconds"?: number | null,"failure_reason"?: string | null,"height"?: number | null,"id"?: string,"mime_type"?: string | null,"request_id"?: string,"room_id"?: string,"size_bytes"?: number | null,"status"?: Database["public"]['Enums']["video_status"],"storage_path"?: string,"updated_at"?: string,"uploaded_at"?: string | null,"width"?: number | null
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
                    "company_id": string,"created_at": string,"dwelling_id": string | null,"id": string,"name": string,"position": number,"request_id": string,"room_type": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"dwelling_id"?: string | null,"id"?: string,"name": string,"position"?: number,"request_id": string,"room_type"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"dwelling_id"?: string | null,"id"?: string,"name"?: string,"position"?: number,"request_id"?: string,"room_type"?: string | null,"updated_at"?: string
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
            "add_public_room":
{ Args: { "access_token": string,"room_kind"?: string,"room_name": string }; Returns: string
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
"brand_color": string | null,
"city": string | null,
"country": string,
"created_at": string,
"email": string | null,
"id": string,
"insurance_info": string | null,
"is_demo": boolean,
"legal_name": string | null,
"logo_path": string | null,
"name": string,
"next_request_number": number,
"payment_terms": string | null,
"phone": string | null,
"postal_code": string | null,
"quote_terms": string | null,
"quote_validity_days": number,
"request_reference_prefix": string,
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
"get_public_company":
{ Args: { "company_slug": string }; Returns: {
              "brand_color": string,"email": string,"id": string,"logo_path": string,"name": string,"phone": string,"slug": string,"website": string
            }[]
                           },
"get_public_request":
{ Args: { "access_token": string }; Returns: Json
                           },
"mark_video_uploaded":
{ Args: { "access_token": string,"actual_size": number,"duration_seconds"?: number,"video_id": string }; Returns: undefined
                           },
"mark_videos_purged":
{ Args: { "video_ids": (string)[] }; Returns: number
                           },
"register_public_video":
{ Args: { "access_token": string,"mime_type": string,"room_id": string,"size_bytes": number }; Returns: {
              "storage_path": string,"video_id": string
            }[]
                           },
"remove_public_room":
{ Args: { "access_token": string,"room_id": string }; Returns: undefined
                           },
"submit_public_request":
{ Args: { "access_token": string }; Returns: undefined
                           }
          }
          Enums: {
            "analysis_status": "queued"|"running"|"succeeded"|"failed","dwelling_kind": "origin"|"destination","elevator_type": "none"|"small"|"standard"|"large","housing_type": "apartment"|"house"|"storage_unit"|"office"|"other","item_source": "ai"|"customer"|"mover","member_role": "owner"|"admin"|"member","pricing_mode": "fixed"|"per_m3"|"per_item","quote_status": "draft"|"sent"|"accepted"|"refused"|"expired"|"cancelled","request_source": "customer_link"|"mover_manual","request_status": "draft"|"submitted"|"analyzing"|"to_review"|"quote_sent"|"accepted"|"refused"|"cancelled"|"archived","video_status": "awaiting_upload"|"uploaded"|"processing"|"ready"|"failed"|"deleted"
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
            "analysis_status": ["queued", "running", "succeeded", "failed"],"dwelling_kind": ["origin", "destination"],"elevator_type": ["none", "small", "standard", "large"],"housing_type": ["apartment", "house", "storage_unit", "office", "other"],"item_source": ["ai", "customer", "mover"],"member_role": ["owner", "admin", "member"],"pricing_mode": ["fixed", "per_m3", "per_item"],"quote_status": ["draft", "sent", "accepted", "refused", "expired", "cancelled"],"request_source": ["customer_link", "mover_manual"],"request_status": ["draft", "submitted", "analyzing", "to_review", "quote_sent", "accepted", "refused", "cancelled", "archived"],"video_status": ["awaiting_upload", "uploaded", "processing", "ready", "failed", "deleted"]
          }
        }
} as const

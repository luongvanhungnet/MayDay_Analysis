-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "reset_token" TEXT,
    "reset_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "user_id" UUID NOT NULL,
    "year_of_birth" INTEGER,
    "gender" TEXT,
    "occupation" TEXT,
    "ethnicity" TEXT,
    "address" TEXT,
    "province" TEXT,
    "district" TEXT,
    "ward" TEXT,
    "insurance_number" TEXT,
    "insurance_expiry" DATE,
    "emergency_contact" TEXT,
    "emergency_phone" TEXT,
    "outpatient_date" DATE,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "staffs" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "branch_id" UUID,
    "department_id" UUID,
    "room_id" UUID,
    "specialty" TEXT,

    CONSTRAINT "staffs_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "parent_role_id" UUID,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "api_endpoints" (
    "id" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "api_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions_endpoints" (
    "permission_id" UUID NOT NULL,
    "endpoint_id" UUID NOT NULL,

    CONSTRAINT "permissions_endpoints_pkey" PRIMARY KEY ("permission_id","endpoint_id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "department_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_blacklist" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_sections" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "filled_by" TEXT NOT NULL DEFAULT 'both',

    CONSTRAINT "template_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "parent_question_id" UUID,
    "content" TEXT NOT NULL,
    "type_question" TEXT NOT NULL DEFAULT 'text',
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "show_if_answer" JSONB,
    "condition_rules" JSONB,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_records" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "assigned_doctor_id" UUID,
    "created_by" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "diagnosis" TEXT,
    "notes" TEXT,
    "instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" UUID NOT NULL,
    "medical_record_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "value" JSONB NOT NULL,
    "answer_text" TEXT,
    "question_option_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_attachments" (
    "id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_images" (
    "id" UUID NOT NULL,
    "answer_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "option_value" TEXT,

    CONSTRAINT "answer_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesion_episodes" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "patient_id" UUID NOT NULL,
    "medical_record_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "context_tags" JSONB NOT NULL DEFAULT '[]',
    "medications" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesion_episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesion_locations" (
    "id" UUID NOT NULL,
    "episode_id" UUID NOT NULL,
    "body_part" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "lesion_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesion_photos" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "stage" TEXT NOT NULL,
    "itch_score" INTEGER NOT NULL DEFAULT 0,
    "pain_score" INTEGER NOT NULL DEFAULT 0,
    "burning_score" INTEGER NOT NULL DEFAULT 0,
    "hives_count" INTEGER NOT NULL DEFAULT 0,
    "local_auas" DOUBLE PRECISION,
    "ai_result" JSONB,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesion_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uas7_scores" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "score_date" DATE NOT NULL,
    "iss7" INTEGER NOT NULL,
    "hss7" INTEGER NOT NULL,
    "daily_score" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uas7_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" UUID NOT NULL,
    "medical_record_id" UUID NOT NULL,
    "doctor_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" UUID NOT NULL,
    "prescription_id" UUID NOT NULL,
    "medicine_name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "instructions" TEXT,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_requests" (
    "id" UUID NOT NULL,
    "medical_record_id" UUID NOT NULL,
    "doctor_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_request_items" (
    "id" UUID NOT NULL,
    "lab_request_id" UUID NOT NULL,
    "test_name" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "lab_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_results" (
    "id" UUID NOT NULL,
    "lab_request_item_id" UUID NOT NULL,
    "result_value" TEXT NOT NULL,
    "unit" TEXT,
    "reference_range" TEXT,
    "notes" TEXT,
    "media_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'system',
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "delivery_status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_fcm_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "device_id" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'web',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_fcm_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notification_settings" (
    "user_id" UUID NOT NULL,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sound_enabled" BOOLEAN NOT NULL DEFAULT true,
    "uas7_reminder" BOOLEAN NOT NULL DEFAULT true,
    "medication_reminder" BOOLEAN NOT NULL DEFAULT true,
    "lab_results_enabled" BOOLEAN NOT NULL DEFAULT true,
    "prescriptions_enabled" BOOLEAN NOT NULL DEFAULT true,
    "appointment_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminder_time" TEXT NOT NULL DEFAULT '20:00',

    CONSTRAINT "user_notification_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "api_endpoints_method_path_key" ON "api_endpoints"("method", "path");

-- CreateIndex
CREATE UNIQUE INDEX "token_blacklist_token_hash_key" ON "token_blacklist"("token_hash");

-- CreateIndex
CREATE INDEX "token_blacklist_expires_at_idx" ON "token_blacklist"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_question_id_value_key" ON "question_options"("question_id", "value");

-- CreateIndex
CREATE INDEX "medical_records_patient_id_created_at_idx" ON "medical_records"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "medical_records_assigned_doctor_id_status_idx" ON "medical_records"("assigned_doctor_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "answers_medical_record_id_question_id_key" ON "answers"("medical_record_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_attachments_storage_key_key" ON "media_attachments"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "answer_images_answer_id_media_id_key" ON "answer_images"("answer_id", "media_id");

-- CreateIndex
CREATE UNIQUE INDEX "uas7_scores_patient_id_score_date_key" ON "uas7_scores"("patient_id", "score_date");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_fcm_tokens_token_key" ON "user_fcm_tokens"("token");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffs" ADD CONSTRAINT "staffs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffs" ADD CONSTRAINT "staffs_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffs" ADD CONSTRAINT "staffs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffs" ADD CONSTRAINT "staffs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffs" ADD CONSTRAINT "staffs_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_parent_role_id_fkey" FOREIGN KEY ("parent_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions_endpoints" ADD CONSTRAINT "permissions_endpoints_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions_endpoints" ADD CONSTRAINT "permissions_endpoints_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "api_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_blacklist" ADD CONSTRAINT "token_blacklist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_sections" ADD CONSTRAINT "template_sections_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "template_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_parent_question_id_fkey" FOREIGN KEY ("parent_question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_assigned_doctor_id_fkey" FOREIGN KEY ("assigned_doctor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_medical_record_id_fkey" FOREIGN KEY ("medical_record_id") REFERENCES "medical_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_option_id_fkey" FOREIGN KEY ("question_option_id") REFERENCES "question_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_attachments" ADD CONSTRAINT "media_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_images" ADD CONSTRAINT "answer_images_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_images" ADD CONSTRAINT "answer_images_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesion_episodes" ADD CONSTRAINT "lesion_episodes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesion_episodes" ADD CONSTRAINT "lesion_episodes_medical_record_id_fkey" FOREIGN KEY ("medical_record_id") REFERENCES "medical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesion_locations" ADD CONSTRAINT "lesion_locations_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "lesion_episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesion_photos" ADD CONSTRAINT "lesion_photos_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "lesion_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesion_photos" ADD CONSTRAINT "lesion_photos_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uas7_scores" ADD CONSTRAINT "uas7_scores_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_medical_record_id_fkey" FOREIGN KEY ("medical_record_id") REFERENCES "medical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_medical_record_id_fkey" FOREIGN KEY ("medical_record_id") REFERENCES "medical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_request_items" ADD CONSTRAINT "lab_request_items_lab_request_id_fkey" FOREIGN KEY ("lab_request_id") REFERENCES "lab_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_lab_request_item_id_fkey" FOREIGN KEY ("lab_request_item_id") REFERENCES "lab_request_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_fcm_tokens" ADD CONSTRAINT "user_fcm_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notification_settings" ADD CONSTRAINT "user_notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Clinical invariants are also enforced below after all tables are created.

-- Preserve score integrity even when data is written outside the application.
ALTER TABLE "uas7_scores" ADD CONSTRAINT "uas7_scores_valid_scores" CHECK ("iss7" BETWEEN 0 AND 3 AND "hss7" BETWEEN 0 AND 3 AND "daily_score" = "iss7" + "hss7");
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_valid_status" CHECK ("status" IN ('pending', 'in_progress', 'completed', 'cancelled'));
ALTER TABLE "template_sections" ADD CONSTRAINT "template_sections_valid_author" CHECK ("filled_by" IN ('patient', 'doctor', 'both'));
ALTER TABLE "questions" ADD CONSTRAINT "questions_valid_type" CHECK ("type_question" IN ('text', 'number', 'date', 'radio', 'checkbox', 'image_upload'));
ALTER TABLE "lesion_photos" ADD CONSTRAINT "lesion_photos_valid_stage" CHECK ("stage" IN ('start', 'peak', 'normal'));
ALTER TABLE "lesion_photos" ADD CONSTRAINT "lesion_photos_valid_scores" CHECK ("itch_score" BETWEEN 0 AND 10 AND "pain_score" BETWEEN 0 AND 10 AND "burning_score" BETWEEN 0 AND 10 AND "hives_count" >= 0);
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_valid_quantity" CHECK ("quantity" > 0);
ALTER TABLE "media_attachments" ADD CONSTRAINT "media_attachments_valid_size" CHECK ("file_size" > 0);
ALTER TABLE "lesion_episodes" ADD CONSTRAINT "lesion_episodes_valid_dates" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at");


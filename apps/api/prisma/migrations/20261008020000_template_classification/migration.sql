-- Classification decisions are configurable independently of visit forms.
ALTER TABLE "templates" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'clinical';
ALTER TABLE "templates" ADD COLUMN "classification_rules" JSONB;
ALTER TABLE "templates" ADD CONSTRAINT "templates_valid_kind" CHECK ("kind" IN ('clinical', 'classification'));

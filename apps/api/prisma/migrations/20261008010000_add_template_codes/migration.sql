-- Give existing templates stable unique codes without changing their identity.
ALTER TABLE "templates" ADD COLUMN "code_template" TEXT;
UPDATE "templates" SET "code_template" = "id"::TEXT;
ALTER TABLE "templates" ALTER COLUMN "code_template" SET NOT NULL;
CREATE UNIQUE INDEX "templates_code_template_key" ON "templates"("code_template");

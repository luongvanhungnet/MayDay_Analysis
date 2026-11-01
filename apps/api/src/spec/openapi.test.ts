import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { expect, it } from "vitest";
import { SpecController } from "./controller";
import { SpecService } from "./service";
import { endpoints } from "./catalog";
import { NativeController } from "../native/native.controller";
import { NativeService } from "../native/native.service";
import { AiController } from "../ai/ai.controller";
import { input } from "./resources";
import { requestDocumentation } from "./openapi";

@Module({
  controllers: [SpecController, NativeController, AiController],
  providers: [
    { provide: SpecService, useValue: {} },
    { provide: NativeService, useValue: {} },
  ],
})
class DocumentationModule {}

async function document() {
  const app = await NestFactory.create(DocumentationModule, { logger: false });
  app.setGlobalPrefix("api/v1");
  try {
    return SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
  } finally {
    await app.close();
  }
}

it("documents a usable login request including credentials and identifier alternatives in the generated OpenAPI", async () => {
  const doc = await document();
  const operation = doc.paths["/api/v1/auth/login"].post!;
  const body = operation.requestBody as {
    content: Record<
      string,
      {
        schema: {
          properties: Record<string, unknown>;
          required: string[];
          anyOf: unknown[];
        };
        examples: unknown;
      }
    >;
  };
  const json = body.content["application/json"];
  expect(json.schema.properties).toHaveProperty("identifier");
  expect(json.schema.properties).toHaveProperty("phone");
  expect(json.schema.properties).toHaveProperty("password");
  expect(json.schema.required).toContain("password");
  expect(json.schema.anyOf).toHaveLength(3);
  expect(json.examples).toBeTruthy();
  expect(operation.responses).toHaveProperty("200");
  expect(operation.responses).not.toHaveProperty("201");
});

it("keeps resource examples valid against the actual field mapper and database CHECK metadata", () => {
  for (const e of endpoints.filter(
    (e) => e.resource && ["create", "update"].includes(e.action),
  )) {
    const documentation = requestDocumentation(e)!;
    const example = (
      documentation as {
        examples: { sample: { value: Record<string, unknown> } };
      }
    ).examples.sample.value;
    expect(
      () => input(e.resource!, example, e.action === "update"),
      e.source,
    ).not.toThrow();
  }
});

it("documents native table-specific bodies and exposes the AI image file picker instead of an empty JSON object", async () => {
  const doc = await document();
  const native = doc.paths["/api/v1/data/{table}"].post!.requestBody as {
    content: Record<
      string,
      {
        schema: {
          anyOf: {
            title: string;
            properties: Record<string, unknown>;
            required?: string[];
          }[];
        };
      }
    >;
  };
  const schemas = native.content["application/json"].schema.anyOf;
  const account = schemas.find((s) => s.title === "taikhoan")!;
  expect(account.properties).toHaveProperty("password");
  expect(account.properties).not.toHaveProperty("mat_khau_ma_hoa");
  const uas = schemas.find((s) => s.title === "nhatkyuashangngay")!;
  expect(uas.properties).not.toHaveProperty("diem_uas_ngay");
  expect(uas.required).toContain("diem_san_phu_hss");
  const ai = doc.paths["/api/v1/ai/analyze"].post!;
  const upload = ai.requestBody as {
    content: Record<
      string,
      { schema: { properties: Record<string, unknown>; required: string[] } }
    >;
  };
  expect(upload.content["multipart/form-data"].schema.properties.image).toEqual(
    expect.objectContaining({ type: "string", format: "binary" }),
  );
  expect(ai.security).toEqual([{ bearer: [] }]);
});

it("provides explicit properties, required markers and examples for every supported write body, and accurately documents unsupported operations", async () => {
  const doc = await document();
  for (const e of endpoints) {
    const path = "/api/v1/" + e.path.replace(/:([a-z_]+)/g, "{$1}");
    const op = doc.paths[path][e.method.toLowerCase() as "post"]!;
    if (e.action === "unsupported") {
      expect(Object.keys(op.responses), e.source).toEqual(["501"]);
      expect(op.requestBody, e.source).toBeUndefined();
      continue;
    }
    if (
      !["POST", "PUT", "PATCH"].includes(e.method) ||
      ["logout", "accept"].includes(e.action)
    )
      continue;
    const request = op.requestBody as {
      content: Record<
        string,
        {
          schema: { properties: Record<string, unknown> };
          examples: Record<string, unknown>;
        }
      >;
    };
    expect(request, e.source).toBeTruthy();
    const content = Object.values(request.content)[0];
    expect(
      Object.keys(content.schema.properties).length,
      e.source,
    ).toBeGreaterThan(0);
    expect(Object.keys(content.examples).length, e.source).toBeGreaterThan(0);
  }
});

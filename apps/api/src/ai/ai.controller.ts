import {
  BadRequestException,
  Controller,
  Post,
  ServiceUnavailableException,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ModelResult, parallelInference } from "./parallel";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";

@Controller("ai")
@ApiTags("Phân tích ảnh AI")
@ApiBearerAuth()
export class AiController {
  private busy = false;
  @Post("analyze")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    required: true,
    description:
      "Chọn ảnh JPEG/PNG/WebP tối đa 8 MiB và 16 triệu pixel. Yêu cầu Bearer session; mỗi tiến trình xử lý một yêu cầu AI tại một thời điểm.",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["image"],
      properties: {
        image: {
          type: "string",
          format: "binary",
          description: "Ảnh cần phân tích; nhấn Choose File để chọn tệp.",
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor("image", {
      limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  async analyze(@UploadedFile() file?: { mimetype: string; buffer: Buffer }) {
    if (
      !file ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
    )
      throw new BadRequestException(
        "Chọn ảnh JPEG, PNG hoặc WebP, tối đa 8 MB.",
      );
    if (this.busy)
      throw new ServiceUnavailableException(
        "AI đang xử lý ảnh khác. Vui lòng thử lại.",
      );
    this.busy = true;
    const started = Date.now();
    try {
      const result = await parallelInference(
        () => this.run("lesions", file.buffer),
        () => this.run("skin", file.buffer),
        () => this.run("counting", file.buffer),
      );
      return { ...result, elapsed_ms: Date.now() - started, persisted: false };
    } catch {
      throw new ServiceUnavailableException(
        "Không hoàn tất cả ba model. Kiểm tra dịch vụ AI local và thử ảnh JPEG/PNG/WebP rõ, không quá 16 triệu pixel.",
      );
    } finally {
      this.busy = false;
    }
  }
  private run(id: string, image: Buffer): Promise<ModelResult> {
    const root = [process.cwd(), resolve(process.cwd(), "../..")].find((p) =>
      existsSync(resolve(p, "ml/infer_model.py")),
    );
    if (!root) return Promise.reject(new Error("AI script missing"));
    const python =
      process.env.AI_PYTHON ||
      resolve(
        root,
        ".data/ai-venv",
        process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
      );
    return new Promise((done, reject) => {
      const child = spawn(python, [resolve(root, "ml/infer_model.py"), id], {
        cwd: root,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
      let output = "";
      let failed = false;
      const timer = setTimeout(() => {
        failed = true;
        child.kill();
        reject(new Error("AI timeout"));
      }, 120_000);
      child.stdout.on("data", (data) => {
        output += data.toString();
        if (output.length > 2_000_000) {
          failed = true;
          child.kill();
        }
      });
      // Drain diagnostics without logging patient data or returning internal paths.
      child.stderr.on("data", () => {});
      child.stdin.on("error", () => {});
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0 || failed) return reject(new Error("Worker failed"));
        try {
          const result = JSON.parse(output) as ModelResult;
          if (result.id !== id || !Array.isArray(result.detections))
            throw new Error("Invalid output");
          done(result);
        } catch (error) {
          reject(error);
        }
      });
      child.stdin.end(image);
    });
  }
}

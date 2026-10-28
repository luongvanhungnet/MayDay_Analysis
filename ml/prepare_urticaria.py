"""Convert the supplied mixed box/polygon export into a separate detection dataset.

Only images and labels are read. No instructions or executable content from the ZIP
are executed. The input archive is never modified.
"""
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import zipfile

NAMES = ["Body", "Multiple", "Single"]


def detection_row(line):
    values = [float(v) for v in line.split()]
    if not values or not all(math.isfinite(v) for v in values):
        raise ValueError("Empty or non-finite label")
    cls = int(values[0])
    if values[0] != cls or cls not in range(len(NAMES)):
        raise ValueError("Unknown class")
    coords = values[1:]
    if any(v < 0 or v > 1 for v in coords):
        raise ValueError("Coordinates must be normalized to [0,1]")
    if len(values) == 5:
        x, y, w, h = coords
        kind = "box"
    elif len(coords) >= 6 and len(coords) % 2 == 0:
        xs, ys = coords[::2], coords[1::2]
        x, y = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        w, h = max(xs) - min(xs), max(ys) - min(ys)
        kind = "polygon"
    else:
        raise ValueError("Expected xywh box or polygon with at least three points")
    if w <= 0 or h <= 0:
        raise ValueError("Degenerate annotation")
    return f"{cls} {x:.10f} {y:.10f} {w:.10f} {h:.10f}", kind, cls


def prepare(archive, output):
    archive, output = Path(archive), Path(output).resolve()
    if output.exists():
        raise FileExistsError(f"Use a new empty output path; refusing overwrite: {output}")
    report = {"source_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
              "names": NAMES, "images": {}, "annotations": {}, "input_formats": {},
              "exact_duplicate_images": [], "warning": "Multiple marks regions, not a known number of individual wheals. Patient identities are unavailable; patient-level split leakage has not been ruled out."}
    files = {}
    annotation_types, class_counts, hashes = collections.Counter(), collections.Counter(), {}
    with zipfile.ZipFile(archive) as z:
        for info in z.infolist():
            p = PurePosixPath(info.filename)
            if len(p.parts) != 3 or p.parts[0] not in ("train", "valid", "test"):
                continue
            split, folder, filename = p.parts
            if folder not in ("images", "labels") or filename in (".", ".."):
                continue
            if folder == "images" and p.suffix.lower() not in (".jpg", ".jpeg", ".png"):
                continue
            if folder == "labels" and p.suffix.lower() != ".txt":
                continue
            if info.filename in files:
                raise ValueError(f"Duplicate image/label member: {info.filename}")
            files[info.filename] = z.read(info)
        if not files:
            raise ValueError("No train/valid/test images and labels found")
        converted = {}
        for split in ("train", "valid", "test"):
            images = [n for n in files if n.startswith(f"{split}/images/")]
            if not images:
                raise ValueError(f"Missing images for {split}")
            report["images"][split] = len(images)
            for name in images:
                content = files[name]
                sha = hashlib.sha256(content).hexdigest()
                if sha in hashes:
                    report["exact_duplicate_images"].append([hashes[sha], name])
                hashes[sha] = name
                label = str(PurePosixPath(name.replace("/images/", "/labels/")).with_suffix(".txt"))
                if label not in files:
                    raise ValueError(f"Missing label: {label}; verify negatives explicitly")
                rows = []
                for line_number, line in enumerate(files[label].decode("utf-8-sig").splitlines(), 1):
                    if not line.strip():
                        continue
                    try:
                        row, kind, cls = detection_row(line)
                    except ValueError as exc:
                        raise ValueError(f"{label}:{line_number}: {exc}") from exc
                    rows.append(row)
                    annotation_types[kind] += 1
                    class_counts[NAMES[cls]] += 1
                converted[label] = ("\n".join(rows) + "\n").encode()
        cross_split = [pair for pair in report["exact_duplicate_images"] if pair[0].split('/')[0] != pair[1].split('/')[0]]
        if cross_split:
            raise ValueError(f"Exact duplicate images across splits: {cross_split}")
        output.mkdir(parents=True)
        for name, content in files.items():
            if "/images/" in name:
                target = output / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(content)
        for name, content in converted.items():
            target = output / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
    report["input_formats"] = dict(annotation_types)
    report["annotations"] = dict(class_counts)
    config = f"path: {output.as_posix()}\ntrain: train/images\nval: valid/images\ntest: test/images\nnames:\n" + "".join(f"  {i}: {name}\n" for i, name in enumerate(NAMES))
    (output / "data.yaml").write_text(config, encoding="utf-8")
    (output / "audit.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive")
    parser.add_argument("output")
    args = parser.parse_args()
    print(json.dumps(prepare(args.archive, args.output), indent=2))

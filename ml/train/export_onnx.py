"""Export the trained localiser to ONNX and check parity with PyTorch.

Usage: uv run python -m train.export_onnx --weights runs/loc/best.pt --out models/localiser.onnx
"""

import argparse
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch

from train.model import Localiser


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--weights", default="runs/loc/best.pt")
    p.add_argument("--out", default="models/localiser.onnx")
    p.add_argument(
        "--history", default=None, help="history.json from training, copied into the card"
    )
    a = p.parse_args()
    model = Localiser(encoder_weights=None)
    model.load_state_dict(torch.load(a.weights, map_location="cpu"))
    model.eval()
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    dummy = torch.rand(1, 3, 544, 832)
    torch.onnx.export(
        model,
        dummy,
        str(out),
        input_names=["image"],
        output_names=["logits"],
        opset_version=17,
        dynamic_axes={
            "image": {0: "batch", 2: "height", 3: "width"},
            "logits": {0: "batch", 2: "height", 3: "width"},
        },
        dynamo=False,
    )
    sess = ort.InferenceSession(str(out), providers=["CPUExecutionProvider"])
    x = torch.rand(1, 3, 512, 768)
    with torch.no_grad():
        ref = model(x).numpy()
    got = sess.run(None, {"image": x.numpy()})[0]
    # Compared as probabilities, which is what the API uses. A trained model emits logits of
    # about +-40, where onnxruntime's fused kernels give absolute logit differences above 1e-3.
    max_diff = float(np.abs(1 / (1 + np.exp(-ref)) - 1 / (1 + np.exp(-got))).max())
    assert max_diff < 1e-3, f"ONNX parity failed: max diff {max_diff}"
    card = {
        "name": "pramaan-edit-localiser",
        "architecture": "U-Net, EfficientNet-B0 encoder, RGB + 3 SRM residual channels",
        "input": "RGB float32 in [0,1], NCHW, height and width multiples of 32",
        "output": "per-pixel logit of edited region",
        "exported_at": datetime.now(UTC).isoformat(),
        "sha256": hashlib.sha256(out.read_bytes()).hexdigest(),
        "onnx_parity_max_abs_diff": max_diff,
        "onnx_parity_compares": "sigmoid probabilities, PyTorch CPU vs onnxruntime CPU",
        "training": json.loads(Path(a.history).read_text()) if a.history else None,
    }
    out.with_suffix(".json").write_text(json.dumps(card, indent=2))
    print(f"exported {out} (parity max diff {max_diff:.2e})")


if __name__ == "__main__":
    main()

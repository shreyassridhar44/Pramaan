"""Edit-localisation network: fixed noise-residual filters + U-Net (EfficientNet-B0 encoder).

The high-pass filters are part of the network, so the exported ONNX model takes a plain RGB image
in [0, 1] and returns one logit per pixel.
"""

import torch
import torch.nn.functional as F
from segmentation_models_pytorch import Unet
from torch import nn

MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)


def _srm_kernels() -> torch.Tensor:
    """Three classic high-pass residual kernels used in image forensics (5x5)."""
    k1 = (
        torch.tensor(
            [
                [0, 0, 0, 0, 0],
                [0, -1, 2, -1, 0],
                [0, 2, -4, 2, 0],
                [0, -1, 2, -1, 0],
                [0, 0, 0, 0, 0],
            ],
            dtype=torch.float32,
        )
        / 4
    )
    k2 = (
        torch.tensor(
            [
                [-1, 2, -2, 2, -1],
                [2, -6, 8, -6, 2],
                [-2, 8, -12, 8, -2],
                [2, -6, 8, -6, 2],
                [-1, 2, -2, 2, -1],
            ],
            dtype=torch.float32,
        )
        / 12
    )
    k3 = (
        torch.tensor(
            [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 1, -2, 1, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]],
            dtype=torch.float32,
        )
        / 2
    )
    return torch.stack([k1, k2, k3]).unsqueeze(1)  # 3 x 1 x 5 x 5


class Localiser(nn.Module):
    def __init__(self, encoder_weights: str | None = "imagenet") -> None:
        super().__init__()
        self.register_buffer("srm", _srm_kernels())
        self.register_buffer("mean", torch.tensor(MEAN).view(1, 3, 1, 1))
        self.register_buffer("std", torch.tensor(STD).view(1, 3, 1, 1))
        self.net = Unet(
            "efficientnet-b0", encoder_weights=encoder_weights, in_channels=6, classes=1
        )

    def forward(self, rgb: torch.Tensor) -> torch.Tensor:
        gray = (0.299 * rgb[:, 0:1] + 0.587 * rgb[:, 1:2] + 0.114 * rgb[:, 2:3]) * 255.0
        residual = torch.clamp(F.conv2d(gray, self.srm, padding=2), -3.0, 3.0) / 3.0
        x = torch.cat([(rgb - self.mean) / self.std, residual], dim=1)
        return self.net(x)


def dice_bce(logits: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
    bce = F.binary_cross_entropy_with_logits(logits, target)
    prob = torch.sigmoid(logits)
    inter = (prob * target).sum(dim=(1, 2, 3))
    union = prob.sum(dim=(1, 2, 3)) + target.sum(dim=(1, 2, 3))
    has_edit = (target.sum(dim=(1, 2, 3)) > 0).float()
    dice = 1 - (2 * inter + 1) / (union + 1)
    # Dice only where an edit exists; clean crops are handled by BCE.
    dice = (dice * has_edit).sum() / has_edit.sum().clamp(min=1)
    return bce + dice
